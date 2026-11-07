import { error } from '@sveltejs/kit';
import type { PlatformStaffRole } from '#lib/server/platformStaff.ts';
import { dashboardWindow, DIAGNOSTIC_AREAS, DIAGNOSTIC_KINDS } from '#lib/server/platformStaffDashboard.ts';
import { TEMPERATURE_ONLINE_WINDOW_SECONDS } from '#lib/server/temperatureMonitoring.ts';

type DB = App.RuntimeEnv['DB'];

export async function loadStaffOverview(db: DB, role: PlatformStaffRole, url: URL, now = Math.floor(Date.now() / 1000)) {
  if (!['owner', 'support', 'equipment'].includes(role)) error(403, 'Staff access required.');
  const window = dashboardWindow(url, now);
  const canViewApplication = role !== 'equipment';
  const businesses = await db.prepare("SELECT COUNT(*) AS total FROM businesses WHERE status = 'active'").first<{ total: number }>();
  const equipment = await db.prepare(`SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN last_seen_at > ? AND last_seen_at <= ? THEN 1 ELSE 0 END), 0) AS online,
      COALESCE(SUM(CASE WHEN COALESCE(last_seen_at, 0) <= 0 THEN 1 ELSE 0 END), 0) AS unconnected,
      COALESCE(SUM(CASE WHEN last_seen_at > 0 AND last_seen_at <= ? THEN 1 ELSE 0 END), 0) AS offline,
      COALESCE(SUM(CASE WHEN last_seen_at > ? THEN 1 ELSE 0 END), 0) AS timestamp_issues,
      COUNT(DISTINCT CASE WHEN COALESCE(last_seen_at, 0) <= ? OR last_seen_at > ? THEN business_id END) AS businesses
    FROM iot_devices WHERE device_type = 'sensor_gateway' AND is_active = 1 AND revoked_at IS NULL`)
    .bind(now - TEMPERATURE_ONLINE_WINDOW_SECONDS, now + 60, now - TEMPERATURE_ONLINE_WINDOW_SECONDS, now + 60,
      now - TEMPERATURE_ONLINE_WINDOW_SECONDS, now + 60)
    .first<{ total: number; online: number; unconnected: number; offline: number; timestamp_issues: number; businesses: number }>();
  const gateways = { total: equipment?.total ?? 0, online: equipment?.online ?? 0, unconnected: equipment?.unconnected ?? 0,
    offline: equipment?.offline ?? 0, timestampIssues: equipment?.timestamp_issues ?? 0,
    attention: (equipment?.total ?? 0) - (equipment?.online ?? 0), businesses: equipment?.businesses ?? 0 };
  if (!canViewApplication) return { ...window, canViewApplication, activeBusinesses: businesses?.total ?? 0, gateways,
    affectedBusinesses: gateways.businesses, groups: [], metrics: null, trend: [], support: null, delivery: null };

  const groups = await db.prepare(`SELECT area, kind, COUNT(*) AS groups, COUNT(DISTINCT business_id) AS businesses,
      MAX(last_seen_at) AS last_seen FROM platform_diagnostic_issues
    WHERE last_seen_at >= ? AND last_seen_at <= ? GROUP BY area, kind ORDER BY businesses DESC, area, kind`)
    .bind(window.since, now).all<{ area: string; kind: string; groups: number; businesses: number; last_seen: number }>();
  const metrics = await db.prepare(`SELECT bucket, success_samples, sample_duration_ms, server_errors, access_denials, slow_requests
    FROM platform_request_metrics WHERE scope_key = 'platform' AND bucket >= ? AND bucket <= ? ORDER BY bucket`)
    .bind(window.since, now).all<{ bucket: number; success_samples: number; sample_duration_ms: number; server_errors: number;
      access_denials: number; slow_requests: number }>();
  const affected = await db.prepare(`SELECT COUNT(*) AS total FROM (
    SELECT business_id FROM platform_diagnostic_issues WHERE last_seen_at >= ? AND last_seen_at <= ? AND business_id IS NOT NULL
    UNION SELECT business_id FROM iot_devices WHERE device_type = 'sensor_gateway' AND is_active = 1 AND revoked_at IS NULL
      AND (COALESCE(last_seen_at, 0) <= ? OR last_seen_at > ?)
    UNION SELECT business_id FROM operational_events WHERE created_at >= ? AND created_at <= ? AND delivery_status = 'failed')`)
    .bind(window.since, now, now - TEMPERATURE_ONLINE_WINDOW_SECONDS, now + 60, window.since, now).first<{ total: number }>();
  const support = await db.prepare(`SELECT status, COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END), 0) AS urgent
    FROM platform_support_requests WHERE status IN ('open', 'waiting') GROUP BY status`)
    .all<{ status: string; total: number; urgent: number }>();
  const delivery = await db.prepare(`SELECT COUNT(*) AS failed, COUNT(DISTINCT business_id) AS businesses FROM operational_events
    WHERE created_at >= ? AND created_at <= ? AND delivery_status = 'failed'`)
    .bind(window.since, now).first<{ failed: number; businesses: number }>();
  const totals = metrics.results.reduce((sum, row) => ({ samples: sum.samples + row.success_samples,
    duration: sum.duration + row.sample_duration_ms, errors: sum.errors + row.server_errors,
    denials: sum.denials + row.access_denials, slow: sum.slow + row.slow_requests }), { samples: 0, duration: 0, errors: 0, denials: 0, slow: 0 });
  const width = window.hours === 168 ? 86400 : 3600;
  // Count a business once per displayed period, not once per error or hour in a daily bucket.
  const impacts = await db.prepare(`SELECT CAST(bucket / ? AS INTEGER) * ? AS at,
      COUNT(DISTINCT business_id) AS businesses FROM platform_request_metrics
    WHERE bucket >= ? AND bucket <= ? AND business_id IS NOT NULL AND server_errors > 0
    GROUP BY at ORDER BY at`).bind(width, width, window.since, now).all<{ at: number; businesses: number }>();
  const impactByTime = new Map(impacts.results.map(row => [row.at, row.businesses]));
  // Empty buckets remain unknown; sampled server timing is not an availability measurement.
  const buckets = new Map<number, { at: number; errors: number; slow: number; samples: number; duration: number; businesses: number }>();
  for (const row of metrics.results) {
    const at = Math.floor(row.bucket / width) * width;
    const bucket = buckets.get(at) ?? { at, errors: 0, slow: 0, samples: 0, duration: 0, businesses: impactByTime.get(at) ?? 0 };
    bucket.errors += row.server_errors; bucket.slow += row.slow_requests;
    bucket.samples += row.success_samples; bucket.duration += row.sample_duration_ms; buckets.set(at, bucket);
  }
  return { ...window, canViewApplication, activeBusinesses: businesses?.total ?? 0, gateways,
    affectedBusinesses: affected?.total ?? 0,
    groups: groups.results.map(row => ({ ...row, areaLabel: DIAGNOSTIC_AREAS[row.area] ?? 'Application',
      kindLabel: DIAGNOSTIC_KINDS[row.kind] ?? 'Recorded Issue' })),
    metrics: { ...totals, averageMs: totals.samples ? Math.round(totals.duration / totals.samples) : null },
    trend: [...buckets.values()], support: { open: support.results.find(row => row.status === 'open')?.total ?? 0,
      waiting: support.results.find(row => row.status === 'waiting')?.total ?? 0,
      urgent: support.results.reduce((sum, row) => sum + row.urgent, 0) },
    delivery: { failed: delivery?.failed ?? 0, businesses: delivery?.businesses ?? 0 } };
}

