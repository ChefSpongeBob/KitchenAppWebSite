import { error } from '@sveltejs/kit';
import type { PlatformStaffRole } from '#lib/server/platformStaff.ts';
import { gatewayConnection } from '#lib/server/platformHealth.ts';
import { TEMPERATURE_ONLINE_WINDOW_SECONDS } from '#lib/server/temperatureMonitoring.ts';

type DB = App.RuntimeEnv['DB'];
type Cursor = { at: number; id: string } | null;
export const DIAGNOSTIC_AREAS: Record<string, string> = { application: 'Application', lists: 'Lists', recipes: 'Recipes',
  documents: 'Documents & Menus', scheduling: 'Scheduling', temperature: 'Temperature', accounts: 'Accounts',
  people: 'People & HR', billing: 'Billing', announcements: 'Announcements' };
export const DIAGNOSTIC_KINDS: Record<string, string> = { server_error: 'Request Failed', access_denied: 'Access Denied', slow_request: 'Slow Response' };
const PAGE_SIZE = 20;

function cursor(value: string | null): Cursor {
  if (!value) return null;
  try {
    if (value.length > 300) throw Error();
    const pair = JSON.parse(atob(value));
    if (!Array.isArray(pair) || pair.length !== 2 || !Number.isSafeInteger(pair[0]) ||
      typeof pair[1] !== 'string' || !pair[1] || pair[1].length > 100) throw Error();
    return { at: pair[0], id: pair[1] };
  } catch { error(400, 'Refresh this view and try again.'); }
}
function nextCursor(rows: { id: string; at: number }[]) {
  const row = rows[PAGE_SIZE - 1];
  return rows.length > PAGE_SIZE && row ? btoa(JSON.stringify([row.at, row.id])) : null;
}

export function dashboardWindow(url: URL, now = Math.floor(Date.now() / 1000)) {
  const hours = [1, 24, 168].includes(Number(url.searchParams.get('hours'))) ? Number(url.searchParams.get('hours')) : 24;
  // Metrics are hourly aggregates; use the same closed/open bucket boundaries throughout a view.
  const since = Math.floor(now / 3600) * 3600 - (hours - 1) * 3600;
  return { hours, since, checkedAt: now };
}

type IssueRow = { id: string; business_id: string | null; business_name: string | null; area: string; route_id: string;
  operation: string; kind: string; status: number; occurrences: number; first_seen_at: number; last_seen_at: number;
  max_duration_ms: number; last_request_id: string };

