import { fail, isRedirect, redirect, type Actions } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { hashPassword, hashSessionToken } from '$lib/server/auth';

async function hasEmailNormalizedColumn(db: App.Platform['env']['DB']) {
	const columns = await db.prepare(`PRAGMA table_info(users)`).all<{ name: string }>();
	return (columns.results ?? []).some((column) => column.name === 'email_normalized');
}

async function ensureUserPreferencesTable(db: App.Platform['env']['DB']) {
	await db.prepare(`
		CREATE TABLE IF NOT EXISTS user_preferences (
			user_id TEXT PRIMARY KEY,
			email_updates INTEGER NOT NULL DEFAULT 1,
			updated_at INTEGER NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`).run();
}

function setSessionCookies(
	cookies: Parameters<Actions['default']>[0]['cookies'],
	sessionToken: string
) {
	const maxAge = 60 * 60 * 24 * 30;
	const secure = !dev;
	cookies.set('session_id', sessionToken, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		maxAge
	});

	if (secure) {
		cookies.set('session_id_pwa', sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'none',
			secure: true,
			maxAge
		});
	}
}

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		try {
			const formData = await request.formData();

			const displayName = String(formData.get('display_name') || '').trim();
			const email = String(formData.get('email') || '').trim().toLowerCase();
			const confirmEmail = String(formData.get('confirm_email') || '').trim().toLowerCase();
			const password = String(formData.get('password') || '');
			const confirmPassword = String(formData.get('confirm_password') || '');
			const wantsEmailUpdates = String(formData.get('email_updates') || '0') === '1';

			if (!displayName || !email || !confirmEmail || !password || !confirmPassword) {
				return fail(400, { error: 'All fields required.' });
			}
			if (email !== confirmEmail) {
				return fail(400, { error: 'Emails do not match.' });
			}
			if (password.length < 8) {
				return fail(400, { error: 'Password must be at least 8 characters.' });
			}
			if (password !== confirmPassword) {
				return fail(400, { error: 'Passwords do not match.' });
			}

			const db = locals.DB;
			if (!db) {
				return fail(503, { error: 'Database is not configured yet.' });
			}

			const hasNormalized = await hasEmailNormalizedColumn(db);
			const existing = hasNormalized
				? await db
						.prepare(
							`
			SELECT id FROM users
			WHERE email_normalized = ?
		`
						)
						.bind(email)
						.first()
				: await db
						.prepare(
							`
			SELECT id FROM users
			WHERE lower(email) = ?
		`
						)
						.bind(email)
						.first();

			if (existing) {
				return fail(400, { error: 'Account already exists.' });
			}

			const now = Math.floor(Date.now() / 1000);

			const userId = crypto.randomUUID();
			const deviceId = crypto.randomUUID();
			const sessionId = crypto.randomUUID();
			const sessionToken = crypto.randomUUID();
			const sessionTokenHash = await hashSessionToken(sessionToken);
			const passwordHash = await hashPassword(password);

			if (hasNormalized) {
				await db
					.prepare(`
			INSERT INTO users (
				id,
				email,
				email_normalized,
				password_hash,
				display_name,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`)
					.bind(userId, email, email, passwordHash, displayName, now, now)
					.run();
			} else {
				await db
					.prepare(`
			INSERT INTO users (
				id,
				email,
				password_hash,
				display_name,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?)
		`)
					.bind(userId, email, passwordHash, displayName, now, now)
					.run();
			}

			await ensureUserPreferencesTable(db);
			await db
				.prepare(
					`
			INSERT OR REPLACE INTO user_preferences (user_id, email_updates, updated_at)
			VALUES (?, ?, ?)
		`
				)
				.bind(userId, wantsEmailUpdates ? 1 : 0, now)
				.run();

			await db.prepare(`
			INSERT INTO devices (
				id,
				user_id,
				pin_hash,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?)
		`)
				.bind(deviceId, userId, '', now, now)
				.run();

			await db.prepare(`
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
		`)
				.bind(
					sessionId,
					userId,
					deviceId,
					sessionTokenHash,
					now,
					now,
					now + 60 * 60 * 24 * 30
				)
				.run();

			setSessionCookies(cookies, sessionToken);

			throw redirect(303, '/');
		} catch (err) {
			if (isRedirect(err)) {
				throw err;
			}
			const message = err instanceof Error ? err.message : String(err ?? '');
			console.error('Register action failed:', message);
			if (message.includes('UNIQUE constraint failed')) {
				return fail(400, { error: 'Account already exists.' });
			}
			if (message.includes('D1_ERROR: no such table')) {
				return fail(503, { error: 'Database tables are not ready yet.' });
			}
			return fail(500, { error: 'Registration failed. Please try again.' });
		}
	}
};
