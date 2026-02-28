import { redirect, type Actions } from '@sveltejs/kit';

export const actions: Actions = {
	default: async ({ cookies, locals }) => {
		const db = locals.DB;
		const sessionId = cookies.get('session_id');

		if (sessionId && db) {
			const now = Math.floor(Date.now() / 1000);

			// Revoke session in DB
			await db.prepare(`
				UPDATE sessions
				SET revoked_at = ?
				WHERE id = ?
			`)
			.bind(now, sessionId)
			.run();
		}

		// Clear cookies
		cookies.delete('session_id', { path: '/' });
		cookies.delete('pin_unlocked_at', { path: '/' });

		throw redirect(303, '/login');
	}
};