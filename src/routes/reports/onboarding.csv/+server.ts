import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasReportsAccess } from '#lib/server/permissions.ts';
import { requireBusinessId } from '#lib/server/tenant.ts';
import { csvEscape } from '#lib/server/history.ts';
import { reportTimestamp } from '#lib/server/reporting.ts';
import { loadOnboardingReport } from '#lib/server/reports.ts';


export const GET: RequestHandler = async ({ locals, url }) => {
  if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  const db = locals.DB;
  if (!db) return new Response('Database unavailable', { status: 503 });

  const report = await loadOnboardingReport(db, requireBusinessId(locals), {
    timeZone: locals.businessTimeZone,
    export: true,
    start: url.searchParams.get('start'),
    end: url.searchParams.get('end')
  });
  const csvTimestamp = (value: number | null) => reportTimestamp(value, report.timeZone);
  const header = [
    'Employee',
    'Email',
    'Package Status',
    'Payroll Classification',
    'Item Count',
    'Pending',
    'Submitted',
    'Approved',
    'Changes Requested',
    'Sent At',
    'Completed At',
    'Approved At',
    'Approved By',
    'Created By'
  ];
  const lines = [
    header.join(','),
    ...report.rows.map((row) =>
      [
        row.employee_name,
        row.employee_email,
        row.package_status,
        row.payroll_classification,
        row.item_count,
        row.pending_items,
        row.submitted_items,
        row.approved_items,
        row.changes_requested_items,
        csvTimestamp(row.sent_at),
        csvTimestamp(row.completed_at),
        csvTimestamp(row.approved_at),
        row.approved_by_name,
        row.created_by_name
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
      'content-disposition': `attachment; filename="onboarding-report-${report.startDate}-to-${report.endDate}.csv"`
    }
  });
};
