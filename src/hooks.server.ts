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

	const sessionId = event.cookies.get('session_id');
	if (!sessionId) {
		throw redirect(303, '/login');
	}

	const db = event.locals.DB;
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

	// Enforce PIN freshness (1 hour)
	const pinUnlockedAt = event.cookies.get('pin_unlocked_at');
	const unlockedAt = pinUnlockedAt ? Number(pinUnlockedAt) : NaN;

	if (!Number.isFinite(unlockedAt) || now - unlockedAt > 3600) {
		throw redirect(303, '/pin');
	}

	// Admin protection
	if (
		if (pathname.startsWith('/recipes/manage')) {
	const user = await db.prepare(`
		SELECT role
		FROM users
		WHERE id = ?
	`)
	.bind(session.user_id)
	.first();

	if (!user || user.role !== 'admin') {
		throw redirect(303, '/');
	}
}
	) {
		const user = await db.prepare(`
			SELECT role
			FROM users
			WHERE id = ?
		`)
		.bind(session.user_id)
		.first();

		if (!user || user.role !== 'admin') {
			throw redirect(303, '/');
		}
	}

	return resolve(event);
};