import { redirect, type Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { hashSessionToken } from '$lib/server/auth';

function setSessionCookies(event: Parameters<Handle>[0]['event'], sessionToken: string) {
	const secure = !event.url.hostname.includes('localhost');
	const maxAge = 60 * 60 * 24 * 30;
	const cookieName = dev ? 'kitchen_session' : '__Host-kitchen_session';
	event.cookies.set(cookieName, sessionToken, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		maxAge
	});
	event.cookies.delete('session_id', { path: '/' });
	event.cookies.delete('session_id_pwa', { path: '/' });
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.DB = event.platform?.env?.DB as App.Platform['env']['DB'];

	const { pathname } = event.url;
	const isAuthRoute =
		pathname.startsWith('/login') ||
		pathname.startsWith('/register') ||
		pathname.startsWith('/logout');
	const resolveWithNoStore = async () => {
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
		return isAuthRoute ? resolveWithNoStore() : resolve(event);
	}

	const db = event.locals.DB;
	const primaryCookie = dev ? 'kitchen_session' : '__Host-kitchen_session';
	const sessionToken =
		event.cookies.get(primaryCookie) ??
		event.cookies.get('session_id') ??
		event.cookies.get('session_id_pwa');

	if (!db || !sessionToken) {
		throw redirect(303, '/login');
	}
	try {
		const now = Math.floor(Date.now() / 1000);
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
			throw redirect(303, '/login?error=session');
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
				.bind(now, session.id)
				.run();

			// Normalize to a single canonical cookie key only when legacy key was used.
			if (!event.cookies.get(primaryCookie)) {
				setSessionCookies(event, sessionToken);
			}
		}

		event.locals.userId = user.id;
		event.locals.userRole = user.role ?? 'user';

		return resolveWithNoStore();
	} catch {
		throw redirect(303, '/login?error=session');
	}
};
