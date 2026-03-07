import { fail, redirect, type Actions } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { hashSessionToken, verifyPassword } from '$lib/server/auth';

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

			// Find active user
			const user = await db
				.prepare(
					`
			SELECT id, password_hash
			FROM users
			WHERE email_normalized = ?
			AND is_active = 1
			`
				)
				.bind(email)
				.first<{ id: string; password_hash: string | null }>();

			if (!user || !user.password_hash) {
				return fail(400, { error: 'Invalid credentials.' });
			}

			const passwordCheck = await verifyPassword(password, user.password_hash);
			if (!passwordCheck.valid) {
				return fail(400, { error: 'Invalid credentials.' });
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

			cookies.set('session_id', sessionToken, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: !dev,
				maxAge: 60 * 60 * 24 * 30
			});

			throw redirect(303, '/');
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err ?? '');
			console.error('Login action failed:', message);
			if (message.includes('D1_ERROR: no such table')) {
				return fail(503, { error: 'Database tables are not ready yet.' });
			}
			return fail(500, { error: 'Login failed. Please try again.' });
		}
	}
};
