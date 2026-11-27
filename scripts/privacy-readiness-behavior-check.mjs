import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import * as serverRuntime from 'svelte/internal/server';
import { createTestD1, formRequest, loadServerModules } from './helpers/test-d1.mjs';

const now = Math.floor(Date.now() / 1000);
const privateText = 'PRIVATE-REQUEST employee@example.invalid bank 123456789 tax 999-00-1111';
const origin = 'https://criminiops.com';
let failures = 0;
function fixture() {
  const test = createTestD1();
  const insert = (table, row) => {
    const keys = Object.keys(row);
    test.sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
  };
  for (const id of ['a', 'b']) insert('businesses', { id, name: 'Restaurant ' + id, slug: id, created_at: now, updated_at: now });
  for (const id of ['owner', 'support', 'equipment', 'manager', 'employee']) {
    insert('users', { id, email: id + '@example.invalid', email_normalized: id + '@example.invalid', created_at: now, updated_at: now });
    insert('business_users', { business_id: 'a', user_id: id, role: id === 'manager' ? 'owner' : 'employee', created_at: now, updated_at: now });
    insert('sessions', { id: id + '-session', user_id: id, session_token_hash: 'fixture-' + id, created_at: now, last_seen_at: now, expires_at: now + 3600 });
    if (['owner', 'support', 'equipment'].includes(id)) {
      insert('platform_staff_members', { user_id: id, staff_role: id, created_at: now, updated_at: now });
      insert('platform_staff_step_up', { session_id: id + '-session', user_id: id, membership_revision: 1, verified_at: now, email_verified_at: now });
    }
  }
  for (const id of ['a', 'b', 'anonymous']) insert('account_deletion_requests', { id: 'request-' + id,
    email: id + '@example.invalid', workspace_name: 'Supplied ' + id, request_scope: id === 'b' ? 'workspace' : 'user',
    details: privateText, requester_user_id: id === 'anonymous' ? null : 'employee',
    requester_business_id: id === 'anonymous' ? null : id, created_at: now, updated_at: now });
  const locals = user => ({ DB: test.db, userId: user, sessionId: user + '-session', businessId: 'a', businessRole: 'owner' });
  const load = loadServerModules();
  const review = load('src/lib/server/deletionRequests.ts');
  const form = (status = 'in_review', revision = 1) => { const data = new FormData(); data.set('status', status); data.set('review_revision', String(revision)); return data; };
  const state = () => ['users', 'businesses', 'business_users', 'sessions'].map(table => test.sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all());
  return { ...test, insert, locals, load, review, form, state };
}
async function check(label, run) {
  const t = fixture();
  try { await run(t); console.log('PASS ' + label); }
  catch (err) { failures++; console.error('FAIL ' + label, err); }
  finally { t.close(); }
}
async function capture(run) {
  const old = { log: console.log, warn: console.warn, error: console.error }, lines = [];
  for (const key of Object.keys(old)) console[key] = (...args) => lines.push(args);
  try { return { result: await run(), lines }; } finally { Object.assign(console, old); }
}
const url = path => new URL(origin + path);

await check('only verified platform owners can read or review; restaurant owners, support/equipment and anonymous denied', async t => {
  for (const user of ['support', 'equipment', 'manager', 'employee', undefined]) {
    const locals = user ? t.locals(user) : { DB: t.db };
    for (const run of [() => t.review.listDeletionRequests(locals, url('/staff/deletion-requests')),
      () => t.review.loadDeletionRequest(locals, 'request-a'),
      () => t.review.reviewDeletionRequest(locals, 'request-a', t.form())]) {
      await assert.rejects(run(), err => [401, 403].includes(err.status));
    }
  }
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM platform_staff_audit WHERE action LIKE 'deletion_request_%'").get().n, 0);
  const rows = await t.review.listDeletionRequests(t.locals('owner'), url('/staff/deletion-requests'));
  assert.equal(rows.requests.length, 3);
  assert.equal(JSON.stringify(rows).includes(privateText), false);
  assert.equal(JSON.stringify(rows).includes('ip_hash'), false);
});

