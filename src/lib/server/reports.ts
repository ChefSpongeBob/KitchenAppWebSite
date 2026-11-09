import { ensureTenantSchema } from '#lib/server/tenant.ts';
import { reportRange, reportRows, reportRowLimit, reportHourAt, reportHourLabel, REPORT_EXPORT_LIMIT, type ReportOptions } from '#lib/server/reporting.ts';

import { visitTemperatureArchives, type ArchivedTemperatureReading } from '#lib/server/temperatureArchive.ts';
import { TEMPERATURE_ARCHIVE_SECONDS } from '#lib/temperatureTiming.ts';
import { error } from '@sveltejs/kit';

type DB = App.RuntimeEnv['DB'];

export type ReportRange = {
  startDate: string;
  endDate: string;
};

export type ScheduleRequestReportRow = {
  request_type: string;
  request_date: string;
  employee_name: string;
  employee_email: string;
  status: string;
  department: string;
  role_name: string;
  detail: string;
  start_time: string;
  end_label: string;
  note: string;
  manager_note: string;
  created_at: number;
  updated_at: number;
  resolved_at: number | null;
  resolved_by_name: string;
};

export type TemperatureReportRow = {
  row_type: 'reading' | 'alert';
  sensor_id: number;
  sensor_name: string;
  event_date: string;
  event_time: number;
  temperature: number | null;
  humidity_pct: number | null;
  event_type: string;
  status: string;
  threshold: number | null;
  recovered_at: number | null;
};

export type TemperatureHourlyAverageReportRow = {
  event_date: string;
  event_hour: string;
  sensor_id: number;
  sensor_name: string;
  avg_temperature: number;
  min_temperature: number;
  max_temperature: number;
  avg_humidity_pct: number | null;
  min_humidity_pct: number | null;
  max_humidity_pct: number | null;
  reading_count: number;
};

export type OnboardingReportRow = {
  employee_name: string;
  employee_email: string;
  package_status: string;
  payroll_classification: string;
  sent_at: number;
  completed_at: number | null;
  approved_at: number | null;
  approved_by_name: string;
  created_by_name: string;
  item_count: number;
  pending_items: number;
  submitted_items: number;
  approved_items: number;
  changes_requested_items: number;
  updated_at: number;
};

export type WasteReportRow = {
  id: string;
  product: string;
  amount: number | null;
  unit: string;
  reason: string;
  notes: string;
  submitted_by_name: string;
  submitted_by_email: string;
  created_at: number;
  created_date: string;
};

