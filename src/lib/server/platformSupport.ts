import { error } from '@sveltejs/kit';
import { normalizePlainTextInput } from '#lib/server/inputSanitizer.ts';
import { STAFF_CHANGE_AUTHORITY_SQL, staffChangeBindings, type PlatformStaff } from '#lib/server/platformStaff.ts';

type DB = App.RuntimeEnv['DB'];
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from '#lib/support.ts';
type Context = { userId: string; sessionId: string; businessId: string; staff?: PlatformStaff };
type RequestRow = { id: string; business_id: string; business_name: string; requester_user_id: string | null;
  subject: string; category: string; priority: string; status: string; revision: number; source: string; created_at: number; updated_at: number };
const requestColumns = 'r.id, r.business_id, b.name AS business_name, r.requester_user_id, r.subject, r.category, r.priority, r.status, r.revision, r.source, r.created_at, r.updated_at';
const customerAuthority = `EXISTS (SELECT 1 FROM business_users bu JOIN users u ON u.id = bu.user_id
  JOIN sessions s ON s.user_id = u.id WHERE bu.business_id = ? AND bu.user_id = ? AND bu.is_active = 1
    AND COALESCE(u.is_active, 1) = 1 AND s.id = ? AND s.revoked_at IS NULL AND s.expires_at > ?)`;
const text = (value: unknown, maxLength: number, multiline = false) => normalizePlainTextInput(String(value ?? ''), { maxLength, multiline });

