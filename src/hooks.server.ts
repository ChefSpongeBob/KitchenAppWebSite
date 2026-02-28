import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.DB = event.platform?.env?.DB;

	const { pathname } = event.url;

	// Allow public routes
	if (
		pathname.startsWith('/login') ||
		pathname.startsWith('/register') ||
		pathname.startsWith('/pin')
	) {
		return resolve(event);
	}

	const db = event.locals.DB;
	const sessionId = event.cookies.get('session_id');

	if (!sessionId) {
		throw redirect(303, '/login');
	}

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

	// Validate device
	if (session.device_id) {
		const device = await db.prepare(`
			SELECT revoked_at
			FROM devices
			WHERE id = ?
		`)
		.bind(session.device_id)
		.first();

		if (!device || device.revoked_at !== null) {
			throw redirect(303, '/login');
		}
	}

	// Require PIN every browser session (no timer)
	const pinUnlocked = event.cookies.get('pin_unlocked_at');
	if (!pinUnlocked) {
		throw redirect(303, '/pin');
	}

	return resolve(event);
};