import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

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

export const load: PageServerLoad = async ({ locals }) => {
	const db = locals.DB;
	if (!db) {
		return { active: [], completed: [] };
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

	return {
		active: active.results ?? [],
		completed: completed.results ?? []
	};
};

export const actions: Actions = {
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
				t.completed_at,
				ta.user_id AS assigned_to
			FROM todos t
			LEFT JOIN todo_assignments ta ON ta.todo_id = t.id
			WHERE t.id = ?
		`)
					.bind(id)
					.first<{ id: string; title: string; completed_at: number | null; assigned_to: string | null }>()
			: await db
					.prepare(
						`
            SELECT
              t.id,
              t.title,
              t.completed_at,
              NULL AS assigned_to
            FROM todos t
            WHERE t.id = ?
          `
					)
					.bind(id)
					.first<{ id: string; title: string; completed_at: number | null; assigned_to: string | null }>();

		if (!todo) return fail(404);
		if (todo.completed_at !== null) return { success: true };
		if (todo.assigned_to && todo.assigned_to !== locals.userId && locals.userRole !== 'admin') {
			return fail(403, { error: 'This task is assigned to another user.' });
		}

		const updateResult = await db
			.prepare(`
			UPDATE todos
			SET completed_by = ?, completed_at = ?, updated_at = ?
			WHERE id = ?
		`)
			.bind(locals.userId, now, now, id)
			.run();

		if (!updateResult.success || (updateResult.meta?.changes ?? 0) < 1) {
			return fail(409, { error: 'Task could not be completed.' });
		}

		// Completion itself should not depend on audit log availability.
		if (await tableExists(db, 'todo_completion_log')) {
			await db
				.prepare(`
				INSERT INTO todo_completion_log (
					id, todo_id, title, completed_by, completed_at
				)
				VALUES (?, ?, ?, ?, ?)
			`)
				.bind(crypto.randomUUID(), id, todo.title, locals.userId, now)
				.run();
		}

		return { success: true };
	}
};
