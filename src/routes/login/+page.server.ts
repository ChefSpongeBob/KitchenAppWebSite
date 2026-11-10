import { fail, isRedirect, redirect, type Actions } from '@sveltejs/kit';
import { dev } from '$app/env';
import { hashSessionToken, verifyPassword } from '#lib/server/auth.ts';
import {
	getSessionCookieDeleteOptions,
	getSessionCookieName,
	getSessionCookieOptions
} from '#lib/server/authCookies.ts';
import {
	ACTIVE_BUSINESS_COOKIE,
	getActiveBusinessCookieDeleteOptions,
	restaurantLandingPath
} from '#lib/server/activeBusiness.ts';
import { hasColumn } from '#lib/server/dbSchema.ts';
import { commitPasswordSignIn } from '#lib/server/authLifecycle.ts';
import { bootstrapBusinessForUser, getUserBusinessContext, loadUserBusinessMemberships } from '#lib/server/business.ts';
import { normalizeInvitationCode, invitationRegistrationPath, invitationLoginPath } from '#lib/invitations.ts';
import { effectiveAppRoleFromBusinessRole } from '#lib/server/permissions.ts';
import {
	checkRateLimit,
	readRateLimitBlock,
	getRequestIpAddress,
	rateLimitFailure,
	writeAuditLogSafe
} from '#lib/server/security.ts';
import { getTurnstileSiteKey, validateTurnstileSubmission } from '#lib/server/turnstile.ts';
import type { PageServerLoad } from './$types';
import { findPlatformStaff } from '#lib/server/platformStaff.ts';
import { beginStaffEmailChallenge } from '#lib/server/platformStaffEmail.ts';

const GENERIC_LOGIN_ERROR = 'We could not sign you in with those details. Check your email and password and try again.';

async function resolvePostLoginPath(
	db: App.RuntimeEnv['DB'],
	userId: string,
	businessId: string | null | undefined,
	url?: URL
) {
	if (url?.searchParams.get('staff') === '1') {
		return await findPlatformStaff(db, userId) ? '/staff' : '/app';
	}
	const inviteCode = normalizeInvitationCode(url?.searchParams.get('invite'));
	if (inviteCode) return invitationRegistrationPath(inviteCode);
	const memberships = await loadUserBusinessMemberships(db, userId);
	if (memberships.length > 1) return '/workspace';
	if (memberships.length === 0) return '/workspace';
	if (url?.searchParams.get('onboarding') === '1') {
		return '/settings?onboarding=1';
	}
	return restaurantLandingPath(db, userId, memberships[0].businessId);
}

async function hasEmailNormalizedColumn(db: App.RuntimeEnv['DB']) {
	return hasColumn(db, 'users', 'email_normalized');
}

async function hasIsActiveColumn(db: App.RuntimeEnv['DB']) {
	return hasColumn(db, 'users', 'is_active');
}

async function hasRoleColumn(db: App.RuntimeEnv['DB']) {
	return hasColumn(db, 'users', 'role');
}

async function resolvePrimaryBusinessIdForUser(db: App.RuntimeEnv['DB'], userId: string) {
	const row = await db
		.prepare(
			`
			SELECT business_id
			FROM business_users
			WHERE user_id = ?
			  AND COALESCE(is_active, 1) = 1
			ORDER BY
				CASE role
					WHEN 'owner' THEN 0
					WHEN 'manager' THEN 1
					WHEN 'admin' THEN 1
					ELSE 2
				END,
				created_at DESC
			LIMIT 1
			`
		)
		.bind(userId)
		.first<{ business_id: string | null }>();

	return row?.business_id ?? null;
}

function setSessionCookies(
	cookies: Parameters<Actions['default']>[0]['cookies'],
	request: Request,
	sessionToken: string
) {
	const cookieName = getSessionCookieName();
	cookies.set(cookieName, sessionToken, getSessionCookieOptions(request));
	cookies.delete('session_id', { path: '/' });
	cookies.delete('session_id_pwa', { path: '/' });
}

function resolveSessionToken(cookies: Parameters<PageServerLoad>[0]['cookies']) {
	const primaryCookie = getSessionCookieName();
	return (
		cookies.get(primaryCookie) ?? cookies.get('session_id') ?? cookies.get('session_id_pwa') ?? null
	);
}

