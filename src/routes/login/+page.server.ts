import { fail, isRedirect, redirect, type Actions } from '@sveltejs/kit';
import { hashSessionToken, verifyPassword } from '$lib/server/auth';
import { getSessionCookieName, getSessionCookieOptions } from '$lib/server/authCookies';
import { hasColumn } from '$lib/server/dbSchema';
import type { PageServerLoad } from './$types';

async function hasEmailNormalizedColumn(db: App.Platform['env']['DB']) {
	return hasColumn(db, 'users', 'email_normalized');
}

async function hasIsActiveColumn(db: App.Platform['env']['DB']) {
	return hasColumn(db, 'users', 'is_active');
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

export const load: PageServerLoad = async ({ cookies, locals }) => {
	const db = locals.DB;
	if (!db) {
		return {};
	}

	const primaryCookie = getSessionCookieName();
	const sessionToken =
		cookies.get(primaryCookie) ?? cookies.get('session_id') ?? cookies.get('session_id_pwa');

	if (!sessionToken) {
		return {};
	}

	try {
		const now = Math.floor(Date.now() / 1000);
		const sessionTokenHash = await hashSessionToken(sessionToken);
		const session = await db
			.prepare(
				`
			SELECT
				s.id,
				s.device_id,
				s.expires_at,
				s.revoked_at,
				s.session_token_hash,
				d.id AS found_device_id,
				d.revoked_at AS device_revoked_at,
				u.id AS found_user_id,
				COALESCE(u.is_active, 1) AS user_is_active
			FROM sessions s
			LEFT JOIN devices d ON d.id = s.device_id
			LEFT JOIN users u ON u.id = s.user_id
			WHERE s.session_token_hash = ?
			   OR s.session_token_hash = ?
			   OR s.id = ?
			LIMIT 1
		`
			)
			.bind(sessionTokenHash, sessionToken, sessionToken)
			.first<{
				id: string;
				device_id: string | null;
				expires_at: number;
				revoked_at: number | null;
				session_token_hash: string;
				found_device_id: string | null;
				device_revoked_at: number | null;
				found_user_id: string | null;
				user_is_active: number;
			}>();

		const hasValidSession =
			!!session &&
			session.revoked_at === null &&
			session.expires_at >= now &&
			(!session.device_id ||
				(Boolean(session.found_device_id) && session.device_revoked_at === null)) &&
			Boolean(session.found_user_id) &&
			session.user_is_active === 1;

		if (hasValidSession) {
			throw redirect(303, '/app');
		}
	} catch (error) {
		if (isRedirect(error)) {
			throw error;
		}
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		try {
			const formData = await request.formData();

			const email = String(formData.get('email') || '').trim().toLowerCase();
			const password = String(formData.get('password') || '');

			if (!email || !password) {
				return fail(400, { error: 'Missing email or password.' });
			}

			const db = locals.DB;
			if (!db) {
				return fail(503, { error: 'Database is not configured yet.' });
			}

			const hasNormalized = await hasEmailNormalizedColumn(db);
			const hasIsActive = await hasIsActiveColumn(db);
			const user = hasNormalized
				? await db
						.prepare(
							`
			SELECT id, password_hash${hasIsActive ? ', is_active' : ''}
			FROM users
			WHERE email_normalized = ?
			`
						)
						.bind(email)
						.first<{ id: string; password_hash: string | null; is_active?: number | null }>()
				: await db
						.prepare(
							`
			SELECT id, password_hash${hasIsActive ? ', is_active' : ''}
			FROM users
			WHERE lower(email) = ?
			`
						)
						.bind(email)
						.first<{ id: string; password_hash: string | null; is_active?: number | null }>();

			if (!user) {
				return fail(400, { error: 'No account found for this email on this environment.' });
			}
			if (!user.password_hash) {
				return fail(400, { error: 'This account is missing password setup. Contact admin.' });
			}
			if (hasIsActive && user.is_active !== 1) {
				return fail(403, { error: 'Your account is pending admin approval.' });
			}

			const passwordCheck = await verifyPassword(password, user.password_hash);
			if (!passwordCheck.valid) {
				return fail(400, { error: 'Password did not match. Check for typos or autofill.' });
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
			throw redirect(303, '/app');
		} catch (err) {
			if (isRedirect(err)) {
				throw err;
			}
			const message = err instanceof Error ? err.message : String(err ?? '');
			console.error('Login action failed:', message);
			if (message.includes('D1_ERROR: no such table')) {
				return fail(503, { error: 'Database tables are not ready yet.' });
			}
			return fail(500, { error: 'Login failed. Please try again.' });
		}
	}
};
