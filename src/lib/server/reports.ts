import { ensureTenantSchema } from '$lib/server/tenant';

type DB = App.Platform['env']['DB'];

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
  event_type: string;
  status: string;
  threshold: number | null;
  acknowledged_by_name: string;
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

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function clampRange(start: string | null, end: string | null, fallbackDays: number): ReportRange {
  const today = new Date();
  const endDate = end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : isoDate(today);
  const startFallback = new Date(today);
  startFallback.setDate(startFallback.getDate() - fallbackDays);
  const startDate = start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : isoDate(startFallback);
  return { startDate, endDate };
}

export async function loadScheduleRequestsReport(
  db: DB,
  businessId: string,
  params: { start?: string | null; end?: string | null } = {}
) {
  await ensureTenantSchema(db, true);
  const { startDate, endDate } = clampRange(params.start ?? null, params.end ?? null, 60);

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
      LIMIT 500
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
      LIMIT 500
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
      LIMIT 500
      `
    )
    .bind(businessId, startDate, endDate)
    .all<ScheduleRequestReportRow>();

  const rows = [
    ...(timeOff.results ?? []),
    ...(openShiftRequests.results ?? []),
    ...(shiftOffers.results ?? [])
  ]
    .sort((a, b) => b.request_date.localeCompare(a.request_date) || b.updated_at - a.updated_at)
    .slice(0, 1000);

  return { startDate, endDate, rows };
}

export async function loadTemperatureReport(
  db: DB,
  businessId: string,
  params: { start?: string | null; end?: string | null } = {}
) {
  await ensureTenantSchema(db, true);
  const { startDate, endDate } = clampRange(params.start ?? null, params.end ?? null, 14);

  const readings = await db
    .prepare(
      `
      SELECT
        'reading' AS row_type,
        t.sensor_id,
        COALESCE(sn.name, 'Sensor ' || t.sensor_id) AS sensor_name,
        date(t.ts, 'unixepoch') AS event_date,
        t.ts AS event_time,
        t.temperature,
        '' AS event_type,
        '' AS status,
        NULL AS threshold,
        '' AS acknowledged_by_name,
        NULL AS recovered_at
      FROM temps t
      LEFT JOIN sensor_nodes sn
        ON sn.business_id = t.business_id
        AND sn.sensor_id = t.sensor_id
      WHERE t.business_id = ?
        AND date(t.ts, 'unixepoch') BETWEEN ? AND ?
      ORDER BY t.ts DESC
      LIMIT 1000
      `
    )
    .bind(businessId, startDate, endDate)
    .all<TemperatureReportRow>();

  const alerts = await db
    .prepare(
      `
      SELECT
        'alert' AS row_type,
        a.sensor_id,
        COALESCE(sn.name, 'Sensor ' || a.sensor_id) AS sensor_name,
        date(a.last_seen_at, 'unixepoch') AS event_date,
        a.last_seen_at AS event_time,
        a.temperature,
        a.event_type,
        a.status,
        a.threshold,
        COALESCE(u.display_name, u.email, '') AS acknowledged_by_name,
        a.recovered_at
      FROM temperature_alert_events a
      LEFT JOIN sensor_nodes sn
        ON sn.business_id = a.business_id
        AND sn.sensor_id = a.sensor_id
      LEFT JOIN users u ON u.id = a.acknowledged_by
      WHERE a.business_id = ?
        AND date(a.last_seen_at, 'unixepoch') BETWEEN ? AND ?
      ORDER BY a.last_seen_at DESC
      LIMIT 500
      `
    )
    .bind(businessId, startDate, endDate)
    .all<TemperatureReportRow>();

  const rows = [...(alerts.results ?? []), ...(readings.results ?? [])]
    .sort((a, b) => b.event_time - a.event_time)
    .slice(0, 1500);

  return { startDate, endDate, rows };
}

export async function loadTemperatureHourlyAverageReport(
  db: DB,
  businessId: string,
  params: { start?: string | null; end?: string | null } = {}
) {
  await ensureTenantSchema(db, true);
  const { startDate, endDate } = clampRange(params.start ?? null, params.end ?? null, 14);

  const rows = await db
    .prepare(
      `
      SELECT
        date(t.ts, 'unixepoch') AS event_date,
        strftime('%H:00', t.ts, 'unixepoch') AS event_hour,
        t.sensor_id,
        COALESCE(sn.name, 'Sensor ' || t.sensor_id) AS sensor_name,
        ROUND(AVG(t.temperature), 2) AS avg_temperature,
        ROUND(MIN(t.temperature), 2) AS min_temperature,
        ROUND(MAX(t.temperature), 2) AS max_temperature,
        COUNT(*) AS reading_count
      FROM temps t
      LEFT JOIN sensor_nodes sn
        ON sn.business_id = t.business_id
        AND sn.sensor_id = t.sensor_id
      WHERE t.business_id = ?
        AND date(t.ts, 'unixepoch') BETWEEN ? AND ?
      GROUP BY event_date, event_hour, t.sensor_id, sensor_name
      ORDER BY event_date DESC, event_hour DESC, sensor_name ASC
      LIMIT 3000
      `
    )
    .bind(businessId, startDate, endDate)
    .all<TemperatureHourlyAverageReportRow>();

  return { startDate, endDate, rows: rows.results ?? [] };
}

export async function loadOnboardingReport(
  db: DB,
  businessId: string,
  params: { start?: string | null; end?: string | null } = {}
) {
  await ensureTenantSchema(db, true);
  const { startDate, endDate } = clampRange(params.start ?? null, params.end ?? null, 60);

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
        COALESCE(SUM(CASE WHEN i.status = 'changes_requested' THEN 1 ELSE 0 END), 0) AS changes_requested_items,
        p.updated_at
      FROM employee_onboarding_packages p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN users approved ON approved.id = p.approved_by
      LEFT JOIN users created ON created.id = p.created_by
      LEFT JOIN employee_onboarding_items i
        ON i.package_id = p.id
        AND i.business_id = p.business_id
      WHERE p.business_id = ?
        AND date(p.updated_at, 'unixepoch') BETWEEN ? AND ?
      GROUP BY p.id, u.display_name, u.email, approved.display_name, approved.email, created.display_name, created.email
      ORDER BY p.updated_at DESC
      LIMIT 1000
      `
    )
    .bind(businessId, startDate, endDate)
    .all<OnboardingReportRow>();

  return { startDate, endDate, rows: rows.results ?? [] };
}

export async function loadWasteReport(
  db: DB,
  businessId: string,
  params: { start?: string | null; end?: string | null; createdAt?: string | number | null } = {}
) {
  await ensureTenantSchema(db, true);
  const { startDate, endDate } = clampRange(params.start ?? null, params.end ?? null, 60);
  const createdAt = Number(params.createdAt);
  const hasCreatedAt = Number.isFinite(createdAt) && createdAt > 0;

  const rows = await db
    .prepare(
      `
      SELECT
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
        AND date(w.created_at, 'unixepoch') BETWEEN ? AND ?
        ${hasCreatedAt ? 'AND w.created_at = ?' : ''}
      ORDER BY w.created_at DESC
      LIMIT 1000
      `
    )
    .bind(businessId, startDate, endDate, ...(hasCreatedAt ? [createdAt] : []))
    .all<WasteReportRow>();

  return { startDate, endDate, rows: rows.results ?? [] };
}
