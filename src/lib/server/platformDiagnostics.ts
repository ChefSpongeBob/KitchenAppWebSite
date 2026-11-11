import { sha256Hex } from '#lib/server/auth.ts';
import { safeLogPath } from '#lib/server/observability.ts';

type DB = App.RuntimeEnv['DB'];
export const DIAGNOSTIC_ISSUE_DAYS = 14;
export const DIAGNOSTIC_METRIC_DAYS = 7;
export const SLOW_REQUEST_MS = 2000;
export const SUCCESS_SAMPLE_RATE = 0.01;
const publicErrorTimes = new Map<string, number>();

const creatorOperations = new Set(['add_list_item', 'update_list_item', 'delete_list_item', 'add_checklist_item',
  'update_checklist_item', 'delete_checklist_item', 'update_list_section', 'delete_list_section',
  'create_checklist_category', 'create_list_section', 'create_creator_category', 'create_recipe', 'update_recipe',
  'delete_recipe', 'create_document', 'update_document', 'delete_document', 'create_item_attachment',
  'attach_target_to_item', 'delete_item_attachment', 'save_announcement']);

export function diagnosticArea(route: string, operation = '') {
  if (/list|checklist/.test(operation) || /\/(lists|preplists|inventory|orders|checklists)(\/|$)/.test(route)) return 'lists';
  if (/recipe/.test(operation) || route.startsWith('/recipes')) return 'recipes';
  if (/document/.test(operation) || /\/(docs|menu)(\/|$)/.test(route)) return 'documents';
  if (/schedule/.test(route)) return 'scheduling';
  if (/temper|sensors|\/api\/temps/.test(route)) return 'temperature';
  if (/login|register|password|logout/.test(route)) return 'accounts';
  if (/onboarding|\/admin\/users|\/admin\/employees/.test(route)) return 'people';
  if (/billing/.test(route)) return 'billing';
  if (/announcement/.test(operation)) return 'announcements';
  return 'application';
}

export type DiagnosticRequest = { locals: App.Locals; request: Request; url: URL; route?: { id: string | null } };

export async function recordRequestDiagnostic(event: DiagnosticRequest, status: number, durationMs: number,
  options: { now?: number; random?: number } = {}) {
  const db = event.locals.DB;
  const route = safeLogPath(event.route?.id);
  if (!db || !route || !route.startsWith('/') || route.startsWith('/staff') || route.startsWith('/api/internal/') || route.startsWith('/_app/')) return;
  const businessId = event.locals.businessId ?? null; // Only established server-side membership supplies tenant context.
  const elapsed = Math.max(0, Math.min(300_000, Math.round(Number.isFinite(durationMs) ? durationMs : 0)));
  const kind = status >= 500 ? 'server_error' : status === 401 || status === 403 ? 'access_denied' : elapsed >= SLOW_REQUEST_MS ? 'slow_request' : null;
  // Anonymous denials stay in edge/server security logs, not a new per-probe D1 write path.
  if (!businessId && kind !== 'server_error') return;
  // Public errors are recorded, but anonymous requests cannot create a tenant-specific performance sample.
  const sampled = Boolean(businessId && status >= 200 && status < 300 &&
    (options.random ?? crypto.getRandomValues(new Uint32Array(1))[0] / 4_294_967_296) < SUCCESS_SAMPLE_RATE);
  if (!kind && !sampled) return;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (!businessId) {
    if (now - (publicErrorTimes.get(route) ?? 0) < 10) return;
    if (publicErrorTimes.size >= 128) publicErrorTimes.delete(publicErrorTimes.keys().next().value!);
    publicErrorTimes.set(route, now);
  }
  const bucket = Math.floor(now / 3600) * 3600;
  const operation = [...event.url.searchParams.keys()].map(key => key.replace(/^\//, '')).find(key => creatorOperations.has(key)) ?? event.request.method;
  const area = diagnosticArea(route, operation);
  const statements = [];
  if (kind) {
    const id = await sha256Hex(JSON.stringify([businessId, route, operation, kind, Math.floor(status / 100)]));
    const ray = event.request.headers.get('cf-ray') ?? '';
    const reference = /^[a-f0-9]{16,32}(?:-[a-z]{3})?$/i.test(ray) ? ray : crypto.randomUUID();
    statements.push(db.prepare(`INSERT INTO platform_diagnostic_issues
      (id, business_id, area, route_id, operation, kind, status, first_seen_at, last_seen_at, max_duration_ms, last_request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET occurrences = occurrences + 1, last_seen_at = MAX(last_seen_at, excluded.last_seen_at),
        status = excluded.status, max_duration_ms = MAX(max_duration_ms, excluded.max_duration_ms), last_request_id = excluded.last_request_id`)
      .bind(id, businessId, area, route.slice(0, 250), operation, kind, status, now, now, elapsed, reference));
    console.warn(JSON.stringify({ event: 'platform_diagnostic_recorded', request_id: reference, business_id: businessId,
      route, operation, kind, status }));
  }
  const scopes = [{ key: 'platform', businessId: null as string | null }, ...(businessId ? [{ key: `business:${businessId}`, businessId }] : [])];
  for (const scope of scopes) {
    statements.push(db.prepare(`INSERT INTO platform_request_metrics
      (scope_key, business_id, bucket, success_samples, sample_duration_ms, sample_max_ms, server_errors, access_denials, slow_requests)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(scope_key, bucket) DO UPDATE SET success_samples = success_samples + excluded.success_samples,
        sample_duration_ms = sample_duration_ms + excluded.sample_duration_ms,
        sample_max_ms = MAX(sample_max_ms, excluded.sample_max_ms), server_errors = server_errors + excluded.server_errors,
        access_denials = access_denials + excluded.access_denials, slow_requests = slow_requests + excluded.slow_requests`)
      .bind(scope.key, scope.businessId, bucket, sampled ? 1 : 0, sampled ? elapsed : 0, sampled ? elapsed : 0,
        kind === 'server_error' ? 1 : 0, kind === 'access_denied' ? 1 : 0, elapsed >= SLOW_REQUEST_MS ? 1 : 0));
  }
  await db.batch(statements);
}

export async function cleanupPlatformDiagnostics(db: DB, now = Math.floor(Date.now() / 1000)) {
  const summary = { issuesRemoved: 0, metricBucketsRemoved: 0, batches: 0 };
  // Drain larger fleets in bounded indexed batches without an unbounded cleanup job.
  for (let batch = 0; batch < 10; batch++) {
    const result = await db.batch([
      db.prepare(`DELETE FROM platform_diagnostic_issues WHERE id IN
        (SELECT id FROM platform_diagnostic_issues WHERE last_seen_at < ? ORDER BY last_seen_at LIMIT 2000)`)
        .bind(now - DIAGNOSTIC_ISSUE_DAYS * 86400),
      db.prepare(`DELETE FROM platform_request_metrics WHERE (scope_key, bucket) IN
        (SELECT scope_key, bucket FROM platform_request_metrics WHERE bucket < ? ORDER BY bucket LIMIT 2000)`)
        .bind(Math.floor((now - DIAGNOSTIC_METRIC_DAYS * 86400) / 3600) * 3600)
    ]);
    summary.issuesRemoved += result[0].meta.changes;
    summary.metricBucketsRemoved += result[1].meta.changes;
    summary.batches++;
    if (result[0].meta.changes < 2000 && result[1].meta.changes < 2000) break;
  }
  return summary;
}
