import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.userRole !== 'admin') {
		throw redirect(303, '/');
	}

	const db = locals.DB;

	const logs = await db.prepare(`
		SELECT 
			l.id,
			l.title,
			l.completed_at,
			u.display_name
		FROM todo_completion_log l
		LEFT JOIN users u ON u.id = l.completed_by
		ORDER BY l.completed_at DESC
	`)
	.all();

	return {
		logs: logs.results
	};
};

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		if (locals.userRole !== 'admin') {
			throw redirect(303, '/');
		}

		const db = locals.DB;
		const formData = await request.formData();
		const id = String(formData.get('id') || '');

		if (!id) return fail(400);

		await db.prepare(`
			DELETE FROM todo_completion_log
			WHERE id = ?
		`)
		.bind(id)
		.run();

		return { success: true };
	}
};