await check('oldest-first bounded keyset pagination keeps same-second requests once, with indexed queries and no details in listing', async t => {
  for (let i = 0; i < 45; i++) t.insert('account_deletion_requests', { id: 'fleet-' + String(i).padStart(3, '0'), email: 'fixture@example.invalid',
    details: privateText, created_at: now - 1, updated_at: now });
  const found = [];
  let next;
  do {
    const result = await t.review.listDeletionRequests(t.locals('owner'), url('/staff/deletion-requests' + (next ? '?after=' + encodeURIComponent(next) : '')));
    assert.ok(result.requests.length <= 20); assert.equal(JSON.stringify(result).includes(privateText), false);
    found.push(...result.requests.map(row => row.id)); next = result.next;
  } while (next);
  assert.equal(found.length, 48); assert.equal(new Set(found).size, 48); assert.equal(found[0], 'fleet-000');
  for (const suffix of ['?after=bad', '?status=constructor', '?status=invalid', '?after=' + btoa('[0,"bad/id"]')]) {
    await assert.rejects(t.review.listDeletionRequests(t.locals('owner'), url('/staff/deletion-requests' + suffix)), { status: 400 });
  }
  for (const [sql, args, index] of [
    ['SELECT id FROM account_deletion_requests WHERE status=? AND (created_at,id)>(?,?) ORDER BY created_at,id LIMIT 21', ['pending', 0, ''], 'idx_account_deletion_requests_status_created'],
    ['SELECT id FROM account_deletion_requests WHERE (created_at,id)>(?,?) ORDER BY created_at,id LIMIT 21', [0, ''], 'idx_account_deletion_requests_created']
  ]) assert.ok(t.sqlite.prepare('EXPLAIN QUERY PLAN ' + sql).all(...args).some(row => row.detail.includes(index)));
});

