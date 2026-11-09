import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasReportsAccess } from '#lib/server/permissions.ts';
import { csvEscape, loadScheduleHistoryReport } from '#lib/server/history.ts';
import { requireBusinessId } from '#lib/server/tenant.ts';
import { reportTimestamp } from '#lib/server/reporting.ts';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  const db = locals.DB;
  if (!db) return new Response('Database unavailable', { status: 503 });

  const report = await loadScheduleHistoryReport(db, requireBusinessId(locals), {
    timeZone: locals.businessTimeZone,
    export: true,
    start: url.searchParams.get('start'),
    end: url.searchParams.get('end'),
    version: url.searchParams.get('version'),
    publishId: url.searchParams.get('publish_id')
  });
  const header = [
    'Week Start',
    'Version',
    'Published By',
    'Shift Date',
    'Employee',
    'Department',
    'Role',
    'Detail',
    'Start',
    'End',
    'Break Minutes',
    'Notes',
    'Published At'
  ];
  const lines = [
    header.join(','),
    ...report.rows.map((row) =>
      [
        row.week_start,
        row.version_number,
        row.published_by_name,
        row.shift_date,
        row.employee_name_snapshot,
        row.department,
        row.role_name,
        row.detail,
        row.start_time,
        row.end_label,
        row.break_minutes,
        row.notes,
        reportTimestamp(row.published_at, report.timeZone)
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
      'content-disposition': `attachment; filename="schedule-history-${report.startDate}-to-${report.endDate}.csv"`
    }
  });
};
