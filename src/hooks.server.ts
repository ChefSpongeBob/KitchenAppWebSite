import { redirect, type Handle } from '@sveltejs/kit';
import { hashSessionToken } from '$lib/server/auth';

function setSessionCookies(event: Parameters<Handle>[0]['event'], sessionToken: string) {
	const secure = !event.url.hostname.includes('localhost');
	const maxAge = 60 * 60 * 24 * 30;
	event.cookies.set('session_id', sessionToken, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		maxAge
	});
	if (secure) {
		event.cookies.set('session_id_pwa', sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'none',
			secure: true,
			maxAge
		});
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.DB = event.platform?.env?.DB as App.Platform['env']['DB'];

	const { pathname } = event.url;
	const isAuthRoute =
		pathname.startsWith('/login') ||
		pathname.startsWith('/register') ||
		pathname.startsWith('/logout');
	const withAuthNoStore = async () => {
		const response = await resolve(event);
		response.headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
		response.headers.set('pragma', 'no-cache');
		response.headers.set('expires', '0');
		return response;
	};

	// Public routes
	if (
		isAuthRoute ||
		pathname.startsWith('/api/temps')
	) {
		return isAuthRoute ? withAuthNoStore() : resolve(event);
	}

	const db = event.locals.DB;
	const sessionTokenCandidates = Array.from(
		new Set([event.cookies.get('session_id'), event.cookies.get('session_id_pwa')].filter(Boolean))
	) as string[];

	if (!db || sessionTokenCandidates.length === 0) {
		throw redirect(303, '/login');
	}
	try {
		const now = Math.floor(Date.now() / 1000);
		let matched:
			| {
					token: string;
					session: {
						id: string;
						user_id: string;
						device_id: string | null;
						expires_at: number;
						revoked_at: number | null;
						session_token_hash: string;
					};
					user: { id: string; role: string | null };
			  }
			| null = null;

		for (const sessionToken of sessionTokenCandidates) {
			const sessionTokenHash = await hashSessionToken(sessionToken);

			const session = await db
				.prepare(
					`
				SELECT id, user_id, device_id, expires_at, revoked_at, session_token_hash
				FROM sessions
				WHERE session_token_hash = ?
				   OR session_token_hash = ?
				   OR id = ?
				LIMIT 1
			`
				)
				.bind(sessionTokenHash, sessionToken, sessionToken)
				.first<{
					id: string;
					user_id: string;
					device_id: string | null;
					expires_at: number;
					revoked_at: number | null;
					session_token_hash: string;
				}>();

			if (!session || session.revoked_at !== null || session.expires_at < now) {
				continue;
			}

			if (session.device_id) {
				const device = await db
					.prepare(
						`
					SELECT revoked_at
					FROM devices
					WHERE id = ?
				`
					)
					.bind(session.device_id)
					.first();

				if (!device || device.revoked_at !== null) {
					continue;
				}
			}

			const user = await db
				.prepare(
					`
				SELECT id, role
				FROM users
				WHERE id = ?
			`
				)
				.bind(session.user_id)
				.first<{ id: string; role: string | null }>();

			if (!user) {
				continue;
			}

			matched = { token: sessionToken, session, user };
			break;
		}

		if (!matched) {
			throw redirect(303, '/login?error=session');
		}

		// Upgrade legacy plaintext token storage to hashed token.
		if (matched.session.session_token_hash === matched.token) {
			const replacementToken = crypto.randomUUID();
			const replacementHash = await hashSessionToken(replacementToken);
			await db
				.prepare(
					`
				UPDATE sessions
				SET session_token_hash = ?, last_seen_at = ?
				WHERE id = ?
			`
				)
				.bind(replacementHash, now, matched.session.id)
				.run();
			setSessionCookies(event, replacementToken);
		} else {
			await db
				.prepare(
					`
				UPDATE sessions
				SET last_seen_at = ?
				WHERE id = ?
			`
				)
				.bind(now, matched.session.id)
				.run();

			// Keep both cookies synchronized to the known-good token to prevent stale-cookie loops.
			setSessionCookies(event, matched.token);
		}

		event.locals.userId = matched.user.id;
		event.locals.userRole = matched.user.role ?? 'user';

		return resolve(event);
	} catch {
		throw redirect(303, '/login?error=session');
	}
};
