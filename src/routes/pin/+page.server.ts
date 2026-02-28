import { fail, redirect, type Actions } from '@sveltejs/kit';
import { createHash } from 'crypto';

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

		if (
			!session ||
			session.revoked_at !== null ||
			session.expires_at < now
		) {
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

		const pinHash = createHash('sha256')
			.update(pin)
			.digest('hex');

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