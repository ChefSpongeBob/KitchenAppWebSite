import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasReportsAccess } from '$lib/server/permissions';
import { requireBusinessId } from '$lib/server/tenant';
import { csvEscape } from '$lib/server/history';
import { loadScheduleRequestsReport } from '$lib/server/reports';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  const db = locals.DB;
  if (!db) return new Response('Database unavailable', { status: 503 });

  const report = await loadScheduleRequestsReport(db, requireBusinessId(locals), {
    start: url.searchParams.get('start'),
    end: url.searchParams.get('end')
  });
  const header = [
    'date',
    'type',
    'employee',
    'email',
    'status',
    'department',
    'role',
    'detail',
    'start',
    'end',
    'note',
    'manager_note',
    'resolved_by'
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

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="schedule-requests.csv"'
    }
  });
};
