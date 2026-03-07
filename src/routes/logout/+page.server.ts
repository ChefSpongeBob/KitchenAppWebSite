import { redirect, type Actions } from '@sveltejs/kit';
import { hashSessionToken } from '$lib/server/auth';

export const actions: Actions = {
	default: async ({ cookies, locals }) => {
		const db = locals.DB;
		const sessionToken = cookies.get('session_id');

		if (sessionToken && db) {
			const now = Math.floor(Date.now() / 1000);
			const sessionTokenHash = await hashSessionToken(sessionToken);

			// Revoke session in DB
			await db.prepare(`
				UPDATE sessions
				SET revoked_at = ?
				WHERE session_token_hash = ?
				   OR session_token_hash = ?
				   OR id = ?
			`)
			.bind(now, sessionTokenHash, sessionToken, sessionToken)
			.run();
		}

		// Clear cookies
		cookies.delete('session_id', { path: '/' });

		throw redirect(303, '/login');
	}
};
