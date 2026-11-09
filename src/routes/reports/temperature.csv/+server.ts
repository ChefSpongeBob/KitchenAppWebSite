import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasReportsAccess } from '#lib/server/permissions.ts';
import { requireBusinessId } from '#lib/server/tenant.ts';
import { csvEscape } from '#lib/server/history.ts';
import { loadTemperatureHourlyAverageReport, loadTemperatureReadingsReport } from '#lib/server/reports.ts';
import { reportTimestamp } from '#lib/server/reporting.ts';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  const db = locals.DB;
  if (!db) return new Response('Database unavailable', { status: 503 });
  if (!locals.env?.DOC_MEDIA) return new Response('Temperature archives unavailable.', { status: 503 });

  const format = url.searchParams.get('format') ?? 'hourly';
  if (format !== 'hourly' && format !== 'readings') error(400, 'Choose a valid temperature report format.');
  if (format === 'readings') {
    const report = await loadTemperatureReadingsReport(db, requireBusinessId(locals), {
      archiveBucket: locals.env.DOC_MEDIA, timeZone: locals.businessTimeZone, export: true,
      start: url.searchParams.get('start'), end: url.searchParams.get('end')
    });
    const lines = [
      ['Reading ID', 'Sensor ID', 'Sensor Name', 'Measured At', 'Measured At (UTC)', 'Temperature (F)', 'Humidity (%)'].join(','),
      ...report.rows.map(row => [row.id, row.sensor_id, row.sensor_name, reportTimestamp(row.ts, report.timeZone),
        new Date(row.ts * 1000).toISOString(), row.temperature, row.humidity_pct ?? ''].map(csvEscape).join(','))
    ];
    return new Response(`\uFEFF${lines.join('\n')}`, { headers: {
      'content-type': 'text/csv; charset=utf-8', 'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff', 'x-report-time-zone': report.timeZone,
      'content-disposition': `attachment; filename="temperature-readings-${report.startDate}-to-${report.endDate}.csv"`
    } });
  }

  const report = await loadTemperatureHourlyAverageReport(db, requireBusinessId(locals), {
    archiveBucket: locals.env?.DOC_MEDIA, timeZone: locals.businessTimeZone,
    export: true,
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
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'x-report-time-zone': report.timeZone,
      'content-disposition': `attachment; filename="temperature-hourly-${report.startDate}-to-${report.endDate}.csv"`
    }
  });
};
