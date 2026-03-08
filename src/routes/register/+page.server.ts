import { fail, isRedirect, redirect, type Actions } from '@sveltejs/kit';
import { hashPassword } from '$lib/server/auth';

async function hasEmailNormalizedColumn(db: App.Platform['env']['DB']) {
	const columns = await db.prepare(`PRAGMA table_info(users)`).all<{ name: string }>();
	return (columns.results ?? []).some((column) => column.name === 'email_normalized');
}

async function hasIsActiveColumn(db: App.Platform['env']['DB']) {
	const columns = await db.prepare(`PRAGMA table_info(users)`).all<{ name: string }>();
	return (columns.results ?? []).some((column) => column.name === 'is_active');
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

export const actions: Actions = {
	default: async ({ request, locals }) => {
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
			const hasIsActive = await hasIsActiveColumn(db);
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
			const passwordHash = await hashPassword(password);

			if (hasNormalized) {
				const sql = hasIsActive
					? `
			INSERT INTO users (
				id,
				email,
				email_normalized,
				password_hash,
				display_name,
				is_active,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, 0, ?, ?)
		`
					: `
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
		`;
				const stmt = db.prepare(sql);
				if (hasIsActive) {
					await stmt.bind(userId, email, email, passwordHash, displayName, now, now).run();
				} else {
					await stmt.bind(userId, email, email, passwordHash, displayName, now, now).run();
				}
			} else {
				const sql = hasIsActive
					? `
			INSERT INTO users (
				id,
				email,
				password_hash,
				display_name,
				is_active,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, 0, ?, ?)
		`
					: `
			INSERT INTO users (
				id,
				email,
				password_hash,
				display_name,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?)
		`;
				const stmt = db.prepare(sql);
				if (hasIsActive) {
					await stmt.bind(userId, email, passwordHash, displayName, now, now).run();
				} else {
					await stmt.bind(userId, email, passwordHash, displayName, now, now).run();
				}
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

			throw redirect(303, '/login?registered=pending');
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
