import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasReportsAccess } from '$lib/server/permissions';
import { requireBusinessId } from '$lib/server/tenant';
import { csvEscape } from '$lib/server/history';
import { loadWasteReport } from '$lib/server/reports';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
		throw redirect(303, '/app');
	}
	const db = locals.DB;
	if (!db) return new Response('Database unavailable', { status: 503 });

	const report = await loadWasteReport(db, requireBusinessId(locals), {
		start: url.searchParams.get('start'),
		end: url.searchParams.get('end')
	});
	const header = ['date', 'product', 'amount', 'unit', 'reason', 'notes', 'submitted_by', 'submitted_by_email'];
	const lines = [
		header.join(','),
		...report.rows.map((row) =>
			[
				row.created_date,
				row.product,
				row.amount ?? '',
				row.unit,
				row.reason,
				row.notes,
				row.submitted_by_name,
				row.submitted_by_email
			]
				.map(csvEscape)
				.join(',')
		)
	];

	return new Response(lines.join('\n'), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': 'attachment; filename="waste-logs.csv"'
		}
	});
};