async function revokeActiveSession(
	db: App.RuntimeEnv['DB'] | undefined,
	cookies: Parameters<Actions['default']>[0]['cookies'],
	request: Request
) {
	const sessionToken = resolveSessionToken(cookies);
	if (sessionToken && db) {
		const now = Math.floor(Date.now() / 1000);
		const sessionTokenHash = await hashSessionToken(sessionToken);
		await db
			.prepare(
				`
				UPDATE sessions
				SET revoked_at = ?
				WHERE session_token_hash = ?
				   OR (session_token_hash = ? AND length(session_token_hash) <> 64)
			`
			)
			.bind(now, sessionTokenHash, sessionToken)
			.run();
	}

	const primaryCookie = getSessionCookieName();
	cookies.delete(primaryCookie, getSessionCookieDeleteOptions(request));
	cookies.delete('session_id', { path: '/' });
	cookies.delete('session_id_pwa', { path: '/' });
	cookies.delete(ACTIVE_BUSINESS_COOKIE, getActiveBusinessCookieDeleteOptions(request));
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const turnstileSiteKey = getTurnstileSiteKey(locals.env);
	const db = locals.DB;
	if (url.searchParams.get('staff') === '1') {
		if (db && locals.userId && await findPlatformStaff(db, locals.userId)) redirect(303, '/staff');
		return { activeSession: null, turnstileSiteKey };
	}
	if (!db || !locals.userId) {
		return { activeSession: null, turnstileSiteKey };
	}

	try {
		const user = await db
			.prepare(
				`
				SELECT email, display_name
				FROM users
				WHERE id = ?
				LIMIT 1
			`
			)
			.bind(locals.userId)
			.first<{ email: string | null; display_name: string | null }>();

		const businessRole = locals.businessRole ?? null;
		const effectiveRole = effectiveAppRoleFromBusinessRole(
			businessRole,
			locals.businessPermissionTemplate,
			locals.businessCapabilities
		);

		return {
			turnstileSiteKey,
			activeSession: {
				email: String(user?.email ?? '').trim().toLowerCase(),
				displayName: String(user?.display_name ?? '').trim(),
				businessName: locals.businessName ?? null,
				businessRole,
				role: effectiveRole,
				continuePath: await resolvePostLoginPath(db, locals.userId, locals.businessId, url)
			}
		};
	} catch {
		return { activeSession: null, turnstileSiteKey };
	}
};