export async function loadScheduleRequestsReport(
  db: DB,
  businessId: string,
  params: ReportOptions = {}
) {
  await ensureTenantSchema(db, true);
  const range = reportRange(params, 60);
  const { startDate, endDate, timeZone, startTs, endTs } = range;

  const timeOff = await db
    .prepare(
      `
      SELECT
        'time_off' AS request_type,
        r.start_date AS request_date,
        COALESCE(u.display_name, u.email, 'Unknown') AS employee_name,
        COALESCE(u.email, '') AS employee_email,
        r.status,
        '' AS department,
        '' AS role_name,
        CASE WHEN r.end_date <> r.start_date THEN r.start_date || ' to ' || r.end_date ELSE r.start_date END AS detail,
        '' AS start_time,
        '' AS end_label,
        r.note,
        r.manager_note,
        r.created_at,
        r.updated_at,
        r.resolved_at,
        COALESCE(manager.display_name, manager.email, '') AS resolved_by_name
      FROM user_schedule_time_off_requests r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN users manager ON manager.id = r.resolved_by_user_id
      WHERE r.business_id = ?
        AND r.start_date BETWEEN ? AND ?
      ORDER BY r.start_date DESC, r.updated_at DESC
      LIMIT ${reportRowLimit(params)}
      `
    )
    .bind(businessId, startDate, endDate)
    .all<ScheduleRequestReportRow>();

  const openShiftRequests = await db
    .prepare(
      `
      SELECT
        'open_shift' AS request_type,
        o.shift_date AS request_date,
        COALESCE(u.display_name, u.email, 'Unknown') AS employee_name,
        COALESCE(u.email, '') AS employee_email,
        r.status,
        o.department,
        o.role AS role_name,
        o.detail,
        o.start_time,
        o.end_label,
        '' AS note,
        r.manager_note,
        r.created_at,
        r.updated_at,
        r.resolved_at,
        COALESCE(manager.display_name, manager.email, '') AS resolved_by_name
      FROM schedule_open_shift_requests r
      JOIN schedule_open_shifts o ON o.id = r.open_shift_id AND o.business_id = r.business_id
      JOIN users u ON u.id = r.requested_by_user_id
      LEFT JOIN users manager ON manager.id = r.resolved_by_user_id
      WHERE r.business_id = ?
        AND o.shift_date BETWEEN ? AND ?
      ORDER BY o.shift_date DESC, r.updated_at DESC
      LIMIT ${reportRowLimit(params)}
      `
    )
    .bind(businessId, startDate, endDate)
    .all<ScheduleRequestReportRow>();

  const shiftOffers = await db
    .prepare(
      `
      SELECT
        'shift_offer' AS request_type,
        s.shift_date AS request_date,
        COALESCE(requester.display_name, requester.email, target.display_name, target.email, offered.display_name, offered.email, 'Unclaimed') AS employee_name,
        COALESCE(requester.email, target.email, offered.email, '') AS employee_email,
        CASE
          WHEN o.requested_by_user_id IS NOT NULL THEN 'requested'
          WHEN o.target_user_id IS NOT NULL THEN 'offered'
          ELSE 'open'
        END AS status,
        s.department,
        s.role AS role_name,
        s.detail,
        s.start_time,
        s.end_label,
        '' AS note,
        o.manager_note,
        o.created_at,
        o.updated_at,
        NULL AS resolved_at,
        COALESCE(offered.display_name, offered.email, '') AS resolved_by_name
      FROM schedule_shift_offers o
      JOIN schedule_shifts s ON s.id = o.shift_id AND s.business_id = o.business_id
      LEFT JOIN users offered ON offered.id = o.offered_by_user_id
      LEFT JOIN users target ON target.id = o.target_user_id
      LEFT JOIN users requester ON requester.id = o.requested_by_user_id
      WHERE o.business_id = ?
        AND s.shift_date BETWEEN ? AND ?
      ORDER BY s.shift_date DESC, o.updated_at DESC
      LIMIT ${reportRowLimit(params)}
      `
    )
    .bind(businessId, startDate, endDate)
    .all<ScheduleRequestReportRow>();

  const availability = await db.prepare(`
    SELECT 'availability' AS request_type, r.availability_json,
      COALESCE(u.display_name, u.email, 'Unknown') AS employee_name,
      COALESCE(u.email, '') AS employee_email, r.status,
      '' AS department, '' AS role_name, '' AS start_time, '' AS end_label, '' AS note,
      r.manager_note, r.created_at, r.updated_at, r.resolved_at,
      COALESCE(manager.display_name, manager.email, '') AS resolved_by_name
    FROM user_schedule_availability_requests r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN users manager ON manager.id = r.resolved_by_user_id
    WHERE r.business_id = ? AND r.updated_at >= ? AND r.updated_at < ?
    ORDER BY r.updated_at DESC, r.id ASC LIMIT ${reportRowLimit(params)}
  `).bind(businessId, startTs, endTs).all<Omit<ScheduleRequestReportRow, 'request_date' | 'detail'> & { availability_json: string }>();
  const availabilityRows = (availability.results ?? []).map(({ availability_json, ...row }) => ({
    ...row, request_date: range.dateAt(row.updated_at), detail: availabilityDescription(availability_json)
  }));
  const rows = [
    ...(timeOff.results ?? []),
    ...(openShiftRequests.results ?? []),
    ...(shiftOffers.results ?? []),
    ...availabilityRows
  ]
    .sort((a, b) => b.request_date.localeCompare(a.request_date) || b.updated_at - a.updated_at);

  return { startDate, endDate, timeZone, ...reportRows(rows, params) };
}

