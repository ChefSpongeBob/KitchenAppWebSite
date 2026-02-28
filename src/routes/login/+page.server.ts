import { fail, redirect, type Actions } from '@sveltejs/kit';
import { createHash } from 'crypto';

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		const formData = await request.formData();

		const email = String(formData.get('email') || '').trim().toLowerCase();
		const password = String(formData.get('password') || '');

		if (!email || !password) {
			return fail(400, { error: 'Missing email or password.' });
		}

		const db = locals.DB;

		// Find active user
		const user = await db.prepare(`
			SELECT id, password_hash
			FROM users
			WHERE email_normalized = ?
			AND is_active = 1
		`)
		.bind(email)
		.first();

		if (!user || !user.password_hash) {
			return fail(400, { error: 'Invalid credentials.' });
		}

		const passwordHash = createHash('sha256')
			.update(password)
			.digest('hex');

		if (passwordHash !== user.password_hash) {
			return fail(400, { error: 'Invalid credentials.' });
		}

		const now = Math.floor(Date.now() / 1000);
		const expires = now + 60 * 60 * 24 * 30;

		const sessionId = crypto.randomUUID();

		// Try to reuse existing active device
		let device = await db.prepare(`
			SELECT id
			FROM devices
			WHERE user_id = ?
			AND revoked_at IS NULL
			LIMIT 1
		`)
		.bind(user.id)
		.first();

		let deviceId = device?.id;

		// If no device exists yet, create one (PIN must be set later)
		if (!deviceId) {
			deviceId = crypto.randomUUID();

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
			.bind(
				deviceId,
				user.id,
				'', // empty until PIN is set
				now,
				now
			)
			.run();
		}

		// Create session attached to device
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
			user.id,
			deviceId,
			sessionId,
			now,
			now,
			expires
		)
		.run();

		cookies.set('session_id', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 60 * 60 * 24 * 30
		});

		cookies.delete('pin_unlocked_at', { path: '/' });

		throw redirect(303, '/pin');
	}
};