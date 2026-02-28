import { fail, redirect, type Actions } from '@sveltejs/kit';
import { createHash } from 'crypto';

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		const formData = await request.formData();

		const email = String(formData.get('email') || '').trim().toLowerCase();
		const password = String(formData.get('password') || '');
		const pin = String(formData.get('pin') || '');

		if (!email || !password || !pin) {
			return fail(400, { error: 'All fields required.' });
		}

		const db = locals.DB;

		// Check if user exists
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

		const passwordHash = createHash('sha256')
			.update(password)
			.digest('hex');

		const pinHash = createHash('sha256')
			.update(pin)
			.digest('hex');

		// Create user
		await db.prepare(`
			INSERT INTO users (
				id,
				email,
				email_normalized,
				password_hash,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?)
		`)
		.bind(userId, email, email, passwordHash, now, now)
		.run();

		// Create device
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
		.bind(deviceId, userId, pinHash, now, now)
		.run();

		// Create session
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
			sessionId,
			now,
			now,
			now + 60 * 60 * 24 * 30
		)
		.run();

		cookies.set('session_id', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 60 * 60 * 24 * 30
		});

		cookies.set('pin_unlocked_at', String(now), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 60 * 60 * 24 * 30
		});

		throw redirect(303, '/');
	}
};