export async function readSupportForm(request: Request) {
  const maxBytes = 32 * 1024;
  const contentType = request.headers.get('content-type') ?? '';
  const type = contentType.split(';')[0].trim().toLowerCase();
  if (!['application/x-www-form-urlencoded', 'multipart/form-data'].includes(type)) error(415, 'Send a text support form.');
  if (Number(request.headers.get('content-length')) > maxBytes) error(413, 'Keep the support message under 4,000 characters.');
  const reader = request.body?.getReader();
  if (!reader) error(400, 'Add a support message.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { void reader.cancel().catch(() => {}); error(413, 'Keep the support message under 4,000 characters.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let form: FormData;
  try { form = await new Response(bytes, { headers: { 'content-type': contentType } }).formData(); }
  catch { error(400, 'The support form could not be read.'); }
  if ([...form.values()].some(value => typeof value !== 'string')) error(400, 'Support requests accept text only.');
  return form;
}

function authority(context: Context, now: number) {
  return context.staff
    ? { sql: STAFF_CHANGE_AUTHORITY_SQL, values: staffChangeBindings(context.staff, context.sessionId, now, ['owner', 'support']) }
    : { sql: customerAuthority, values: [context.businessId, context.userId, context.sessionId, now] };
}

export async function customerSupportContext(locals: App.Locals): Promise<Context | null> {
  if (!locals.DB || !locals.userId || !locals.sessionId || !locals.businessId) return null;
  const context = { userId: locals.userId, sessionId: locals.sessionId, businessId: locals.businessId };
  const guard = authority(context, Math.floor(Date.now() / 1000));
  return await locals.DB.prepare(`SELECT 1 AS allowed WHERE ${guard.sql}`).bind(...guard.values).first() ? context : null;
}

export function staffSupportContext(staff: PlatformStaff, sessionId: string, businessId: string): Context {
  if (!['owner', 'support'].includes(staff.role)) error(403, 'Support access required.');
  if (!businessId || businessId.length > 80) error(400, 'Choose a business.');
  return { userId: staff.userId, sessionId, businessId, staff };
}

function readCursor(raw: string | null): [number, string] | null {
  if (!raw) return null;
  try {
    if (raw.length > 300) throw Error();
    const pair = JSON.parse(atob(raw));
    if (!Array.isArray(pair) || pair.length !== 2 || !Number.isSafeInteger(pair[0]) || typeof pair[1] !== 'string' || !pair[1] || pair[1].length > 100) throw Error();
    return pair as [number, string];
  } catch { error(400, 'Refresh the request list.'); }
}

export async function listSupportRequests(db: DB, url: URL, access: { staff: PlatformStaff } | { customer: Context }, businessId?: string) {
  if ('staff' in access && !['owner', 'support'].includes(access.staff.role)) error(403, 'Support access required.');
  const status = url.searchParams.get('status') ?? 'active';
  if (!Object.hasOwn(SUPPORT_STATUSES, status) && !['all', 'active'].includes(status)) error(400, 'Choose a request status.');
  const category = url.searchParams.get('category') ?? '';
  if (category && !Object.hasOwn(SUPPORT_CATEGORIES, category)) error(400, 'Choose a request category.');
  const priority = url.searchParams.get('priority') === 'urgent' ? 'urgent' : '';
  const selected = 'customer' in access ? access.customer.businessId : businessId;
  if (selected && selected.length > 80) error(400, 'Choose a business.');
  const filters: string[] = [];
  const values: (string | number)[] = [];
  if (selected) { filters.push('r.business_id = ?'); values.push(selected); }
  if ('customer' in access) { filters.push('r.requester_user_id = ?'); values.push(access.customer.userId); }
  if (status === 'active') filters.push("r.status IN ('open', 'waiting')");
  else if (status !== 'all') { filters.push('r.status = ?'); values.push(status); }
  if (category) { filters.push('r.category = ?'); values.push(category); }
  if (priority) { filters.push("r.priority = 'urgent'"); }
  const after = readCursor(url.searchParams.get('after'));
  if (after) { filters.push('(r.updated_at, r.id) < (?, ?)'); values.push(...after); }
  const index = !selected && status === 'active' ? 'INDEXED BY idx_support_active_recent' : '';
  const result = await db.prepare(`SELECT ${requestColumns} FROM platform_support_requests r ${index} JOIN businesses b ON b.id = r.business_id
    ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY r.updated_at DESC, r.id DESC LIMIT 21`)
    .bind(...values).all<RequestRow>();
  const last = result.results[19];
  return { requests: result.results.slice(0, 20), status, category, priority,
    next: result.results.length > 20 ? btoa(JSON.stringify([last.updated_at, last.id])) : null };
}

export async function loadSupportRequest(db: DB, id: string, context: Context, url: URL) {
  if (!id || id.length > 100) error(404, 'Request not found.');
  if (context.staff && !['owner', 'support'].includes(context.staff.role)) error(403, 'Support access required.');
  const row = await db.prepare(`SELECT ${requestColumns} FROM platform_support_requests r JOIN businesses b ON b.id = r.business_id
    WHERE r.id = ? AND r.business_id = ? ${context.staff ? '' : 'AND r.requester_user_id = ?'} LIMIT 1`)
    .bind(id, context.businessId, ...(context.staff ? [] : [context.userId])).first<RequestRow>();
  if (!row) error(404, 'Request not found.');
  const contact = context.staff && row.requester_user_id ? await db.prepare(`SELECT u.display_name, u.email FROM users u
    JOIN business_users bu ON bu.user_id = u.id AND bu.business_id = ? WHERE u.id = ? LIMIT 1`)
    .bind(row.business_id, row.requester_user_id).first<{ display_name: string | null; email: string }>() : null;
  const after = readCursor(url.searchParams.get('messagesAfter'));
  // Customer responses never select internal notes, even before rendering or serialization.
  const messages = await db.prepare(`SELECT id, author_type, visibility, body, created_at FROM platform_support_messages
    WHERE business_id = ? AND request_id = ? ${context.staff ? '' : "AND visibility = 'customer'"}
      ${after ? 'AND (created_at, id) < (?, ?)' : ''} ORDER BY created_at DESC, id DESC LIMIT 21`)
    .bind(row.business_id, row.id, ...(after ?? [])).all<{ id: string; author_type: string; visibility: string; body: string; created_at: number }>();
  const last = messages.results[19];
  return { request: row, contact, messages: messages.results.slice(0, 20).reverse(),
    next: messages.results.length > 20 ? btoa(JSON.stringify([last.created_at, last.id])) : null };
}

export async function createSupportRequest(db: DB, context: Context, input: Record<string, unknown>, now = Math.floor(Date.now() / 1000)) {
  const subject = text(input.subject, 160), body = text(input.body, 4000, true), category = text(input.category, 30);
  const submissionId = text(input.submission_id, 100);
  if (!subject || !body || !Object.hasOwn(SUPPORT_CATEGORIES, category) || !/^[a-f0-9-]{36}$/.test(submissionId)) error(400, 'Add a subject, category, and message.');
  const priority = input.priority === 'urgent' ? 'urgent' : 'normal';
  const guard = authority(context, now);
  const id = crypto.randomUUID();
  const statements = [db.prepare(`INSERT INTO platform_support_requests
    (id, business_id, requester_user_id, created_by, submission_id, source, subject, category, priority, created_at, updated_at)
    SELECT ?, b.id, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM businesses b WHERE b.id = ? AND ${guard.sql}
    ON CONFLICT(business_id, created_by, submission_id) DO NOTHING`)
    .bind(id, context.staff ? null : context.userId, context.userId, submissionId, context.staff ? 'staff' : 'customer', subject, category, priority, now, now,
      context.businessId, ...guard.values),
  db.prepare(`INSERT INTO platform_support_messages (id, business_id, request_id, author_user_id, author_type, visibility, body, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`)
    .bind(crypto.randomUUID(), context.businessId, id, context.userId, context.staff ? 'staff' : 'customer', context.staff ? 'internal' : 'customer', body, now)];
  if (context.staff) statements.push(db.prepare(`INSERT INTO platform_staff_audit (id, actor_user_id, action, business_id, reason, created_at)
    SELECT ?, ?, 'support_request_created', ?, ?, ? WHERE changes() = 1`)
    .bind(crypto.randomUUID(), context.userId, context.businessId, `Request ${id}`, now));
  await db.batch(statements);
  const existing = await db.prepare(`SELECT id FROM platform_support_requests WHERE business_id = ? AND created_by = ? AND submission_id = ? AND ${guard.sql}`)
    .bind(context.businessId, context.userId, submissionId, ...guard.values).first<{ id: string }>();
  if (!existing) error(409, 'The request could not be saved. Verify access and try again.');
  return existing.id;
}

export async function updateSupportRequest(db: DB, context: Context, id: string, input: Record<string, unknown>, now = Math.floor(Date.now() / 1000)) {
  const revision = Number(input.revision), body = text(input.body, 4000, true);
  const status = String(input.status ?? 'open'), priority = input.priority === 'urgent' ? 'urgent' : 'normal';
  if (!id || id.length > 100 || !Number.isSafeInteger(revision) || revision < 1 || !Object.hasOwn(SUPPORT_STATUSES, status)) error(400, 'Refresh the request.');
  if (!context.staff && !body) error(400, 'Add a message.');
  const visibility = context.staff && input.visibility === 'internal' ? 'internal' : 'customer';
  const guard = authority(context, now);
  const statements = [db.prepare(`UPDATE platform_support_requests SET revision = revision + 1, updated_at = MAX(updated_at, ?),
      status = ${context.staff ? '?' : "'open'"}${context.staff ? ', priority = ?' : ''}
    WHERE id = ? AND business_id = ? AND revision = ? ${context.staff ? '' : "AND requester_user_id = ? AND status != 'closed'"} AND ${guard.sql}`)
    .bind(now, ...(context.staff ? [status, priority] : []), id, context.businessId, revision, ...(context.staff ? [] : [context.userId]), ...guard.values)];
  if (body) statements.push(db.prepare(`INSERT INTO platform_support_messages (id, business_id, request_id, author_user_id, author_type, visibility, body, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`)
    .bind(crypto.randomUUID(), context.businessId, id, context.userId, context.staff ? 'staff' : 'customer', visibility, body, now));
  if (context.staff) statements.push(db.prepare(`INSERT INTO platform_staff_audit (id, actor_user_id, action, business_id, reason, created_at)
    SELECT ?, ?, 'support_request_updated', ?, ?, ? WHERE changes() = 1`)
    .bind(crypto.randomUUID(), context.userId, context.businessId, `Request ${id}`, now));
  const result = await db.batch(statements);
  if (result[0].meta.changes !== 1) error(409, 'This request changed or is unavailable. Refresh before retrying.');
}
