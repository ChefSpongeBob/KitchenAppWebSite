import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';

type TodoRow = {
	id: string;
	title: string;
	description: string | null;
	created_at?: number;
	completed_at?: number | null;
	display_name?: string | null;
	assigned_to?: string | null;
	assigned_name?: string | null;
	assigned_email?: string | null;
};

type UserRow = {
	id: string;
	display_name: string | null;
	email: string;
	is_active?: number;
};

async function tableExists(db: App.Platform['env']['DB'], tableName: string) {
	const row = await db
		.prepare(
			`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
      LIMIT 1
    `
		)
		.bind(tableName)
		.first<{ name: string }>();
	return Boolean(row);
}

async function usersHasIsActiveColumn(db: App.Platform['env']['DB']) {
	const columns = await db.prepare(`PRAGMA table_info(users)`).all<{ name: string }>();
	return (columns.results ?? []).some((column) => column.name === 'is_active');
}

export const load: PageServerLoad = async ({ locals }) => {
	const db = locals.DB;
	if (!db) {
		return { active: [], completed: [], users: [], canManageAssignments: false };
	}
	const now = Math.floor(Date.now() / 1000);
	const isAdmin = locals.userRole === 'admin';
	const hasAssignmentsTable = await tableExists(db, 'todo_assignments');

	// LAZY CLEANUP (delete completed todos older than 3 days)
	const threeDaysAgo = now - 60 * 60 * 24 * 3;

	await db.prepare(`
		DELETE FROM todos
		WHERE completed_at IS NOT NULL
		AND completed_at < ?
	`)
	.bind(threeDaysAgo)
	.run();

	const active = hasAssignmentsTable
		? await db
				.prepare(
					`
          SELECT
            t.id,
            t.title,
            t.description,
            t.created_at,
            ta.user_id AS assigned_to,
            au.display_name AS assigned_name,
            au.email AS assigned_email
          FROM todos t
          LEFT JOIN todo_assignments ta ON ta.todo_id = t.id
          LEFT JOIN users au ON au.id = ta.user_id
          WHERE t.completed_at IS NULL
            AND (? = 1 OR ta.user_id = ? OR ta.user_id IS NULL)
          ORDER BY t.created_at DESC
        `
				)
				.bind(isAdmin ? 1 : 0, locals.userId ?? '')
				.all<TodoRow>()
		: await db
				.prepare(
					`
          SELECT
            t.id,
            t.title,
            t.description,
            t.created_at,
            NULL AS assigned_to,
            NULL AS assigned_name,
            NULL AS assigned_email
          FROM todos t
          WHERE t.completed_at IS NULL
          ORDER BY t.created_at DESC
        `
				)
				.all<TodoRow>();

	const completed = hasAssignmentsTable
		? await db
				.prepare(
					`
          SELECT
            t.id,
            t.title,
            t.description,
            t.completed_at,
            u.display_name,
            ta.user_id AS assigned_to,
            au.display_name AS assigned_name,
            au.email AS assigned_email
          FROM todos t
          LEFT JOIN users u ON u.id = t.completed_by
          LEFT JOIN todo_assignments ta ON ta.todo_id = t.id
          LEFT JOIN users au ON au.id = ta.user_id
          WHERE t.completed_at IS NOT NULL
            AND (? = 1 OR ta.user_id = ? OR ta.user_id IS NULL)
          ORDER BY t.completed_at DESC
        `
				)
				.bind(isAdmin ? 1 : 0, locals.userId ?? '')
				.all<TodoRow>()
		: await db
				.prepare(
					`
          SELECT
            t.id,
            t.title,
            t.description,
            t.completed_at,
            u.display_name,
            NULL AS assigned_to,
            NULL AS assigned_name,
            NULL AS assigned_email
          FROM todos t
          LEFT JOIN users u ON u.id = t.completed_by
          WHERE t.completed_at IS NOT NULL
          ORDER BY t.completed_at DESC
        `
				)
				.all<TodoRow>();

	const hasIsActive = isAdmin ? await usersHasIsActiveColumn(db) : false;
	const users = isAdmin
		? hasIsActive
			? await db
					.prepare(
						`
            SELECT id, display_name, email, COALESCE(is_active, 1) AS is_active
            FROM users
            WHERE COALESCE(is_active, 1) = 1
            ORDER BY COALESCE(display_name, email) ASC
          `
					)
					.all<UserRow>()
			: await db
					.prepare(
						`
            SELECT id, display_name, email, 1 AS is_active
            FROM users
            ORDER BY COALESCE(display_name, email) ASC
          `
					)
					.all<UserRow>()
		: { results: [] as UserRow[] };

	return {
		active: active.results ?? [],
		completed: completed.results ?? [],
		users: users.results ?? [],
		canManageAssignments: isAdmin && hasAssignmentsTable
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (locals.userRole !== 'admin') {
			throw redirect(303, '/');
		}

		const db = locals.DB;
		if (!db) return fail(503, { error: 'Database not configured.' });
		const formData = await request.formData();
		const title = String(formData.get('title') || '').trim();
		const description = String(formData.get('description') || '').trim();
		const assignedTo = String(formData.get('assigned_to') ?? '').trim();

		if (!title) {
			return fail(400, { error: 'Title required' });
		}

		const now = Math.floor(Date.now() / 1000);
		const todoId = crypto.randomUUID();

		await db
			.prepare(`
			INSERT INTO todos (
				id, title, description,
				created_by,
				created_at, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?)
		`)
			.bind(todoId, title, description, locals.userId, now, now)
			.run();

		if (assignedTo) {
			const hasAssignmentsTable = await tableExists(db, 'todo_assignments');
			if (!hasAssignmentsTable) return fail(400, { error: 'Todo assignments table missing.' });
			const assignee = await db.prepare(`SELECT id FROM users WHERE id = ? LIMIT 1`).bind(assignedTo).first<{ id: string }>();
			if (!assignee) return fail(400, { error: 'Invalid assigned user.' });

			await db
				.prepare(
					`
            INSERT OR REPLACE INTO todo_assignments (todo_id, user_id, assigned_at)
            VALUES (?, ?, ?)
          `
				)
				.bind(todoId, assignedTo, now)
				.run();
		}

		return { success: true };
	},

	assign: async ({ request, locals }) => {
		if (locals.userRole !== 'admin') {
			throw redirect(303, '/');
		}

		const db = locals.DB;
		if (!db) return fail(503, { error: 'Database not configured.' });
		if (!(await tableExists(db, 'todo_assignments'))) {
			return fail(400, { error: 'Todo assignments table missing.' });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const assignedTo = String(formData.get('assigned_to') ?? '').trim();
		if (!id) return fail(400, { error: 'Missing todo id.' });

		const todo = await db.prepare(`SELECT id FROM todos WHERE id = ? LIMIT 1`).bind(id).first<{ id: string }>();
		if (!todo) return fail(404, { error: 'Todo not found.' });

		if (!assignedTo) {
			await db.prepare(`DELETE FROM todo_assignments WHERE todo_id = ?`).bind(id).run();
			return { success: true };
		}

		const assignee = await db.prepare(`SELECT id FROM users WHERE id = ? LIMIT 1`).bind(assignedTo).first<{ id: string }>();
		if (!assignee) return fail(400, { error: 'Assigned user not found.' });

		await db
			.prepare(
				`
          INSERT OR REPLACE INTO todo_assignments (todo_id, user_id, assigned_at)
          VALUES (?, ?, ?)
        `
			)
			.bind(id, assignedTo, Math.floor(Date.now() / 1000))
			.run();

		return { success: true };
	},

	complete: async ({ request, locals }) => {
		const db = locals.DB;
		if (!db) return fail(503, { error: 'Database not configured.' });
		const formData = await request.formData();
		const id = String(formData.get('id') || '');

		if (!id) return fail(400);

		const now = Math.floor(Date.now() / 1000);
		const hasAssignmentsTable = await tableExists(db, 'todo_assignments');

		const todo = hasAssignmentsTable
			? await db
					.prepare(`
			SELECT
				t.id,
				t.title,
				ta.user_id AS assigned_to
			FROM todos t
			LEFT JOIN todo_assignments ta ON ta.todo_id = t.id
			WHERE t.id = ? AND t.completed_at IS NULL
		`)
					.bind(id)
					.first<{ id: string; title: string; assigned_to: string | null }>()
			: await db
					.prepare(
						`
            SELECT
              t.id,
              t.title,
              NULL AS assigned_to
            FROM todos t
            WHERE t.id = ? AND t.completed_at IS NULL
          `
					)
					.bind(id)
					.first<{ id: string; title: string; assigned_to: string | null }>();

		if (!todo) return fail(404);
		if (todo.assigned_to && todo.assigned_to !== locals.userId && locals.userRole !== 'admin') {
			return fail(403, { error: 'This task is assigned to another user.' });
		}

		await db
			.prepare(`
			UPDATE todos
			SET completed_by = ?, completed_at = ?, updated_at = ?
			WHERE id = ? AND completed_at IS NULL
		`)
			.bind(locals.userId, now, now, id)
			.run();

		await db.prepare(`
			INSERT INTO todo_completion_log (
				id, todo_id, title, completed_by, completed_at
			)
			VALUES (?, ?, ?, ?, ?)
		`)
		.bind(
			crypto.randomUUID(),
			id,
			todo.title,
			locals.userId,
			now
		)
		.run();

		return { success: true };
	}
};
