import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasReportsAccess } from '$lib/server/permissions';
import { requireBusinessId } from '$lib/server/tenant';
import { csvEscape } from '$lib/server/history';
import { loadTemperatureReport } from '$lib/server/reports';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  const db = locals.DB;
  if (!db) return new Response('Database unavailable', { status: 503 });

  const report = await loadTemperatureReport(db, requireBusinessId(locals), {
    start: url.searchParams.get('start'),
    end: url.searchParams.get('end')
  });
  const header = ['date', 'row_type', 'sensor_id', 'sensor_name', 'temperature', 'event_type', 'status', 'threshold', 'acknowledged_by'];
  const lines = [
    header.join(','),
    ...report.rows.map((row) =>
      [
        row.event_date,
        row.row_type,
        row.sensor_id,
        row.sensor_name,
        row.temperature ?? '',
        row.event_type,
        row.status,
        row.threshold ?? '',
        row.acknowledged_by_name
      ]
        .map(csvEscape)
        .join(',')
    )
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="temperature-report.csv"'
    }
  });
};
