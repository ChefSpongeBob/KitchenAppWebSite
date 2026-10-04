import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { hasBusinessCapability } from '$lib/server/permissions';
import { ensureTenantSchema, requireBusinessId } from '$lib/server/tenant';

function canManageTodoHistory(locals: App.Locals) {
	return hasBusinessCapability(
		locals.businessRole,
		locals.businessPermissionTemplate,
		'manage_content',
		locals.businessCapabilities
	);
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!canManageTodoHistory(locals)) {
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
		LIMIT 250
	`)
	.bind(businessId)
	.all();

	return {
		logs: logs.results
	};
};
