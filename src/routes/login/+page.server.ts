import { fail, isRedirect, redirect, type Actions } from '@sveltejs/kit';
import { hashSessionToken, verifyPassword } from '$lib/server/auth';
import {
	getSessionCookieDeleteOptions,
	getSessionCookieName,
	getSessionCookieOptions
} from '$lib/server/authCookies';
import { hasColumn } from '$lib/server/dbSchema';
import type { PageServerLoad } from './$types';

function resolvePostLoginPath(userRole: string | null | undefined, businessRole: string | null | undefined) {
	void userRole;
	void businessRole;
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
	// Remove legacy cookie keys so only one session key is used.
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

export const load: PageServerLoad = async ({ cookies, locals }) => {
	const db = locals.DB;
	if (!db || !locals.userId) {
		return { activeSession: null as const };
	}

	try {
		const user = await db
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

		return {
			activeSession: {
				email: String(user?.email ?? '').trim().toLowerCase()
			}
		};
	} catch {
		return { activeSession: null as const };
	}
};

export const actions: Actions = {
	not_you: async ({ cookies, locals, request }) => {
		await revokeActiveSession(locals.DB, cookies, request);
		throw redirect(303, '/login?switch=1');
	},
	default: async ({ request, cookies, locals }) => {
		try {
			const formData = await request.formData();

			const email = String(formData.get('email') || '').trim().toLowerCase();
			const password = String(formData.get('password') || '');

			if (!email || !password) {
				return fail(400, { error: 'Missing email or password.', email });
			}

			const db = locals.DB;
			if (!db) {
				return fail(503, { error: 'Database is not configured yet.', email });
			}

			const hasNormalized = await hasEmailNormalizedColumn(db);
			const hasIsActive = await hasIsActiveColumn(db);
			const hasRole = await hasRoleColumn(db);
			const user = hasNormalized
				? await db
						.prepare(
							`
			SELECT id, password_hash${hasIsActive ? ', is_active' : ''}${hasRole ? ', role' : ''}
			FROM users
			WHERE email_normalized = ?
			`
						)
						.bind(email)
						.first<{
							id: string;
							password_hash: string | null;
							is_active?: number | null;
							role?: string | null;
						}>()
				: await db
						.prepare(
							`
			SELECT id, password_hash${hasIsActive ? ', is_active' : ''}${hasRole ? ', role' : ''}
			FROM users
			WHERE lower(email) = ?
			`
						)
						.bind(email)
						.first<{
							id: string;
							password_hash: string | null;
							is_active?: number | null;
							role?: string | null;
						}>();

			if (!user) {
				return fail(400, { error: 'No account found for this email on this environment.', email });
			}
			if (!user.password_hash) {
				return fail(400, { error: 'This account is missing password setup. Contact admin.', email });
			}
			if (hasIsActive && user.is_active !== 1) {
				return fail(403, { error: 'Your account is pending admin approval.', email });
			}

			const passwordCheck = await verifyPassword(password, user.password_hash);
			if (!passwordCheck.valid) {
				return fail(400, { error: 'Password did not match. Check for typos or autofill.', email });
			}

			const now = Math.floor(Date.now() / 1000);
			const expires = now + 60 * 60 * 24 * 30;

			const sessionId = crypto.randomUUID();
			const sessionToken = crypto.randomUUID();
			const sessionTokenHash = await hashSessionToken(sessionToken);

			// Try to reuse existing active device
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
				.first();

			let deviceId = device?.id;

			// If no device exists yet, create one
			if (!deviceId) {
				deviceId = crypto.randomUUID();

				await db
					.prepare(
						`
				INSERT INTO devices (
					id,
					user_id,
					pin_hash,
					created_at,
					updated_at
				)
				VALUES (?, ?, ?, ?, ?)
			`
					)
					.bind(deviceId, user.id, '', now, now)
					.run();
			}

			// Create session attached to device
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

			setSessionCookies(cookies, request, sessionToken);
			throw redirect(303, resolvePostLoginPath(user.role ?? null, null));
		} catch (err) {
			if (isRedirect(err)) {
				throw err;
			}
			const message = err instanceof Error ? err.message : String(err ?? '');
			console.error('Login action failed:', message);
			if (message.includes('D1_ERROR: no such table')) {
				return fail(503, { error: 'Database tables are not ready yet.', email: '' });
			}
			return fail(500, { error: 'Login failed. Please try again.', email });
		}
	}
};