await check('detail reads are audit-coupled, preserve anonymous requests, do not trust supplied workspace, and never expose audit hashes', async t => {
  const record = await t.review.loadDeletionRequest(t.locals('owner'), 'request-b');
  assert.equal(record.details, privateText); assert.equal(record.business_name, 'Restaurant b');
  assert.equal(record.workspace_name, 'Supplied b');
  assert.equal('ip_hash' in record, false); assert.equal('user_agent_hash' in record, false);
  assert.equal((await t.review.loadDeletionRequest(t.locals('owner'), 'request-anonymous')).business_name, null);
  const audits = t.sqlite.prepare("SELECT * FROM platform_staff_audit WHERE action LIKE 'deletion_request_%'").all();
  assert.equal(audits.length, 2); assert.equal(audits[0].action, 'deletion_request_viewed');
  assert.equal(JSON.stringify(audits).includes(privateText), false);
  await assert.rejects(t.review.loadDeletionRequest(t.locals('owner'), "' OR 1=1--"), { status: 404 });
  await assert.rejects(t.review.loadDeletionRequest(t.locals('owner'), 'missing'), { status: 404 });
  t.sqlite.exec("CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON platform_staff_audit BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
  await assert.rejects(t.review.loadDeletionRequest(t.locals('owner'), 'request-a'));
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM platform_staff_audit WHERE action LIKE 'deletion_request_%'").get().n, 2);
});

await check('review changes only status metadata, atomically audits, rejects competing same-second updates and never purges either tenant', async t => {
  const before = t.state();
  await t.review.reviewDeletionRequest(t.locals('owner'), 'request-b', t.form('awaiting_verification'));
  await assert.rejects(t.review.reviewDeletionRequest(t.locals('owner'), 'request-b', t.form('closed')), { status: 409 });
  await t.review.reviewDeletionRequest(t.locals('owner'), 'request-b', t.form('closed', 2));
  const row = t.sqlite.prepare("SELECT * FROM account_deletion_requests WHERE id='request-b'").get();
  assert.equal(row.review_revision, 3); assert.equal(row.status, 'closed'); assert.equal(row.reviewed_by, 'owner');
  assert.equal(row.details, privateText); assert.deepEqual(t.state(), before);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_deletion_requests').get().n, 3);
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM platform_staff_audit WHERE action LIKE 'deletion_request_%'").get().n, 2);
  for (const invalid of [t.form('verified'), t.form('completed'), t.form('constructor'), t.form('in_review', 0)]) {
    await assert.rejects(t.review.reviewDeletionRequest(t.locals('owner'), 'request-a', invalid), { status: 400 });
  }
});

await check('review/audit rollback and session/revision/OTP changes are fail-closed, including changes after initial authorization', async t => {
  t.sqlite.exec("CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON platform_staff_audit BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
  await assert.rejects(t.review.reviewDeletionRequest(t.locals('owner'), 'request-a', t.form()));
  assert.equal(t.sqlite.prepare("SELECT review_revision FROM account_deletion_requests WHERE id='request-a'").get().review_revision, 1);
  t.sqlite.exec('DROP TRIGGER fixture_audit_failure');
  t.sqlite.prepare("UPDATE platform_staff_step_up SET verified_at=?,email_verified_at=? WHERE user_id='owner'").run(now - 901, now - 901);
  assert.equal((await t.review.listDeletionRequests(t.locals('owner'), url('/staff/deletion-requests'))).requests.length, 3);
  await assert.rejects(t.review.reviewDeletionRequest(t.locals('owner'), 'request-a', t.form()), { status: 403 });
  t.sqlite.prepare("UPDATE platform_staff_step_up SET verified_at=?,email_verified_at=? WHERE user_id='owner'").run(now, now);
  const batch = t.db.batch;
  t.db.batch = async statements => { t.sqlite.exec("UPDATE sessions SET revoked_at=1 WHERE user_id='owner'"); return batch(statements); };
  await assert.rejects(t.review.reviewDeletionRequest(t.locals('owner'), 'request-a', t.form()), { status: 409 });
  assert.equal(t.sqlite.prepare("SELECT status FROM account_deletion_requests WHERE id='request-a'").get().status, 'pending');
  t.db.batch = batch;
  t.sqlite.exec("UPDATE sessions SET revoked_at=NULL WHERE user_id='owner'; UPDATE platform_staff_members SET revision=revision+1 WHERE user_id='owner'");
  await assert.rejects(t.review.listDeletionRequests(t.locals('owner'), url('/staff/deletion-requests')), { status: 403 });
  t.sqlite.exec("UPDATE platform_staff_step_up SET membership_revision=2 WHERE user_id='owner'; UPDATE sessions SET revoked_at=1 WHERE user_id='owner'");
  await assert.rejects(t.review.listDeletionRequests(t.locals('owner'), url('/staff/deletion-requests')), { status: 403 });
});

await check('real deletion action saves once despite receipt throws/rejection, suppresses raw personal/provider/SQL text and keeps production rate limit fail-closed', async t => {
  const security = t.load('src/lib/server/security.ts');
  const event = () => ({ request: formRequest({ email: 'employee@example.invalid', workspace_name: 'Supplied', details: privateText }, '/account-deletion'),
    locals: { DB: t.db }, url: url('/account-deletion'), getClientAddress: () => '192.0.2.70' });
  for (const mode of ['throw', 'reject']) {
    const route = loadServerModules({ '#lib/server/email.ts': { async sendAccountDeletionRequestEmail() {
      if (mode === 'throw') throw new Error(privateText); return { sent: false, reason: privateText };
    } } })('src/routes/account-deletion/+page.server.ts');
    const { result, lines } = await capture(() => route.actions.default(event()));
    assert.equal(result.success, true);
    assert.equal(JSON.stringify(lines).includes(privateText), false);
    assert.ok(lines.some(([value]) => typeof value === 'string' && value.startsWith('{') && JSON.parse(value).event === 'account_deletion_receipt_unavailable'));
  }
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_deletion_requests').get().n, 5);
  for (const dev of [false, true]) {
    const route = loadServerModules({ '$app/env': { dev }, '#lib/server/security.ts': { ...security,
      async checkRateLimit() { throw new Error(privateText); } }, '#lib/server/email.ts': { async sendAccountDeletionRequestEmail() { return { sent: true }; } }
    })('src/routes/account-deletion/+page.server.ts');
    const { result, lines } = await capture(() => route.actions.default(event()));
    assert.equal(dev ? result.success : result.status, dev ? true : 503);
    assert.equal(JSON.stringify(lines).includes(privateText), false);
    assert.equal(JSON.stringify(lines).includes('employee@example.invalid'), false);
  }
  t.sqlite.exec("CREATE TRIGGER fixture_request_failure BEFORE INSERT ON account_deletion_requests BEGIN SELECT RAISE(ABORT,'PRIVATE-REQUEST employee@example.invalid bank 123456789 tax 999-00-1111'); END");
  const route = loadServerModules()('src/routes/account-deletion/+page.server.ts');
  const { result, lines } = await capture(() => route.actions.default(event()));
  assert.equal(result.status, 503); assert.equal(JSON.stringify(lines).includes(privateText), false);
  assert.equal(JSON.parse(lines[0][0]).metadata.phase, 'save');
});

await check('public deletion request parser rejects oversized declared/streamed bodies, files and unsupported types before DB writes or email', async t => {
  let sends = 0;
  const route = loadServerModules({ '#lib/server/email.ts': { async sendAccountDeletionRequestEmail() { sends++; return { sent: true }; } } })('src/routes/account-deletion/+page.server.ts');
  const before = t.queryCount;
  const upload = new FormData(); upload.set('email', 'employee@example.invalid'); upload.set('file', new Blob(['private']), 'private.txt');
  for (const [request, status] of [
    [new Request(origin + '/account-deletion', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': '40000' }, body: 'email=a%40b.test' }), 413],
    [new Request(origin + '/account-deletion', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'details=' + 'x'.repeat(33000) }), 413],
    [new Request(origin + '/account-deletion', { method: 'POST', body: upload }), 400],
    [new Request(origin + '/account-deletion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }), 415],
    [new Request(origin + '/account-deletion', { method: 'POST', headers: { 'content-type': 'multipart/form-data' }, body: 'malformed' }), 400]
  ]) {
    assert.equal((await route.actions.default({ request, locals: { DB: t.db }, url: url('/account-deletion'), getClientAddress: () => '192.0.2.70' })).status, status);
  }
  assert.equal(t.queryCount, before); assert.equal(sends, 0);
});

await check('device-bound Staff proof cannot survive device revocation, user mismatch, expiry or forged locals', async t => {
  t.insert('devices', { id: 'owner-device', user_id: 'owner', created_at: now, updated_at: now });
  t.sqlite.exec("UPDATE sessions SET device_id='owner-device' WHERE user_id='owner'");
  assert.equal((await t.review.listDeletionRequests(t.locals('owner'), url('/staff/deletion-requests'))).requests.length, 3);
  for (const sql of ["UPDATE devices SET revoked_at=1 WHERE id='owner-device'",
    "UPDATE devices SET revoked_at=NULL,user_id='manager' WHERE id='owner-device'",
    "UPDATE devices SET user_id='owner' WHERE id='owner-device'; UPDATE sessions SET expires_at=1 WHERE user_id='owner'"]) {
    t.sqlite.exec(sql);
    await assert.rejects(t.review.listDeletionRequests(t.locals('owner'), url('/staff/deletion-requests')), { status: 403 });
    await assert.rejects(t.review.reviewDeletionRequest(t.locals('owner'), 'request-a', t.form()), { status: 403 });
  }
  await assert.rejects(t.review.listDeletionRequests({ ...t.locals('manager'), platformStaff: { userId: 'manager', role: 'owner' } }, url('/staff/deletion-requests')), { status: 403 });
});

await check('actual Staff action enforces recent proof, bounded text forms, rate limits, safe errors, stale revisions and exact redirect', async t => {
  const route = t.load('src/routes/staff/deletion-requests/+page.server.ts');
  const event = (user = 'owner', fields = { status: 'in_review', review_revision: '1' }) => ({ locals: t.locals(user),
    request: formRequest(fields, '/staff/deletion-requests?request=request-a&/review'),
    url: url('/staff/deletion-requests?request=request-a&/review') });
  assert.equal((await route.actions.review(event('support'))).status, 403);
  await assert.rejects(route.actions.review(event()), { status: 303, location: '/staff/deletion-requests?request=request-a' });
  assert.equal((await route.actions.review(event())).status, 409);
  const blocked = loadServerModules({ '#lib/server/security.ts': { async checkRateLimit() { return { allowed: false }; } } })('src/routes/staff/deletion-requests/+page.server.ts');
  assert.equal((await blocked.actions.review(event())).status, 429);
  const oversized = event(); oversized.request = new Request(origin + '/staff/deletion-requests', { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'value=' + 'x'.repeat(33000) });
  assert.equal((await route.actions.review(oversized)).status, 413);
  t.sqlite.exec("CREATE TRIGGER fixture_review_failure BEFORE INSERT ON platform_staff_audit BEGIN SELECT RAISE(ABORT,'PRIVATE-REQUEST employee@example.invalid'); END");
  const failure = await capture(() => route.actions.review(event('owner', { status: 'closed', review_revision: '2' })));
  assert.equal(failure.result.status, 503); assert.equal(JSON.stringify(failure).includes('employee@example.invalid'), false);
});

await check('HR AES-GCM binds restaurant, employee, scope and type, rejects tampering, uses fresh IVs and reads approved previous versions', async t => {
  const sensitive = t.load('src/lib/server/sensitive.ts');
  const env = { SENSITIVE_DATA_KEY: 'isolated-privacy-readiness-key-material-2026', SENSITIVE_DATA_KEY_VERSION: 'v1' };
  const context = { businessId: 'a', userId: 'employee', recordScope: 'tax', recordType: 'withholding' };
  const payload = { privateText, legal_name: 'Fixture Employee' };
  const first = await sensitive.encryptSensitiveJsonPayload(env, payload, context);
  const stored = value => ({ encrypted_payload: value.encryptedPayload, payload_iv: value.payloadIv,
    key_version: value.keyVersion, encryption_algorithm: value.encryptionAlgorithm });
  assert.deepEqual(await sensitive.decryptSensitiveJsonPayload(env, stored(first), context), payload);
  assert.equal(JSON.stringify(first).includes(privateText), false);
  const ivs = new Set([first.payloadIv]);
  for (let i = 0; i < 32; i++) ivs.add((await sensitive.encryptSensitiveJsonPayload(env, payload, context)).payloadIv);
  assert.equal(ivs.size, 33); assert.equal(Buffer.from(first.payloadIv, 'base64').length, 12);
  for (const key of Object.keys(context)) await assert.rejects(sensitive.decryptSensitiveJsonPayload(env, stored(first), { ...context, [key]: 'other' }));
  for (const key of ['encrypted_payload', 'payload_iv']) {
    const modified = stored(first), bytes = Buffer.from(modified[key], 'base64'); bytes[0] ^= 1; modified[key] = bytes.toString('base64');
    await assert.rejects(sensitive.decryptSensitiveJsonPayload(env, modified, context));
  }
  await assert.rejects(sensitive.decryptSensitiveJsonPayload(env, { ...stored(first), encryption_algorithm: 'plaintext' }, context));
  await assert.rejects(sensitive.encryptSensitiveJsonPayload({}, payload, context));
  await assert.rejects(sensitive.decryptSensitiveJsonPayload({ ...env, SENSITIVE_DATA_KEY: 'different-isolated-privacy-key-material' }, stored(first), context));
  const rotated = { SENSITIVE_DATA_KEY: 'different-isolated-privacy-key-material', SENSITIVE_DATA_KEY_VERSION: 'v2',
    SENSITIVE_DATA_PREVIOUS_KEYS: JSON.stringify({ v1: env.SENSITIVE_DATA_KEY }) };
  assert.deepEqual(await sensitive.decryptSensitiveJsonPayload(rotated, stored(first), context), payload);
  assert.equal((await sensitive.encryptSensitiveJsonPayload(rotated, payload, context)).keyVersion, 'v2');
  await assert.rejects(sensitive.decryptSensitiveJsonPayload({ ...rotated, SENSITIVE_DATA_PREVIOUS_KEYS: '{}' }, stored(first), context));
  assert.equal(sensitive.isSensitiveEncryptionConfigured({ ...rotated, SENSITIVE_DATA_PREVIOUS_KEYS: JSON.stringify({ v2: env.SENSITIVE_DATA_KEY }) }), false);
});

await check('actual review page escapes supplied content and distinguishes closed review from completed deletion', async t => {
  const source = readFileSync('src/routes/staff/deletion-requests/+page.svelte', 'utf8');
  const compiled = ts.transpileModule(compile(source, { generate: 'server' }).js.code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  new Function('require', 'exports', compiled)(name => {
    if (name === 'svelte/internal/server') return serverRuntime;
    if (name === '#lib/deletionRequests.ts') return t.load('src/lib/deletionRequests.ts');
    throw Error('Unexpected component dependency: ' + name);
  }, exports);
  const detail = await t.review.loadDeletionRequest(t.locals('owner'), 'request-a');
  detail.details = '<script>untrusted()</script>'; detail.workspace_name = '<img src=x onerror=untrusted()>';
  const html = render(exports.default, { props: { data: { detail, queue: null }, form: undefined } }).body;
  assert.doesNotMatch(html, /<script>untrusted|<img src=x/); assert.match(html, /&lt;script>/);
  assert.match(html, /Status changes do not delete data/); assert.match(html, /Supplied details are not verification/);
  assert.match(html, /name="review_revision" value="1"/);
  const queue = await t.review.listDeletionRequests(t.locals('owner'), url('/staff/deletion-requests'));
  assert.ok(render(exports.default, { props: { data: { detail: null, queue }, form: undefined } }).body.includes('request=request-a'));
});

if (failures) process.exitCode = 1;