export async function loadRequestDiagnostics(db: DB, role: PlatformStaffRole, url: URL, businessId?: string,
  now = Math.floor(Date.now() / 1000)) {
  const window = dashboardWindow(url, now);
  const area = Object.hasOwn(DIAGNOSTIC_AREAS, url.searchParams.get('area') ?? '') ? url.searchParams.get('area')! : '';
  const kind = Object.hasOwn(DIAGNOSTIC_KINDS, url.searchParams.get('kind') ?? '') ? url.searchParams.get('kind')! : '';
  if (role === 'equipment') return { ...window, area, kind, issues: [], next: null, metrics: null, canViewApplication: false };
  if (!['owner', 'support'].includes(role)) error(403, 'Staff access required.');
  const after = cursor(url.searchParams.get('after'));
  const filters = ['i.last_seen_at >= ?', 'i.last_seen_at <= ?'];
  const values: (string | number)[] = [window.since, now];
  if (businessId) { filters.push('i.business_id = ?'); values.push(businessId); }
  if (area) { filters.push('i.area = ?'); values.push(area); }
  if (kind) { filters.push('i.kind = ?'); values.push(kind); }
  if (after) { filters.push('(i.last_seen_at, i.id) < (?, ?)'); values.push(after.at, after.id); }
  const rows = await db.prepare(`SELECT i.id, i.business_id, b.name AS business_name, i.area, i.route_id, i.operation,
      i.kind, i.status, i.occurrences, i.first_seen_at, i.last_seen_at, i.max_duration_ms, i.last_request_id
    FROM platform_diagnostic_issues i LEFT JOIN businesses b ON b.id = i.business_id
    WHERE ${filters.join(' AND ')} ORDER BY i.last_seen_at DESC, i.id DESC LIMIT 21`)
    .bind(...values).all<IssueRow>();
  const metrics = await db.prepare(`SELECT COALESCE(SUM(success_samples), 0) AS samples,
      COALESCE(SUM(sample_duration_ms), 0) AS duration, COALESCE(MAX(sample_max_ms), 0) AS max_ms,
      COALESCE(SUM(server_errors), 0) AS errors, COALESCE(SUM(access_denials), 0) AS denials,
      COALESCE(SUM(slow_requests), 0) AS slow, MAX(bucket) AS latest_bucket
    FROM platform_request_metrics WHERE scope_key = ? AND bucket >= ? AND bucket <= ?`)
    .bind(businessId ? `business:${businessId}` : 'platform', window.since, now)
    .first<{ samples: number; duration: number; max_ms: number; errors: number; denials: number; slow: number; latest_bucket: number | null }>();
  return { ...window, area, kind, canViewApplication: true,
    issues: rows.results.slice(0, PAGE_SIZE).map(row => ({ ...row,
      areaLabel: DIAGNOSTIC_AREAS[row.area] ?? 'Application', kindLabel: DIAGNOSTIC_KINDS[row.kind] ?? 'Request Issue' })),
    next: nextCursor(rows.results.map(row => ({ id: row.id, at: row.last_seen_at }))),
    metrics: metrics ? { samples: metrics.samples, averageMs: metrics.samples ? Math.round(metrics.duration / metrics.samples) : null,
      maxMs: metrics.samples ? metrics.max_ms : null, errors: metrics.errors, denials: metrics.denials,
      slow: metrics.slow, latestBucket: metrics.latest_bucket } : null };
}

export async function loadGatewayAttention(db: DB, url: URL, businessId?: string, now = Math.floor(Date.now() / 1000)) {
  const after = cursor(url.searchParams.get('gatewaysAfter'));
  const filters = ["d.device_type = 'sensor_gateway'", 'd.is_active = 1', 'd.revoked_at IS NULL'];
  const values: (number | string)[] = [];
  if (businessId) { filters.push('d.business_id = ?'); values.push(businessId); }
  if (after) { filters.push('COALESCE(d.last_seen_at, 0) >= ? AND (COALESCE(d.last_seen_at, 0), d.id) > (?, ?)'); values.push(after.at, after.at, after.id); }
  const columns = 'd.id, d.business_id, d.display_name, d.external_device_id, d.last_seen_at';
  const base = `SELECT ${columns} FROM iot_devices d WHERE ${filters.join(' AND ')}`;
  const query = businessId
    ? `SELECT ${columns}, b.name AS business_name FROM iot_devices d JOIN businesses b ON b.id = d.business_id
       WHERE ${filters.join(' AND ')} ORDER BY COALESCE(d.last_seen_at, 0), d.id LIMIT 21`
    : `WITH offline AS (${base} AND COALESCE(d.last_seen_at, 0) <= ? ORDER BY COALESCE(d.last_seen_at, 0), d.id LIMIT 21),
       future AS (${base} AND COALESCE(d.last_seen_at, 0) > ? ORDER BY COALESCE(d.last_seen_at, 0), d.id LIMIT 21)
       SELECT d.*, b.name AS business_name FROM (SELECT * FROM offline UNION ALL SELECT * FROM future) d
       JOIN businesses b ON b.id = d.business_id ORDER BY COALESCE(d.last_seen_at, 0), d.id LIMIT 21`;
  const bindings = businessId ? values : [...values, now - TEMPERATURE_ONLINE_WINDOW_SECONDS, ...values, now + 60];
  const result = await db.prepare(query).bind(...bindings).all<{ id: string; business_id: string; business_name: string; display_name: string;
      external_device_id: string; last_seen_at: number | null }>();
  return { gateways: result.results.slice(0, PAGE_SIZE).map(row => ({ ...row, connection: gatewayConnection(row.last_seen_at, now) })),
    next: nextCursor(result.results.map(row => ({ id: row.id, at: row.last_seen_at ?? 0 }))) };
}

