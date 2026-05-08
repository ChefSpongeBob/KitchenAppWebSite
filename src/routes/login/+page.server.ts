import { fail, isRedirect, redirect, type Actions } from '@sveltejs/kit';
import { hashSessionToken, verifyPassword } from '$lib/server/auth';
import {
	getSessionCookieDeleteOptions,
	getSessionCookieName,
	getSessionCookieOptions
} from '$lib/server/authCookies';
import { hasColumn } from '$lib/server/dbSchema';
import { bootstrapBusinessForUser, getUserBusinessContext } from '$lib/server/business';
import { effectiveAppRoleFromBusinessRole } from '$lib/server/permissions';
import {
	checkRateLimit,
	clearRateLimit,
	getRequestIpAddress,
	rateLimitFailure,
	writeAuditLog
} from '$lib/server/security';
import type { PageServerLoad } from './$types';

const GENERIC_LOGIN_ERROR = 'We could not sign you in with those details. Check your email and password and try again.';

function resolvePostLoginPath() {
	return '/app';
}

async function hasEmailNormalizedColumn(db: App.Platform['env']['DB']) {
	return hasColumn(db, 'users', 'email_normalized');
}

async function hasIsActiveColumn(db: App.Platform['env']['DB']) {
	return hasColumn(db, 'users', 'is_active');
}

async function hasRoleColumn(db: App.Platform['env']['DB']) {
	return hasColumn(db, 'users', 'role');
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
	db: App.Platform['env']['DB'] | undefined,
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
				   OR session_token_hash = ?
				   OR id = ?
			`
			)
			.bind(now, sessionTokenHash, sessionToken, sessionToken)
			.run();
	}

	const primaryCookie = getSessionCookieName();
	cookies.delete(primaryCookie, getSessionCookieDeleteOptions(request));
	cookies.delete('session_id', { path: '/' });
	cookies.delete('session_id_pwa', { path: '/' });
}

export const load: PageServerLoad = async ({ locals }) => {
	const db = locals.DB;
	if (!db || !locals.userId) {
		return { activeSession: null };
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
		const effectiveRole = effectiveAppRoleFromBusinessRole(businessRole);

		return {
			activeSession: {
				email: String(user?.email ?? '').trim().toLowerCase(),
				displayName: String(user?.display_name ?? '').trim(),
				businessName: locals.businessName ?? null,
				businessRole,
				role: effectiveRole,
				continuePath: resolvePostLoginPath()
			}
		};
	} catch {
		return { activeSession: null };
	}
};

export const actions: Actions = {
	not_you: async ({ cookies, locals, request }) => {
		await revokeActiveSession(locals.DB, cookies, request);
		throw redirect(303, '/login?switch=1');
	},
	default: async ({ request, cookies, locals, getClientAddress }) => {
		let email = '';
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

			const ipAddress = getRequestIpAddress(request, getClientAddress);
			const [ipLimit, emailLimit] = await Promise.all([
				checkRateLimit(db, {
					action: 'login_ip',
					identifier: ipAddress,
					limit: 20,
					windowSeconds: 15 * 60,
					blockSeconds: 15 * 60
				}),
				checkRateLimit(db, {
					action: 'login_email',
					identifier: email,
					limit: 8,
					windowSeconds: 15 * 60,
					blockSeconds: 15 * 60
				})
			]);

			if (!ipLimit.allowed || !emailLimit.allowed) {
				await writeAuditLog(db, {
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
				await writeAuditLog(db, {
					action: 'login_failed_unknown_user',
					request,
					getClientAddress,
					email
				});
				return fail(400, { error: GENERIC_LOGIN_ERROR, email });
			}
			if (hasIsActive && user.is_active !== 1) {
				await writeAuditLog(db, {
					action: 'login_blocked_inactive_user',
					request,
					getClientAddress,
					targetUserId: user.id,
					email
				});
				return fail(403, { error: 'Your account is not active yet. Contact your workspace admin for access.', email });
			}

			const passwordCheck = await verifyPassword(password, user.password_hash);
			if (!passwordCheck.valid) {
				await writeAuditLog(db, {
					action: 'login_failed_bad_password',
					request,
					getClientAddress,
					targetUserId: user.id,
					email
				});
				return fail(400, { error: GENERIC_LOGIN_ERROR, email });
			}

			const now = Math.floor(Date.now() / 1000);
			const expires = now + 60 * 60 * 24 * 30;

			const sessionId = crypto.randomUUID();
			const sessionToken = crypto.randomUUID();
			const sessionTokenHash = await hashSessionToken(sessionToken);

			let device = await db
				.prepare(
					`
					SELECT id
					FROM devices
					WHERE user_id = ?
					AND revoked_at IS NULL
					LIMIT 1
				`
				)
				.bind(user.id)
				.first<{ id: string }>();

			let deviceId = device?.id;

			if (!deviceId) {
				deviceId = crypto.randomUUID();

				await db
					.prepare(
						`
						INSERT INTO devices (
							id,
							user_id,
							pin_hash,
							user_agent,
							last_ip,
							created_at,
							updated_at
						)
						VALUES (?, ?, ?, ?, ?, ?, ?)
					`
					)
					.bind(deviceId, user.id, '', request.headers.get('user-agent') ?? null, ipAddress, now, now)
					.run();
			} else {
				await db
					.prepare(`UPDATE devices SET user_agent = ?, last_ip = ?, last_seen_at = ?, updated_at = ? WHERE id = ?`)
					.bind(request.headers.get('user-agent') ?? null, ipAddress, now, now, deviceId)
					.run();
			}

			await db
				.prepare(
					`
					INSERT INTO sessions (
						id,
						user_id,
						device_id,
						session_token_hash,
						created_at,
						last_seen_at,
						expires_at
					)
					VALUES (?, ?, ?, ?, ?, ?, ?)
				`
				)
				.bind(sessionId, user.id, deviceId, sessionTokenHash, now, now, expires)
				.run();

			if (passwordCheck.needsRehash && passwordCheck.upgradedHash) {
				await db
					.prepare(
						`
						UPDATE users
						SET password_hash = ?, updated_at = ?
						WHERE id = ?
					`
					)
					.bind(passwordCheck.upgradedHash, now, user.id)
					.run();
			}

			const businessContext = await getUserBusinessContext(db, user.id);
			if (!businessContext) {
				await bootstrapBusinessForUser(db, user.id, user.role ?? null, user.display_name ?? user.email);
			}

			await Promise.all([
				clearRateLimit(db, 'login_email', email),
				writeAuditLog(db, {
					action: 'login_success',
					request,
					getClientAddress,
					businessId: businessContext?.businessId ?? null,
					targetUserId: user.id,
					email
				})
			]);

			setSessionCookies(cookies, request, sessionToken);
			throw redirect(303, resolvePostLoginPath());
		} catch (err) {
			if (isRedirect(err)) {
				throw err;
			}
			const message = err instanceof Error ? err.message : String(err ?? '');
			console.error('Login action failed:', message);
			if (message.includes('D1_ERROR: no such table')) {
				return fail(503, { error: 'Sign in is temporarily unavailable while the workspace finishes setup.', email: '' });
			}
			return fail(500, { error: 'Sign in failed. Please try again.', email });
		}
	}
};
