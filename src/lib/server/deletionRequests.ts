import { error } from '@sveltejs/kit';
import { DELETION_REVIEW_STATUSES, type DeletionReviewStatus } from '#lib/deletionRequests.ts';
import { requirePlatformStaff, requireStaffStepUp, STAFF_CHANGE_AUTHORITY_SQL,
  STAFF_SESSION_SECONDS, STAFF_STEP_UP_SECONDS } from '#lib/server/platformStaff.ts';

type ReviewRow = { id: string; email: string; workspace_name: string | null; request_scope: string;
  status: string; created_at: number; updated_at: number; review_revision: number };
type ReviewDetail = ReviewRow & { details: string | null; requester_user_id: string | null;
  requester_business_id: string | null; business_name: string | null; reviewed_at: number | null;
  reviewed_by: string | null };
const columns = 'r.id, r.email, r.workspace_name, r.request_scope, r.status, r.created_at, r.updated_at, r.review_revision';
const validStatus = (value: string): value is DeletionReviewStatus => Object.hasOwn(DELETION_REVIEW_STATUSES, value);

function bindings(locals: App.Locals, now: number, write = false) {
  return [locals.userId!, locals.sessionId!, now,
    now - (write ? STAFF_STEP_UP_SECONDS : STAFF_SESSION_SECONDS), now, 'owner', 'owner'];
}

function requestId(id: string) {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) error(404, 'Request not found.');
  return id;
}

function cursor(raw: string | null): [number, string] | null {
  if (!raw) return null;
  try {
    if (raw.length > 300) throw Error();
    const value: unknown = JSON.parse(atob(raw));
    if (!Array.isArray(value) || value.length !== 2 || !Number.isSafeInteger(value[0]) || value[0] < 0 ||
      typeof value[1] !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(value[1])) throw Error();
    return value as [number, string];
  } catch { error(400, 'Refresh the request list.'); }
}

export async function listDeletionRequests(locals: App.Locals, url: URL) {
  await requirePlatformStaff(locals, ['owner']);
  const status = url.searchParams.get('status') ?? 'pending';
  if (status !== 'all' && !validStatus(status)) error(400, 'Choose a request status.');
  const after = cursor(url.searchParams.get('after'));
  const now = Math.floor(Date.now() / 1000);
  const result = await locals.DB.prepare(`SELECT ${columns} FROM account_deletion_requests r
    WHERE ${STAFF_CHANGE_AUTHORITY_SQL} ${status === 'all' ? '' : 'AND r.status = ?'}
      ${after ? 'AND (r.created_at, r.id) > (?, ?)' : ''}
    ORDER BY r.created_at, r.id LIMIT 21`)
    .bind(...bindings(locals, now), ...(status === 'all' ? [] : [status]), ...(after ?? []))
    .all<ReviewRow>();
  const last = result.results[19];
  return { requests: result.results.slice(0, 20), status,
    next: result.results.length > 20 ? btoa(JSON.stringify([last.created_at, last.id])) : null };
}

export async function loadDeletionRequest(locals: App.Locals, id: string) {
  await requirePlatformStaff(locals, ['owner']);
  requestId(id);
  const auditId = crypto.randomUUID(), now = Math.floor(Date.now() / 1000);
  // Details can contain sensitive free text. Log only the request reference, atomically with the read.
  const results = await locals.DB.batch([
    locals.DB.prepare(`INSERT INTO platform_staff_audit (id, actor_user_id, action, business_id, reason, created_at)
      SELECT ?, ?, 'deletion_request_viewed', r.requester_business_id, ?, ? FROM account_deletion_requests r
      WHERE r.id = ? AND ${STAFF_CHANGE_AUTHORITY_SQL}`)
      .bind(auditId, locals.userId!, `Request ${id}`, now, id, ...bindings(locals, now)),
    locals.DB.prepare(`SELECT ${columns}, r.details, r.requester_user_id, r.requester_business_id,
        b.name AS business_name, r.reviewed_at, r.reviewed_by
      FROM account_deletion_requests r LEFT JOIN businesses b ON b.id = r.requester_business_id
      WHERE r.id = ? AND EXISTS (SELECT 1 FROM platform_staff_audit WHERE id = ? AND actor_user_id = ?)`)
      .bind(id, auditId, locals.userId!)
  ]);
  const record = results[1].results?.[0] as ReviewDetail | undefined;
  if (!record) error(404, 'Request not found.');
  return record;
}

export async function reviewDeletionRequest(locals: App.Locals, id: string, input: FormData) {
  await requireStaffStepUp(locals, ['owner']);
  requestId(id);
  const revision = Number(input.get('review_revision'));
  const status = String(input.get('status') ?? '');
  if (!Number.isSafeInteger(revision) || revision < 1 || !validStatus(status)) error(400, 'Refresh the request and choose a status.');
  const auditId = crypto.randomUUID(), now = Math.floor(Date.now() / 1000);
  const result = await locals.DB.batch([
    locals.DB.prepare(`UPDATE account_deletion_requests SET status = ?, review_revision = review_revision + 1,
        reviewed_at = ?, reviewed_by = ?, updated_at = MAX(updated_at, ?)
      WHERE id = ? AND review_revision = ? AND ${STAFF_CHANGE_AUTHORITY_SQL}`)
      .bind(status, now, locals.userId!, now, id, revision, ...bindings(locals, now, true)),
    locals.DB.prepare(`INSERT INTO platform_staff_audit (id, actor_user_id, action, business_id, reason, created_at)
      SELECT ?, ?, 'deletion_request_reviewed', requester_business_id, ?, ? FROM account_deletion_requests
      WHERE id = ? AND changes() = 1`)
      .bind(auditId, locals.userId!, `Request ${id}; status ${status}`, now, id)
  ]);
  if (result[0].meta.changes !== 1) error(409, 'This request or your access changed. Refresh before saving.');
}