export const actions: Actions = {
	not_you: async ({ cookies, locals, request, url }) => {
		await revokeActiveSession(locals.DB, cookies, request);
		const inviteCode = normalizeInvitationCode(url.searchParams.get('invite'));
		if (inviteCode && url.searchParams.get('staff') !== '1') throw redirect(303, invitationLoginPath(inviteCode));
		throw redirect(303, url.searchParams.get('staff') === '1' ? '/login?staff=1&switch=1' : '/login?switch=1');
	},
	login: async ({ request, cookies, locals, getClientAddress, url }) => {
		let email = '';
		const staffLogin = url.searchParams.get('staff') === '1';
		try {
			const formData = await request.formData();

			email = String(formData.get('email') || '').trim().toLowerCase();
			const password = String(formData.get('password') || '');

			if (!email || !password) {
				return fail(400, { error: 'Enter your email and password to continue.', email });
			}

			const db = locals.DB;
			if (!db) {
				return fail(503, { error: 'Sign in is temporarily unavailable. Please try again in a moment.', email });
			}

			if (locals.userId && !staffLogin) {
				const activeUser = await db
					.prepare(
						`
						SELECT email
						FROM users
						WHERE id = ?
						LIMIT 1
						`
					)
					.bind(locals.userId)
					.first<{ email: string | null }>();

				if (String(activeUser?.email ?? '').trim().toLowerCase() === email) {
					throw redirect(303, await resolvePostLoginPath(db, locals.userId, locals.businessId, url));
				}
			}

			const ipAddress = getRequestIpAddress(request, getClientAddress);
			const requestLimit = await checkRateLimit(db, { action: 'login_ip', identifier: ipAddress,
				limit: 200, windowSeconds: 15 * 60, blockSeconds: 15 * 60 });
			if (!requestLimit.allowed) return rateLimitFailure();
			const turnstile = await validateTurnstileSubmission({
				env: locals.env,
				formData,
				request
			});
			if (!turnstile.ok) {
				await writeAuditLogSafe(db, {
					action: 'login_turnstile_failed',
					request,
					getClientAddress,
					email
				});
				return fail(400, { error: 'Security check failed. Refresh and try again.', email });
			}

			let ipLimit = { allowed: true, retryAfterSeconds: 0 };
			let emailLimit = { allowed: true, retryAfterSeconds: 0 };
			try {
				ipLimit = await readRateLimitBlock(db, 'login_failed_ip', ipAddress);
				emailLimit = await checkRateLimit(db, {
					action: 'login_email',
					identifier: email,
					limit: 8,
					windowSeconds: 15 * 60,
					blockSeconds: 15 * 60
				});
			} catch (error) {
				if (!dev) throw error;
				console.warn('Local login rate limit skipped:', error instanceof Error ? error.message : String(error));
			}

			if (!ipLimit.allowed || !emailLimit.allowed) {
				await writeAuditLogSafe(db, {
					action: 'login_rate_limited',
					request,
					getClientAddress,
					email
				});
				return rateLimitFailure();
			}

			const hasNormalized = await hasEmailNormalizedColumn(db);
			const hasIsActive = await hasIsActiveColumn(db);
			const hasRole = await hasRoleColumn(db);
			const user = hasNormalized
				? await db
						.prepare(
							`
			SELECT id, email, display_name, password_hash${hasIsActive ? ', is_active' : ''}${hasRole ? ', role' : ''}
			FROM users
			WHERE email_normalized = ?
			LIMIT 1
			`
						)
						.bind(email)
						.first<{
							id: string;
							email: string | null;
							display_name: string | null;
							password_hash: string | null;
							is_active?: number | null;
							role?: string | null;
						}>()
				: await db
						.prepare(
							`
			SELECT id, email, display_name, password_hash${hasIsActive ? ', is_active' : ''}${hasRole ? ', role' : ''}
			FROM users
			WHERE lower(email) = ?
			LIMIT 1
			`
						)
						.bind(email)
						.first<{
							id: string;
							email: string | null;
							display_name: string | null;
							password_hash: string | null;
							is_active?: number | null;
							role?: string | null;
						}>();

			if (!user || !user.password_hash) {
				await checkRateLimit(db, { action: 'login_failed_ip', identifier: ipAddress,
					limit: 20, windowSeconds: 15 * 60, blockSeconds: 15 * 60 });
				await writeAuditLogSafe(db, {
					action: 'login_failed_unknown_user',
					request,
					getClientAddress,
					email
				});
				return fail(400, { error: GENERIC_LOGIN_ERROR, email });
			}
			if (hasIsActive && user.is_active !== 1) {
				await checkRateLimit(db, { action: 'login_failed_ip', identifier: ipAddress,
					limit: 20, windowSeconds: 15 * 60, blockSeconds: 15 * 60 });
				const auditBusinessId = await resolvePrimaryBusinessIdForUser(db, user.id);
				await writeAuditLogSafe(db, {
					action: 'login_blocked_inactive_user',
					request,
					getClientAddress,
					businessId: auditBusinessId,
					targetUserId: user.id,
					email
				});
				return fail(403, { error: 'Your account is not active yet. Contact your workspace admin for access.', email });
			}

			const passwordCheck = await verifyPassword(password, user.password_hash, locals.env);
			if (!passwordCheck.valid) {
				await checkRateLimit(db, { action: 'login_failed_ip', identifier: ipAddress,
					limit: 20, windowSeconds: 15 * 60, blockSeconds: 15 * 60 });
				const auditBusinessId = await resolvePrimaryBusinessIdForUser(db, user.id);
				await writeAuditLogSafe(db, {
					action: 'login_failed_bad_password',
					request,
					getClientAddress,
					businessId: auditBusinessId,
					targetUserId: user.id,
					email
				});
				return fail(400, { error: GENERIC_LOGIN_ERROR, email });
			}

			if (staffLogin && !await findPlatformStaff(db, user.id)) {
				return fail(403, { error: 'Staff access required.', email });
			}

			let businessContext = staffLogin ? null : await getUserBusinessContext(db, user.id);
			if (!businessContext && !staffLogin && !normalizeInvitationCode(url.searchParams.get('invite'))) {
				if (!dev) {
					await writeAuditLogSafe(db, {
						action: 'login_workspace_missing',
						request,
						getClientAddress,
						targetUserId: user.id,
						email
					});
					return fail(403, {
						error: 'No active workspace is connected to this account. Contact the business owner or support.',
						email
					});
				}
				businessContext = await bootstrapBusinessForUser(
					db,
					user.id,
					user.role ?? null,
					user.display_name ?? user.email
				);
			}

			const destination = await resolvePostLoginPath(db, user.id, businessContext?.businessId, url);
			const sessionId = crypto.randomUUID();
			const sessionToken = crypto.randomUUID();
			const sessionTokenHash = await hashSessionToken(sessionToken);
			const committed = await commitPasswordSignIn(db, {
				userId: user.id, email, verifiedPasswordHash: user.password_hash,
				upgradedHash: passwordCheck.needsRehash ? passwordCheck.upgradedHash : undefined,
				businessId: businessContext?.businessId, staffLogin, sessionId, sessionTokenHash,
				previousToken: resolveSessionToken(cookies), request, getClientAddress
			});
			if (!committed) return fail(400, { error: GENERIC_LOGIN_ERROR, email });
			cookies.delete(ACTIVE_BUSINESS_COOKIE, getActiveBusinessCookieDeleteOptions(request));
			setSessionCookies(cookies, request, sessionToken);
			if (staffLogin) {
				try {
					await beginStaffEmailChallenge({ ...locals, userId: user.id, sessionId }, '', 'sign_in');
				} catch {
					// Keep the primary session, but never open the console when code delivery fails.
					throw redirect(303, '/staff/security?delivery=retry');
				}
			}
			throw redirect(303, destination);
		} catch (err) {
			if (isRedirect(err)) {
				throw err;
			}
			const message = err instanceof Error ? err.message : String(err ?? '');
			console.error('Login action failed.');
			if (message.includes('D1_ERROR: no such table')) {
				return fail(503, { error: 'Sign in is temporarily unavailable while the workspace finishes setup.', email: '' });
			}
			return fail(500, { error: 'Sign in failed. Please try again.', email });
		}
	}
};