function availabilityDescription(value: string) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  try {
    const rows: unknown = JSON.parse(value);
    if (!Array.isArray(rows) || rows.length !== 7) return 'Availability not recorded';
    const seen = new Set<number>();
    const lines = rows.map(row => {
      if (!row || !Number.isInteger(row.weekday) || row.weekday < 0 || row.weekday > 6 || seen.has(row.weekday)) throw new Error('Invalid day');
      seen.add(row.weekday);
      const available = row.isAvailable === true || row.isAvailable === 1;
      if (available && (![row.startTime, row.endTime].every(time => typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) || row.startTime >= row.endTime)) throw new Error('Invalid time');
      return { day: row.weekday as number, text: `${days[row.weekday]}: ${available ? row.startTime + '-' + row.endTime : 'Unavailable'}` };
    });
    return lines.sort((a, b) => a.day - b.day).map(row => row.text).join('; ');
  } catch { return 'Availability not recorded'; }
}

export async function loadTemperatureReport(
  db: DB,
  businessId: string,
  params: ReportOptions = {}
) {
  await ensureTenantSchema(db, true);
  const range = reportRange(params, 14);
  const { startDate, endDate, timeZone, startTs, endTs } = range;

  const readings = await db
    .prepare(
      `
      SELECT
        'reading' AS row_type,
        t.sensor_id,
        COALESCE(sn.display_name, 'Sensor ' || t.sensor_id) AS sensor_name,
        date(t.ts, 'unixepoch') AS event_date,
        t.ts AS event_time,
        t.temperature,
        t.humidity_pct,
        '' AS event_type,
        '' AS status,
        NULL AS threshold,
        NULL AS recovered_at
      FROM temps t
      LEFT JOIN temperature_sensor_nodes sn
        ON sn.business_id = t.business_id
        AND sn.sensor_id = t.sensor_id
      WHERE t.business_id = ?
        AND t.ts >= ? AND t.ts < ?
      ORDER BY t.ts DESC
      LIMIT ${reportRowLimit(params)}
      `
    )
    .bind(businessId, startTs, endTs)
    .all<TemperatureReportRow>();

  const alerts = await db
    .prepare(
      `
      SELECT
        'alert' AS row_type,
        a.sensor_id,
        COALESCE(sn.display_name, 'Sensor ' || a.sensor_id) AS sensor_name,
        date(a.last_seen_at, 'unixepoch') AS event_date,
        a.last_seen_at AS event_time,
        a.temperature,
        NULL AS humidity_pct,
        a.event_type,
        a.status,
        a.threshold,
        a.recovered_at
      FROM temperature_alert_events a
      LEFT JOIN temperature_sensor_nodes sn
        ON sn.business_id = a.business_id
        AND sn.sensor_id = a.sensor_id
      WHERE a.business_id = ?
        AND a.last_seen_at >= ? AND a.last_seen_at < ?
      ORDER BY a.last_seen_at DESC
      LIMIT ${reportRowLimit(params)}
      `
    )
    .bind(businessId, startTs, endTs)
    .all<TemperatureReportRow>();

  const rows = [...(alerts.results ?? []), ...(readings.results ?? [])]
    .sort((a, b) => b.event_time - a.event_time);

  return { startDate, endDate, timeZone, ...reportRows(rows.map(row => ({ ...row,
    event_date: range.dateAt(row.event_time)
  })), params) };
}

type TemperatureReportOptions = ReportOptions & { archiveBucket?: App.RuntimeEnv['DOC_MEDIA'] };

