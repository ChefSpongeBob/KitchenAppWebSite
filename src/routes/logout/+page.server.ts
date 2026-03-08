import { redirect, type Actions } from '@sveltejs/kit';
import { hashSessionToken } from '$lib/server/auth';

export const actions: Actions = {
	default: async ({ cookies, locals, url }) => {
		const db = locals.DB;
		const sessionToken = cookies.get('session_id') ?? cookies.get('session_id_pwa');

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
		const secure = !url.hostname.includes('localhost');
		const domains = new Set<string | undefined>([undefined]);
		if (secure && url.hostname.startsWith('www.') && url.hostname.split('.').length >= 3) {
			domains.add(url.hostname.slice(4));
		}
		for (const domain of domains) {
			cookies.delete('session_id', { path: '/', ...(domain ? { domain } : {}) });
			cookies.delete('session_id_pwa', { path: '/', ...(domain ? { domain } : {}) });
		}

		throw redirect(303, '/login');
	}
};