export async function loadStaffDeliveryIssues(db: DB, role: PlatformStaffRole, url: URL, now = Math.floor(Date.now() / 1000)) {
  if (!['owner', 'support'].includes(role)) error(403, 'Support access required.');
  const window = dashboardWindow(url, now);
  const raw = url.searchParams.get('deliveryAfter');
  let after: [number, string] | null = null;
  if (raw) {
    try { const value = JSON.parse(atob(raw));
      if (raw.length > 300 || !Array.isArray(value) || value.length !== 2 || !Number.isSafeInteger(value[0]) || typeof value[1] !== 'string' || value[1].length > 100) throw Error();
      after = value as [number, string];
    } catch { error(400, 'Refresh the delivery view.'); }
  }
  const rows = await db.prepare(`SELECT e.id, e.business_id, b.name AS business_name, e.created_at, e.delivery_attempts,
      CASE WHEN e.category IN ('schedule', 'lists', 'onboarding', 'billing', 'temperature') THEN e.category ELSE 'other' END AS category
    FROM operational_events e JOIN businesses b ON b.id = e.business_id
    WHERE e.created_at >= ? AND e.created_at <= ? AND e.delivery_status = 'failed'
      ${after ? 'AND (e.created_at, e.id) < (?, ?)' : ''} ORDER BY e.created_at DESC, e.id DESC LIMIT 21`)
    .bind(window.since, now, ...(after ?? [])).all<{ id: string; business_id: string; business_name: string; created_at: number; delivery_attempts: number; category: string }>();
  const last = rows.results[19];
  return { ...window, rows: rows.results.slice(0, 20), next: rows.results.length > 20 ? btoa(JSON.stringify([last.created_at, last.id])) : null };
}