async function visitTemperatureReportReadings(
  db: DB,
  businessId: string,
  params: TemperatureReportOptions,
  visit: (row: ArchivedTemperatureReading) => void
) {
  await ensureTenantSchema(db, true);
  const range = reportRange(params, 14);
  const { endTs } = range;
  const startTs = Math.max(range.startTs, Math.floor(Date.now() / 1000) - TEMPERATURE_ARCHIVE_SECONDS);
  const result = await db.prepare(`
    SELECT t.id, t.sensor_id, t.temperature, t.humidity_pct, t.ts,
      COALESCE(sn.display_name, 'Sensor ' || t.sensor_id) AS sensor_name
    FROM temps t LEFT JOIN temperature_sensor_nodes sn
      ON sn.business_id = t.business_id AND sn.sensor_id = t.sensor_id
    WHERE t.business_id = ? AND t.ts >= ? AND t.ts < ?
    ORDER BY t.ts DESC, t.id DESC LIMIT 10001
  `).bind(businessId, startTs, endTs).all<ArchivedTemperatureReading>();
  const live = reportRows(result.results ?? [], { ...params, export: true }).rows;
  const liveIds = new Set(live.map(row => row.id));
  try {
    if (params.archiveBucket) await visitTemperatureArchives(params.archiveBucket, businessId, startTs, endTs,
      row => { if (!liveIds.has(row.id)) visit(row); });
  } catch (failure) {
    if (failure && typeof failure === 'object' && 'status' in failure && failure.status === 413) throw failure;
    error(503, 'Temperature reports are temporarily unavailable. Please retry.');
  }
  for (const row of live) visit(row);
  return range;
}

export async function loadTemperatureReadingsReport(db: DB, businessId: string, params: TemperatureReportOptions = {}) {
  const rows: ArchivedTemperatureReading[] = [];
  const range = await visitTemperatureReportReadings(db, businessId, params, row => {
    if (rows.length >= REPORT_EXPORT_LIMIT) error(413, 'This report is too large. Choose a shorter date range and download again.');
    rows.push(row);
  });
  rows.sort((a, b) => b.ts - a.ts || a.sensor_id - b.sensor_id || b.id - a.id);
  return { startDate: range.startDate, endDate: range.endDate, timeZone: range.timeZone, ...reportRows(rows, params) };
}

export async function loadTemperatureHourlyAverageReport(db: DB, businessId: string, params: TemperatureReportOptions = {}) {
  const range = reportRange(params, 14);
  const { startDate, endDate, timeZone } = range;
  const hourAt = reportHourAt(range);
  type Bucket = { hour_start: number; sensor_id: number; sensor_name: string; sum: number; count: number;
    min: number; max: number; humiditySum: number; humidityCount: number; humidityMin: number; humidityMax: number };
  const buckets = new Map<string, Bucket>();
  const add = (row: ArchivedTemperatureReading) => {
    const hour = hourAt(row.ts);
    const key = row.sensor_id + ':' + hour;
    const bucket = buckets.get(key) ?? { hour_start: hour, sensor_id: row.sensor_id, sensor_name: row.sensor_name,
      sum: 0, count: 0, min: Infinity, max: -Infinity, humiditySum: 0, humidityCount: 0, humidityMin: Infinity, humidityMax: -Infinity };
    bucket.sum += row.temperature; bucket.count++; bucket.min = Math.min(bucket.min, row.temperature); bucket.max = Math.max(bucket.max, row.temperature);
    if (row.humidity_pct !== null) {
      bucket.humiditySum += row.humidity_pct; bucket.humidityCount++;
      bucket.humidityMin = Math.min(bucket.humidityMin, row.humidity_pct); bucket.humidityMax = Math.max(bucket.humidityMax, row.humidity_pct);
    }
    buckets.set(key, bucket);
    if (buckets.size > 10_000) error(413, 'This report is too large. Choose a shorter date range and download again.');
  };
  await visitTemperatureReportReadings(db, businessId, params, add);
  const labels = new Map<number, { event_date: string; event_hour: string }>();
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const rows = [...buckets.values()].sort((a,b) => b.hour_start - a.hour_start || a.sensor_id - b.sensor_id).map(bucket => {
    let label = labels.get(bucket.hour_start);
    if (!label) { label = { event_date: range.dateAt(bucket.hour_start), event_hour: reportHourLabel(bucket.hour_start, timeZone) }; labels.set(bucket.hour_start, label); }
    return { ...label, hour_start: bucket.hour_start, sensor_id: bucket.sensor_id, sensor_name: bucket.sensor_name,
      avg_temperature: round(bucket.sum / bucket.count), min_temperature: round(bucket.min), max_temperature: round(bucket.max),
      avg_humidity_pct: bucket.humidityCount ? round(bucket.humiditySum / bucket.humidityCount) : null,
      min_humidity_pct: bucket.humidityCount ? round(bucket.humidityMin) : null,
      max_humidity_pct: bucket.humidityCount ? round(bucket.humidityMax) : null, reading_count: bucket.count };
  });
  return { startDate, endDate, timeZone, archivesAvailable: Boolean(params.archiveBucket), ...reportRows(rows, params, 3000) };
}

