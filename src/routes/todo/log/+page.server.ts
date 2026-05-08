import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { ensureTenantSchema, requireBusinessId } from '$lib/server/tenant';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.userRole !== 'admin') {
		throw redirect(303, '/app');
	}

	const db = locals.DB;
	if (!db) return { logs: [] };
	await ensureTenantSchema(db);
	const businessId = requireBusinessId(locals);

	const logs = await db.prepare(`
		SELECT 
			l.id,
			l.title,
			l.completed_at,
			u.display_name
		FROM todo_completion_log l
		LEFT JOIN users u ON u.id = l.completed_by
		WHERE l.business_id = ?
		ORDER BY l.completed_at DESC
	`)
	.bind(businessId)
	.all();

	return {
		logs: logs.results
	};
};

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		if (locals.userRole !== 'admin') {
			throw redirect(303, '/app');
		}

		const db = locals.DB;
		if (!db) return fail(503, { error: 'Database not configured.' });
		await ensureTenantSchema(db);
		const businessId = requireBusinessId(locals);
		const formData = await request.formData();
		const id = String(formData.get('id') || '');

		if (!id) return fail(400);

		await db.prepare(`
			DELETE FROM todo_completion_log
			WHERE id = ? AND business_id = ?
		`)
		.bind(id, businessId)
		.run();

		return { success: true };
	}
};
