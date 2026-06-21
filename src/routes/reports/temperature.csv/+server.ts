import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasReportsAccess } from '$lib/server/permissions';
import { requireBusinessId } from '$lib/server/tenant';
import { csvEscape } from '$lib/server/history';
import { loadTemperatureHourlyAverageReport } from '$lib/server/reports';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  const db = locals.DB;
  if (!db) return new Response('Database unavailable', { status: 503 });

  const report = await loadTemperatureHourlyAverageReport(db, requireBusinessId(locals), {
    start: url.searchParams.get('start'),
    end: url.searchParams.get('end')
  });
  const header = ['date', 'hour', 'sensor_id', 'sensor_name', 'avg_temperature', 'min_temperature', 'max_temperature', 'reading_count'];
  const lines = [
    header.join(','),
    ...report.rows.map((row) =>
      [
        row.event_date,
        row.event_hour,
        row.sensor_id,
        row.sensor_name,
        row.avg_temperature,
        row.min_temperature,
        row.max_temperature,
        row.reading_count
      ]
        .map(csvEscape)
        .join(',')
    )
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="temperature-hourly-averages.csv"'
    }
  });
};
