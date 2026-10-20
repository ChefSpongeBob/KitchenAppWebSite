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
  const header = [
    'Date',
    'Hour',
    'Sensor ID',
    'Sensor Name',
    'Average Temperature (F)',
    'Minimum Temperature (F)',
    'Maximum Temperature (F)',
    'Average Humidity (%)',
    'Minimum Humidity (%)',
    'Maximum Humidity (%)',
    'Reading Count'
  ];
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
        row.avg_humidity_pct ?? '',
        row.min_humidity_pct ?? '',
        row.max_humidity_pct ?? '',
        row.reading_count
      ]
        .map(csvEscape)
        .join(',')
    )
  ];

  return new Response(`\uFEFF${lines.join('\n')}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="temperature-hourly-${report.startDate}-to-${report.endDate}.csv"`
    }
  });
};
