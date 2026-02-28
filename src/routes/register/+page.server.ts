import { fail, redirect, type Actions } from '@sveltejs/kit';

async function sha256(input: string) {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hashBuffer))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		const formData = await request.formData();

		const displayName = String(formData.get('display_name') || '').trim();
		const email = String(formData.get('email') || '').trim().toLowerCase();
		const password = String(formData.get('password') || '');
		const pin = String(formData.get('pin') || '');

		if (!displayName || !email || !password || !pin) {
			return fail(400, { error: 'All fields required.' });
		}

		const db = locals.DB;

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

		const passwordHash = await sha256(password);
		const pinHash = await sha256(pin);

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
		.bind(deviceId, userId, pinHash, now, now)
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
			secure: true,
			maxAge: 60 * 60 * 24 * 30
		});

		cookies.set('pin_unlocked_at', '1', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: true
		});

		throw redirect(303, '/');
	}
};