export async function loadRecentStaffActivity(db: DB, businessId?: string, now = Math.floor(Date.now() / 1000)) {
  const result = await db.prepare(`SELECT id, action, business_id, target_user_id, created_at FROM platform_staff_audit
    WHERE created_at >= ? ${businessId ? 'AND business_id = ?' : ''} ORDER BY created_at DESC, id DESC LIMIT 8`)
    .bind(now - 7 * 86400, ...(businessId ? [businessId] : []))
    .all<{ id: string; action: string; business_id: string | null; target_user_id: string | null; created_at: number }>();
  return result.results;
}

const securityActions = { invite_created: 'Invitation Created', invite_revoked: 'Invitation Revoked',
  invite_rate_limited: 'Invitation Rate Limited', business_capabilities_updated: 'Permissions Changed',
  user_deleted_from_business: 'Business Membership Removed', admin_revoked_user_sessions: 'Account Sessions Revoked',
  login_failed_bad_password: 'Sign-in Failed', login_rate_limited: 'Sign-in Rate Limited', login_success: 'Signed In',
  business_position_created: 'Position Created', business_position_updated: 'Position Permissions Changed', business_position_assigned: 'Position Assigned' };

export async function loadBusinessSecurity(db: DB, role: PlatformStaffRole, businessId: string, url: URL,
  now = Math.floor(Date.now() / 1000)) {
  if (role !== 'owner') error(403, 'Platform owner access required.');
  const { since, hours } = dashboardWindow(url, now);
  const after = cursor(url.searchParams.get('securityAfter'));
  const values: (string | number)[] = [businessId, since, now];
  const actionNames = Object.keys(securityActions);
  values.push(...actionNames);
  if (after) values.push(after.at, after.id);
  const audit = await db.prepare(`SELECT a.id, a.action, a.actor_user_id, a.target_user_id, a.created_at,
      CASE WHEN actor.user_id IS NOT NULL THEN u.display_name ELSE NULL END AS actor_name
    FROM account_audit_logs a
    LEFT JOIN business_users actor ON actor.business_id = a.business_id AND actor.user_id = a.actor_user_id
    LEFT JOIN users u ON u.id = actor.user_id
    WHERE a.business_id = ? AND a.created_at >= ? AND a.created_at <= ?
      AND a.action IN (${actionNames.map(() => '?').join(',')})
      ${after ? 'AND (a.created_at, a.id) < (?, ?)' : ''}
    ORDER BY a.created_at DESC, a.id DESC LIMIT 21`)
    .bind(...values).all<{ id: string; action: string; actor_user_id: string | null; target_user_id: string | null;
      created_at: number; actor_name: string | null }>();
  const publications = await db.prepare(`SELECT h.id, h.created_by, h.created_at,
      CASE WHEN member.user_id IS NOT NULL THEN u.display_name ELSE NULL END AS actor_name
    FROM announcement_history h LEFT JOIN business_users member ON member.business_id = h.business_id AND member.user_id = h.created_by
    LEFT JOIN users u ON u.id = member.user_id WHERE h.business_id = ? AND h.created_at >= ? AND h.created_at <= ?
    ORDER BY h.created_at DESC, h.id DESC LIMIT 10`).bind(businessId, since, now)
    .all<{ id: string; created_by: string | null; created_at: number; actor_name: string | null }>();
  return { hours, events: audit.results.slice(0, PAGE_SIZE).map(row => ({ ...row,
    action: (securityActions as Record<string, string>)[row.action] ?? 'Account Activity' })),
    next: nextCursor(audit.results.map(row => ({ id: row.id, at: row.created_at }))), publications: publications.results };
}
