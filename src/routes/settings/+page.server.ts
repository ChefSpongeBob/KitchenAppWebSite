import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

async function ensureUserPreferencesTable(db: App.Platform['env']['DB']) {
	try {
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
	} catch (error) {
		console.error('Failed to ensure user_preferences table:', error);
	}
}

async function getUsersColumns(db: App.Platform['env']['DB']) {
	const columns = await db.prepare(`PRAGMA table_info(users)`).all<{ name: string }>();
	return new Set((columns.results ?? []).map((column) => column.name));
}

async function hasUserPreferencesEmailUpdatesColumn(db: App.Platform['env']['DB']) {
	const table = await db
		.prepare(
			`
			SELECT name
			FROM sqlite_master
			WHERE type = 'table' AND name = 'user_preferences'
			LIMIT 1
		`
		)
		.first<{ name: string }>();
	if (!table) return false;

	const columns = await db.prepare(`PRAGMA table_info(user_preferences)`).all<{ name: string }>();
	return (columns.results ?? []).some((column) => column.name === 'email_updates');
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.userId) throw redirect(303, '/login');
	const db = locals.DB;
	if (!db) throw redirect(303, '/login');

	await ensureUserPreferencesTable(db);

	let displayName = '';
	let email = '';
	try {
		const userColumns = await getUsersColumns(db);
		const displayNameExpr = userColumns.has('display_name')
			? 'display_name AS display_name'
			: userColumns.has('username')
				? 'username AS display_name'
				: `'' AS display_name`;
		const emailExpr = userColumns.has('email') ? 'email AS email' : `'' AS email`;

		const user = await db
			.prepare(
				`
				SELECT ${displayNameExpr}, ${emailExpr}
				FROM users
				WHERE id = ?
				LIMIT 1
			`
			)
			.bind(locals.userId)
			.first<{ display_name: string | null; email: string | null }>();

		displayName = user?.display_name ?? '';
		email = user?.email ?? '';
	} catch (error) {
		console.error('Settings load user query failed:', error);
	}

	let emailUpdates = true;
	try {
		if (await hasUserPreferencesEmailUpdatesColumn(db)) {
			const prefs = await db
				.prepare(
					`
					SELECT email_updates
					FROM user_preferences
					WHERE user_id = ?
					LIMIT 1
				`
				)
				.bind(locals.userId)
				.first<{ email_updates: number }>();
			emailUpdates = (prefs?.email_updates ?? 1) === 1;
		}
	} catch (error) {
		console.error('Settings load preferences query failed:', error);
	}

	return {
		display_name: displayName,
		email,
		email_updates: emailUpdates
	};
};

export const actions: Actions = {
	save_username: async ({ request, locals }) => {
		if (!locals.userId) throw redirect(303, '/login');
		const db = locals.DB;
		if (!db) throw redirect(303, '/login');

		const formData = await request.formData();
		const displayName = String(formData.get('display_name') || '').trim();
		if (!displayName) return fail(400, { error: 'Username is required.' });

		const userColumns = await getUsersColumns(db);
		const nameColumn = userColumns.has('display_name')
			? 'display_name'
			: userColumns.has('username')
				? 'username'
				: null;
		if (!nameColumn) return fail(400, { error: 'User name column missing in DB schema.' });

		const now = Math.floor(Date.now() / 1000);
		if (userColumns.has('updated_at')) {
			await db
				.prepare(`UPDATE users SET ${nameColumn} = ?, updated_at = ? WHERE id = ?`)
				.bind(displayName, now, locals.userId)
				.run();
		} else {
			await db
				.prepare(`UPDATE users SET ${nameColumn} = ? WHERE id = ?`)
				.bind(displayName, locals.userId)
				.run();
		}

		return { success: true };
	},

	save_profile: async ({ request, locals }) => {
		if (!locals.userId) throw redirect(303, '/login');
		const db = locals.DB;
		if (!db) throw redirect(303, '/login');

		const formData = await request.formData();
		const displayName = String(formData.get('display_name') || '').trim();
		const email = String(formData.get('email') || '').trim().toLowerCase();
		const wantsEmailUpdates = String(formData.get('email_updates') || '0') === '1';

		if (!displayName) return fail(400, { error: 'Username is required.' });

		const userColumns = await getUsersColumns(db);
		const nameColumn = userColumns.has('display_name')
			? 'display_name'
			: userColumns.has('username')
				? 'username'
				: null;
		if (!nameColumn) return fail(400, { error: 'User name column missing in DB schema.' });

		const hasEmail = userColumns.has('email');
		const hasEmailNormalized = userColumns.has('email_normalized');
		const now = Math.floor(Date.now() / 1000);

		if (hasEmail) {
			if (!email) return fail(400, { error: 'Email is required.' });

			const duplicate = hasEmailNormalized
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
			if (duplicate) return fail(400, { error: 'Email already in use.' });
		}

		const assignments: string[] = [`${nameColumn} = ?`];
		const params: Array<string | number> = [displayName];
		if (hasEmail) {
			assignments.push(`email = ?`);
			params.push(email);
		}
		if (hasEmail && hasEmailNormalized) {
			assignments.push(`email_normalized = ?`);
			params.push(email);
		}
		if (userColumns.has('updated_at')) {
			assignments.push(`updated_at = ?`);
			params.push(now);
		}
		params.push(locals.userId);

		await db
			.prepare(`UPDATE users SET ${assignments.join(', ')} WHERE id = ?`)
			.bind(...params)
			.run();

		await ensureUserPreferencesTable(db);
		if (await hasUserPreferencesEmailUpdatesColumn(db)) {
			await db
				.prepare(
					`
					INSERT OR REPLACE INTO user_preferences (user_id, email_updates, updated_at)
					VALUES (?, ?, ?)
				`
				)
				.bind(locals.userId, wantsEmailUpdates ? 1 : 0, now)
				.run();
		}

		return { success: true };
	}
};
