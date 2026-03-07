import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

async function ensureUserPreferencesTable(db: App.Platform['env']['DB']) {
	await db
		.prepare(
			`
			CREATE TABLE IF NOT EXISTS user_preferences (
				user_id TEXT PRIMARY KEY,
				email_updates INTEGER NOT NULL DEFAULT 1,
				updated_at INTEGER NOT NULL,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			)
		`
		)
		.run();
}

async function hasEmailNormalizedColumn(db: App.Platform['env']['DB']) {
	const columns = await db.prepare(`PRAGMA table_info(users)`).all<{ name: string }>();
	return (columns.results ?? []).some((column) => column.name === 'email_normalized');
}

export const load: PageServerLoad = async ({ locals }) => {
	// hooks enforces auth; but guard anyway
	if (!locals.userId) throw redirect(303, '/login');

	const db = locals.DB;
	await ensureUserPreferencesTable(db);

	const user = await db
		.prepare(
			`
			SELECT
				u.display_name,
				u.email,
				COALESCE(p.email_updates, 1) AS email_updates
			FROM users
			LEFT JOIN user_preferences p ON p.user_id = u.id
			WHERE u.id = ?
		`
		)
		.bind(locals.userId)
		.first<{ display_name: string | null; email: string | null; email_updates: number }>();

	return {
		display_name: user?.display_name ?? '',
		email: user?.email ?? '',
		email_updates: (user?.email_updates ?? 1) === 1
	};
};

export const actions: Actions = {
	save_username: async ({ request, locals }) => {
		if (!locals.userId) throw redirect(303, '/login');

		const formData = await request.formData();
		const displayName = String(formData.get('display_name') || '').trim();

		if (!displayName) {
			return fail(400, { error: 'Username is required.' });
		}

		const db = locals.DB;
		const now = Math.floor(Date.now() / 1000);

		await db
			.prepare(
				`
			UPDATE users
			SET display_name = ?, updated_at = ?
			WHERE id = ?
		`
			)
			.bind(displayName, now, locals.userId)
			.run();

		return { success: true };
	},

	save_profile: async ({ request, locals }) => {
		if (!locals.userId) throw redirect(303, '/login');

		const formData = await request.formData();
		const displayName = String(formData.get('display_name') || '').trim();
		const email = String(formData.get('email') || '').trim().toLowerCase();
		const wantsEmailUpdates = String(formData.get('email_updates') || '0') === '1';

		if (!displayName) {
			return fail(400, { error: 'Username is required.' });
		}
		if (!email) {
			return fail(400, { error: 'Email is required.' });
		}

		const db = locals.DB;
		const now = Math.floor(Date.now() / 1000);

		const hasNormalized = await hasEmailNormalizedColumn(db);
		const duplicate = hasNormalized
			? await db
					.prepare(
						`
				SELECT id FROM users
				WHERE email_normalized = ? AND id != ?
				LIMIT 1
			`
					)
					.bind(email, locals.userId)
					.first<{ id: string }>()
			: await db
					.prepare(
						`
				SELECT id FROM users
				WHERE lower(email) = ? AND id != ?
				LIMIT 1
			`
					)
					.bind(email, locals.userId)
					.first<{ id: string }>();

		if (duplicate) {
			return fail(400, { error: 'Email already in use.' });
		}

		if (hasNormalized) {
			await db
				.prepare(
					`
				UPDATE users
				SET display_name = ?, email = ?, email_normalized = ?, updated_at = ?
				WHERE id = ?
			`
				)
				.bind(displayName, email, email, now, locals.userId)
				.run();
		} else {
			await db
				.prepare(
					`
				UPDATE users
				SET display_name = ?, email = ?, updated_at = ?
				WHERE id = ?
			`
				)
				.bind(displayName, email, now, locals.userId)
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
			.bind(locals.userId, wantsEmailUpdates ? 1 : 0, now)
			.run();

		return { success: true };
	}
};
