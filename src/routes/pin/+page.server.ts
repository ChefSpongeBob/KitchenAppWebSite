import { fail, redirect, type Actions } from '@sveltejs/kit';

async function sha256(input: string) {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		const formData = await request.formData();
		const pin = String(formData.get('pin') || '');

		if (!pin) {
			return fail(400, { error: 'PIN required.' });
		}

		const sessionId = cookies.get('session_id');
		if (!sessionId) {
			throw redirect(303, '/login');
		}

		const db = locals.DB;
		const now = Math.floor(Date.now() / 1000);

		const session = await db.prepare(`
			SELECT id, user_id, device_id, expires_at, revoked_at
			FROM sessions
			WHERE id = ?
		`)
		.bind(sessionId)
		.first();

		if (!session || session.revoked_at !== null || session.expires_at < now) {
			throw redirect(303, '/login');
		}

		if (!session.device_id) {
			return fail(400, { error: 'No device registered for this session.' });
		}

		const device = await db.prepare(`
			SELECT pin_hash, revoked_at
			FROM devices
			WHERE id = ?
		`)
		.bind(session.device_id)
		.first();

		if (!device || device.revoked_at !== null) {
			return fail(400, { error: 'Device not available.' });
		}

		const pinHash = await sha256(pin);

		if (pinHash !== device.pin_hash) {
			return fail(400, { error: 'Invalid PIN.' });
		}

		await db.prepare(`
			UPDATE sessions
			SET last_seen_at = ?
			WHERE id = ?
		`)
		.bind(now, sessionId)
		.run();

		await db.prepare(`
			UPDATE devices
			SET last_seen_at = ?, updated_at = ?
			WHERE id = ?
		`)
		.bind(now, now, session.device_id)
		.run();

		// PIN unlock is a session cookie (clears when browser closes)
		cookies.set('pin_unlocked_at', '1', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: true
		});

		throw redirect(303, '/');
	}
};