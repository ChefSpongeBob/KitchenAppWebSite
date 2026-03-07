import { fail, redirect, type Actions } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { hashPassword, hashSessionToken } from '$lib/server/auth';

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		try {
			const formData = await request.formData();

			const displayName = String(formData.get('display_name') || '').trim();
			const email = String(formData.get('email') || '').trim().toLowerCase();
			const password = String(formData.get('password') || '');

			if (!displayName || !email || !password) {
				return fail(400, { error: 'All fields required.' });
			}
			if (password.length < 8) {
				return fail(400, { error: 'Password must be at least 8 characters.' });
			}

			const db = locals.DB;
			if (!db) {
				return fail(503, { error: 'Database is not configured yet.' });
			}

			const existing = await db.prepare(`
			SELECT id FROM users
			WHERE email_normalized = ?
		`)
				.bind(email)
				.first();

			if (existing) {
				return fail(400, { error: 'Account already exists.' });
			}

			const now = Math.floor(Date.now() / 1000);

			const userId = crypto.randomUUID();
			const deviceId = crypto.randomUUID();
			const sessionId = crypto.randomUUID();
			const sessionToken = crypto.randomUUID();
			const sessionTokenHash = await hashSessionToken(sessionToken);
			const passwordHash = await hashPassword(password);

			await db.prepare(`
			INSERT INTO users (
				id,
				email,
				email_normalized,
				password_hash,
				display_name,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`)
				.bind(userId, email, email, passwordHash, displayName, now, now)
				.run();

			await db.prepare(`
			INSERT INTO devices (
				id,
				user_id,
				pin_hash,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?)
		`)
				.bind(deviceId, userId, '', now, now)
				.run();

			await db.prepare(`
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
		`)
				.bind(
					sessionId,
					userId,
					deviceId,
					sessionTokenHash,
					now,
					now,
					now + 60 * 60 * 24 * 30
				)
				.run();

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
			console.error('Register action failed:', message);
			if (message.includes('UNIQUE constraint failed')) {
				return fail(400, { error: 'Account already exists.' });
			}
			if (message.includes('D1_ERROR: no such table')) {
				return fail(503, { error: 'Database tables are not ready yet.' });
			}
			return fail(500, { error: 'Registration failed. Please try again.' });
		}
	}
};
