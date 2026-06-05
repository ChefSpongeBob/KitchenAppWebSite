import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasReportsAccess } from '$lib/server/permissions';
import { csvEscape, loadScheduleHistoryReport } from '$lib/server/history';
import { requireBusinessId } from '$lib/server/tenant';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  const db = locals.DB;
  if (!db) return new Response('Database unavailable', { status: 503 });

  const report = await loadScheduleHistoryReport(db, requireBusinessId(locals), {
    start: url.searchParams.get('start'),
    end: url.searchParams.get('end')
  });
  const header = [
    'week_start',
    'version',
    'published_by',
    'shift_date',
    'employee',
    'department',
    'role',
    'detail',
    'start',
    'end',
    'break_minutes',
    'notes'
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
        row.notes
      ]
        .map(csvEscape)
        .join(',')
    )
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="schedule-history.csv"'
    }
  });
};
