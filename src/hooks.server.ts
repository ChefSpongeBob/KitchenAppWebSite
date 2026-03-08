import { redirect, type Handle } from '@sveltejs/kit';
import { hashSessionToken } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.DB = event.platform?.env?.DB as App.Platform['env']['DB'];

	const { pathname } = event.url;

	// Public routes
	if (
		pathname.startsWith('/login') ||
		pathname.startsWith('/register') ||
		pathname.startsWith('/api/temps')
	) {
		return resolve(event);
	}

	const db = event.locals.DB;
	const sessionToken = event.cookies.get('session_id') ?? event.cookies.get('session_id_pwa');

	if (!db || !sessionToken) {
		throw redirect(303, '/login');
	}
	try {
		const sessionTokenHash = await hashSessionToken(sessionToken);
		const now = Math.floor(Date.now() / 1000);

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
			throw redirect(303, '/login?error=session');
		}

		// Validate device
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
				throw redirect(303, '/login?error=session');
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
			throw redirect(303, '/login?error=session');
		}

		// Upgrade legacy plaintext token storage to hashed token.
		if (session.session_token_hash === sessionToken) {
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
				.bind(replacementHash, now, session.id)
				.run();

			const secure = !event.url.hostname.includes('localhost');
			const maxAge = 60 * 60 * 24 * 30;
			event.cookies.set('session_id', replacementToken, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure,
				maxAge
			});
			if (secure) {
				event.cookies.set('session_id_pwa', replacementToken, {
					path: '/',
					httpOnly: true,
					sameSite: 'none',
					secure: true,
					maxAge
				});
			}
		} else {
			await db
				.prepare(
					`
				UPDATE sessions
				SET last_seen_at = ?
				WHERE id = ?
			`
				)
				.bind(now, session.id)
				.run();
		}

		event.locals.userId = user.id;
		event.locals.userRole = user.role ?? 'user';

		return resolve(event);
	} catch {
		throw redirect(303, '/login?error=session');
	}
};
