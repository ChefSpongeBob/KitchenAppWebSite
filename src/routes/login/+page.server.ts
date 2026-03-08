import { fail, isRedirect, redirect, type Actions } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { hashSessionToken, verifyPassword } from '$lib/server/auth';

async function hasEmailNormalizedColumn(db: App.Platform['env']['DB']) {
	const columns = await db.prepare(`PRAGMA table_info(users)`).all<{ name: string }>();
	return (columns.results ?? []).some((column) => column.name === 'email_normalized');
}

async function hasIsActiveColumn(db: App.Platform['env']['DB']) {
	const columns = await db.prepare(`PRAGMA table_info(users)`).all<{ name: string }>();
	return (columns.results ?? []).some((column) => column.name === 'is_active');
}

function setSessionCookies(
	cookies: Parameters<Actions['default']>[0]['cookies'],
	sessionToken: string,
	hostname: string
) {
	const maxAge = 60 * 60 * 24 * 30;
	const secure = !dev;
	const domains = new Set<string | undefined>([undefined]);
	if (secure && hostname.startsWith('www.') && hostname.split('.').length >= 3) {
		domains.add(hostname.slice(4));
	}

	for (const domain of domains) {
		cookies.set('session_id', sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure,
			maxAge,
			...(domain ? { domain } : {})
		});
	}

	// PWA/iOS fallback for standalone cookie handling quirks.
	if (secure) {
		for (const domain of domains) {
			cookies.set('session_id_pwa', sessionToken, {
				path: '/',
				httpOnly: true,
				sameSite: 'none',
				secure: true,
				maxAge,
				...(domain ? { domain } : {})
			});
		}
	}
}

export const actions: Actions = {
	default: async ({ request, cookies, locals, url }) => {
		try {
			const formData = await request.formData();

			const email = String(formData.get('email') || '').trim().toLowerCase();
			const password = String(formData.get('password') || '');

			if (!email || !password) {
				return fail(400, { error: 'Missing email or password.' });
			}

			const db = locals.DB;
			if (!db) {
				return fail(503, { error: 'Database is not configured yet.' });
			}

			const hasNormalized = await hasEmailNormalizedColumn(db);
			const hasIsActive = await hasIsActiveColumn(db);
			const user = hasNormalized
				? await db
						.prepare(
							`
			SELECT id, password_hash${hasIsActive ? ', is_active' : ''}
			FROM users
			WHERE email_normalized = ?
			`
						)
						.bind(email)
						.first<{ id: string; password_hash: string | null; is_active?: number | null }>()
				: await db
						.prepare(
							`
			SELECT id, password_hash${hasIsActive ? ', is_active' : ''}
			FROM users
			WHERE lower(email) = ?
			`
						)
						.bind(email)
						.first<{ id: string; password_hash: string | null; is_active?: number | null }>();

			if (!user) {
				return fail(400, { error: 'No account found for this email on this environment.' });
			}
			if (!user.password_hash) {
				return fail(400, { error: 'This account is missing password setup. Contact admin.' });
			}
			if (hasIsActive && user.is_active !== 1) {
				return fail(403, { error: 'Your account is pending admin approval.' });
			}

			const passwordCheck = await verifyPassword(password, user.password_hash);
			if (!passwordCheck.valid) {
				return fail(400, { error: 'Password did not match. Check for typos or autofill.' });
			}

			const now = Math.floor(Date.now() / 1000);
			const expires = now + 60 * 60 * 24 * 30;

			const sessionId = crypto.randomUUID();
			const sessionToken = crypto.randomUUID();
			const sessionTokenHash = await hashSessionToken(sessionToken);

			// Try to reuse existing active device
			let device = await db
				.prepare(
					`
			SELECT id
			FROM devices
			WHERE user_id = ?
			AND revoked_at IS NULL
			LIMIT 1
		`
				)
				.bind(user.id)
				.first();

			let deviceId = device?.id;

			// If no device exists yet, create one
			if (!deviceId) {
				deviceId = crypto.randomUUID();

				await db
					.prepare(
						`
				INSERT INTO devices (
					id,
					user_id,
					pin_hash,
					created_at,
					updated_at
				)
				VALUES (?, ?, ?, ?, ?)
			`
					)
					.bind(deviceId, user.id, '', now, now)
					.run();
			}

			// Create session attached to device
			await db
				.prepare(
					`
			INSERT INTO sessions (
				id,
				user_id,
				device_id,
				session_token_hash,
				created_at,
				last_seen_at,
				expires_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`
				)
				.bind(sessionId, user.id, deviceId, sessionTokenHash, now, now, expires)
				.run();

			if (passwordCheck.needsRehash && passwordCheck.upgradedHash) {
				await db
					.prepare(
						`
				UPDATE users
				SET password_hash = ?, updated_at = ?
				WHERE id = ?
			`
					)
					.bind(passwordCheck.upgradedHash, now, user.id)
					.run();
			}

			setSessionCookies(cookies, sessionToken, url.hostname);

			throw redirect(303, '/?auth=1');
		} catch (err) {
			if (isRedirect(err)) {
				throw err;
			}
			const message = err instanceof Error ? err.message : String(err ?? '');
			console.error('Login action failed:', message);
			if (message.includes('D1_ERROR: no such table')) {
				return fail(503, { error: 'Database tables are not ready yet.' });
			}
			return fail(500, { error: 'Login failed. Please try again.' });
		}
	}
};
