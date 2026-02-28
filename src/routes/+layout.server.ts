import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const db = locals.DB;
	const sessionId = cookies.get('session_id');

	if (!sessionId || !db) {
		return { user: null };
	}

	const now = Math.floor(Date.now() / 1000);

	const session = await db.prepare(`
		SELECT user_id, expires_at, revoked_at
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
		return { user: null };
	}

	const user = await db.prepare(`
		SELECT id, role
		FROM users
		WHERE id = ?
	`)
		.bind(session.user_id)
		.first();

	return {
		user: user || null
	};
};