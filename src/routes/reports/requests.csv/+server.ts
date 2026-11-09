import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasReportsAccess } from '#lib/server/permissions.ts';
import { requireBusinessId } from '#lib/server/tenant.ts';
import { csvEscape } from '#lib/server/history.ts';
import { loadScheduleRequestsReport } from '#lib/server/reports.ts';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  const db = locals.DB;
  if (!db) return new Response('Database unavailable', { status: 503 });

  const report = await loadScheduleRequestsReport(db, requireBusinessId(locals), {
    timeZone: locals.businessTimeZone,
    export: true,
    start: url.searchParams.get('start'),
    end: url.searchParams.get('end')
  });
  const header = [
    'Date',
    'Type',
    'Employee',
    'Email',
    'Status',
    'Department',
    'Role',
    'Detail',
    'Start',
    'End',
    'Note',
    'Manager Note',
    'Resolved By'
  ];
  const lines = [
    header.join(','),
    ...report.rows.map((row) =>
      [
        row.request_date,
        row.request_type,
        row.employee_name,
        row.employee_email,
        row.status,
        row.department,
        row.role_name,
        row.detail,
        row.start_time,
        row.end_label,
        row.note,
        row.manager_note,
        row.resolved_by_name
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
      'content-disposition': `attachment; filename="schedule-requests-${report.startDate}-to-${report.endDate}.csv"`
    }
  });
};
