import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { randomUUID } from 'crypto';

export const load: PageServerLoad = async ({ locals }) => {
	const db = locals.DB;
	const now = Math.floor(Date.now() / 1000);

	// LAZY CLEANUP (delete completed todos older than 3 days)
	const threeDaysAgo = now - 60 * 60 * 24 * 3;

	await db.prepare(`
		DELETE FROM todos
		WHERE completed_at IS NOT NULL
		AND completed_at < ?
	`)
	.bind(threeDaysAgo)
	.run();

	const active = await db.prepare(`
		SELECT t.id, t.title, t.description, t.created_at
		FROM todos t
		WHERE t.completed_at IS NULL
		ORDER BY t.created_at DESC
	`)
	.all();

	const completed = await db.prepare(`
		SELECT t.id, t.title, t.description, t.completed_at, u.display_name
		FROM todos t
		LEFT JOIN users u ON u.id = t.completed_by
		WHERE t.completed_at IS NOT NULL
		ORDER BY t.completed_at DESC
	`)
	.all();

	return {
		active: active.results,
		completed: completed.results
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (locals.userRole !== 'admin') {
			throw redirect(303, '/');
		}

		const db = locals.DB;
		const formData = await request.formData();
		const title = String(formData.get('title') || '').trim();
		const description = String(formData.get('description') || '').trim();

		if (!title) {
			return fail(400, { error: 'Title required' });
		}

		const now = Math.floor(Date.now() / 1000);

		await db.prepare(`
			INSERT INTO todos (
				id, title, description,
				created_by,
				created_at, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?)
		`)
		.bind(
			randomUUID(),
			title,
			description,
			locals.userId,
			now,
			now
		)
		.run();

		return { success: true };
	},

	complete: async ({ request, locals }) => {
		const db = locals.DB;
		const formData = await request.formData();
		const id = String(formData.get('id') || '');

		if (!id) return fail(400);

		const now = Math.floor(Date.now() / 1000);

		const todo = await db.prepare(`
			SELECT id, title
			FROM todos
			WHERE id = ?
		`)
		.bind(id)
		.first();

		if (!todo) return fail(404);

		await db.prepare(`
			UPDATE todos
			SET completed_by = ?, completed_at = ?, updated_at = ?
			WHERE id = ?
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
			randomUUID(),
			id,
			todo.title,
			locals.userId,
			now
		)
		.run();

		return { success: true };
	}
};