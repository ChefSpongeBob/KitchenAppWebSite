import { redirect, type Actions } from '@sveltejs/kit';
import { hashSessionToken } from '$lib/server/auth';
import { getSessionCookieDeleteOptions, getSessionCookieName } from '$lib/server/authCookies';

export const actions: Actions = {
	default: async ({ cookies, locals, request }) => {
		const db = locals.DB;
		const primaryCookie = getSessionCookieName();
		const sessionToken =
			cookies.get(primaryCookie) ?? cookies.get('session_id') ?? cookies.get('session_id_pwa');

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
		cookies.delete(primaryCookie, getSessionCookieDeleteOptions(request));
		cookies.delete('session_id', { path: '/' });
		cookies.delete('session_id_pwa', { path: '/' });

		throw redirect(303, '/login');
	}
};
