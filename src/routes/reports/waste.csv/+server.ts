import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasReportsAccess } from '#lib/server/permissions.ts';
import { requireBusinessId } from '#lib/server/tenant.ts';
import { csvEscape } from '#lib/server/history.ts';
import { loadWasteReport } from '#lib/server/reports.ts';
import { reportTimestamp } from '#lib/server/reporting.ts';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
		throw redirect(303, '/app');
	}
	const db = locals.DB;
	if (!db) return new Response('Database unavailable', { status: 503 });

	const report = await loadWasteReport(db, requireBusinessId(locals), {
		timeZone: locals.businessTimeZone,
		export: true,
		start: url.searchParams.get('start'),
		end: url.searchParams.get('end'),
		createdAt: url.searchParams.get('created_at'),
    entryId: url.searchParams.get('entry_id')
	});
	const header = ['Date', 'Product', 'Amount', 'Unit', 'Reason', 'Notes', 'Submitted By', 'Submitted By Email', 'Submitted At'];
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
				row.submitted_by_email,
        reportTimestamp(row.created_at, report.timeZone)
			]
				.map(csvEscape)
				.join(',')
		)
	];

	return new Response(`\uFEFF${lines.join('\n')}`, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'x-report-time-zone': report.timeZone,
			'content-disposition': `attachment; filename="waste-logs-${report.startDate}-to-${report.endDate}.csv"`
		}
	});
};