export async function loadOnboardingReport(
  db: DB,
  businessId: string,
  params: ReportOptions = {}
) {
  await ensureTenantSchema(db, true);
  const range = reportRange(params, 60);
  const { startDate, endDate, timeZone, startTs, endTs } = range;

  const rows = await db
    .prepare(
      `
      SELECT
        COALESCE(u.display_name, u.email, 'Unknown') AS employee_name,
        COALESCE(u.email, '') AS employee_email,
        p.status AS package_status,
        p.payroll_classification,
        p.sent_at,
        p.completed_at,
        p.approved_at,
        COALESCE(approved.display_name, approved.email, '') AS approved_by_name,
        COALESCE(created.display_name, created.email, '') AS created_by_name,
        COUNT(i.id) AS item_count,
        COALESCE(SUM(CASE WHEN i.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_items,
        COALESCE(SUM(CASE WHEN i.status = 'submitted' THEN 1 ELSE 0 END), 0) AS submitted_items,
        COALESCE(SUM(CASE WHEN i.status = 'approved' THEN 1 ELSE 0 END), 0) AS approved_items,
        COALESCE(SUM(CASE WHEN i.status = 'needs_changes' THEN 1 ELSE 0 END), 0) AS changes_requested_items,
        p.updated_at
      FROM employee_onboarding_packages p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN users approved ON approved.id = p.approved_by
      LEFT JOIN users created ON created.id = p.created_by
      LEFT JOIN employee_onboarding_items i
        ON i.package_id = p.id
        AND i.business_id = p.business_id
      WHERE p.business_id = ?
        AND p.updated_at >= ? AND p.updated_at < ?
      GROUP BY p.id, u.display_name, u.email, approved.display_name, approved.email, created.display_name, created.email
      ORDER BY p.updated_at DESC
      LIMIT ${reportRowLimit(params)}
      `
    )
    .bind(businessId, startTs, endTs)
    .all<OnboardingReportRow>();

  return { startDate, endDate, timeZone, ...reportRows(rows.results ?? [], params) };
}

export async function loadWasteReport(
  db: DB,
  businessId: string,
  params: ReportOptions & { createdAt?: string | number | null; entryId?: string | null } = {}
) {
  await ensureTenantSchema(db, true);
  const range = reportRange(params, 60);
  const { startDate, endDate, timeZone, startTs, endTs } = range;
  const createdAt = Number(params.createdAt);
  const hasCreatedAt = Number.isFinite(createdAt) && createdAt > 0;

  const rows = await db
    .prepare(
      `
      SELECT
        w.id,
        w.product,
        w.amount,
        w.unit,
        w.reason,
        w.notes,
        COALESCE(u.display_name, u.email, 'Unknown') AS submitted_by_name,
        COALESCE(u.email, '') AS submitted_by_email,
        w.created_at,
        date(w.created_at, 'unixepoch') AS created_date
      FROM waste_logs w
      LEFT JOIN users u ON u.id = w.submitted_by_user_id
      WHERE w.business_id = ?
        AND w.created_at >= ? AND w.created_at < ?
        ${hasCreatedAt ? 'AND w.created_at = ?' : ''}
        ${params.entryId ? 'AND w.id = ?' : ''}
      ORDER BY w.created_at DESC, w.id ASC
      LIMIT ${reportRowLimit(params)}
      `
    )
    .bind(businessId, startTs, endTs, ...(hasCreatedAt ? [createdAt] : []), ...(params.entryId ? [params.entryId] : []))
    .all<WasteReportRow>();

  return { startDate, endDate, timeZone, ...reportRows((rows.results ?? []).map(row => ({ ...row, created_date: range.dateAt(row.created_at) })), params) };
}
