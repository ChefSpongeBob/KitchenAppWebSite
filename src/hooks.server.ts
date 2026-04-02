import { redirect, type Handle } from '@sveltejs/kit';
import { hashSessionToken } from '$lib/server/auth';
import {
	getSessionCookieDeleteOptions,
	getSessionCookieName,
	getSessionCookieOptions
} from '$lib/server/authCookies';

function setSessionCookies(event: Parameters<Handle>[0]['event'], sessionToken: string) {
	const cookieName = getSessionCookieName();
	event.cookies.set(cookieName, sessionToken, getSessionCookieOptions(event.request));
	event.cookies.delete('session_id', { path: '/' });
	event.cookies.delete('session_id_pwa', { path: '/' });
}

function clearSessionCookies(event: Parameters<Handle>[0]['event']) {
	const cookieName = getSessionCookieName();
	const deleteOptions = getSessionCookieDeleteOptions(event.request);
	event.cookies.delete(cookieName, deleteOptions);
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
		pathname.startsWith('/api/temps') ||
		pathname.startsWith('/api/camera/upload') ||
		pathname.startsWith('/api/camera/activity')
	) {
		return isAuthRoute ? resolveWithNoStore() : resolve(event);
	}

	const db = event.locals.DB;
	const primaryCookie = getSessionCookieName();
	const sessionToken =
		event.cookies.get(primaryCookie) ??
		event.cookies.get('session_id') ??
		event.cookies.get('session_id_pwa');

	if (!db || !sessionToken) {
		clearSessionCookies(event);
		throw redirect(303, '/login');
	}
	try {
		const now = Math.floor(Date.now() / 1000);
		const sessionTokenHash = await hashSessionToken(sessionToken);
		const session = await db
			.prepare(
				`
			SELECT
				s.id,
				s.user_id,
				s.device_id,
				s.expires_at,
				s.revoked_at,
				s.session_token_hash,
				s.last_seen_at,
				d.id AS found_device_id,
				d.revoked_at AS device_revoked_at,
				u.id AS found_user_id,
				u.role AS user_role,
				COALESCE(u.is_active, 1) AS user_is_active
			FROM sessions s
			LEFT JOIN devices d ON d.id = s.device_id
			LEFT JOIN users u ON u.id = s.user_id
			WHERE s.session_token_hash = ?
			   OR s.session_token_hash = ?
			   OR s.id = ?
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
				last_seen_at: number;
				found_device_id: string | null;
				device_revoked_at: number | null;
				found_user_id: string | null;
				user_role: string | null;
				user_is_active: number;
			}>();

		if (!session || session.revoked_at !== null || session.expires_at < now) {
			clearSessionCookies(event);
			throw redirect(303, '/login?error=session');
		}

		if (session.device_id && (!session.found_device_id || session.device_revoked_at !== null)) {
			clearSessionCookies(event);
			throw redirect(303, '/login?error=session');
		}
		if (!session.found_user_id) {
			clearSessionCookies(event);
			throw redirect(303, '/login?error=session');
		}
		if (session.user_is_active !== 1) {
			clearSessionCookies(event);
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
			// Throttle session touch writes so high page traffic does not write on every request.
			if (now - (session.last_seen_at ?? 0) >= 300) {
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

			// Normalize to a single canonical cookie key only when legacy key was used.
			if (!event.cookies.get(primaryCookie)) {
				setSessionCookies(event, sessionToken);
			}
		}

		event.locals.userId = session.found_user_id;
		event.locals.userRole = session.user_role ?? 'user';

		return resolveWithNoStore();
	} catch {
		clearSessionCookies(event);
		throw redirect(303, '/login?error=session');
	}
};
