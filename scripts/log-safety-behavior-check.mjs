import assert from 'node:assert/strict';
import { createTestD1, loadServerModules } from './helpers/test-d1.mjs';

const load = loadServerModules();
const logger = load('src/lib/server/observability.ts');
const token = 'isolated-reset-secret-789';
const file = 'PRIVATE-EMPLOYEE-TAX-FORM.pdf';
let failed = 0;
function capture(run) {
  const original = { log: console.log, warn: console.warn, error: console.error };
  const records = [];
  for (const name of Object.keys(original)) console[name] = value => records.push(JSON.parse(value));
  try { run(); return records; } finally { Object.assign(console, original); }
}
async function check(label, run) {
  try { await run(); console.log('PASS ' + label); }
  catch (error) { failed++; console.error('FAIL ' + label + ': ' + error.message); }
}
const contains = (value, secret) => JSON.stringify(value).includes(secret);

await check('all log levels redact raw reset paths in request, route, message, error and allowlisted metadata', () => {
  for (const level of ['info', 'warn', 'error']) {
    const url = 'https://criminiops.com/reset-password/' + token;
    const error = new Error('Failure at ' + url); error.name = 'ResetError';
    const [record] = capture(() => logger.logOperationalEvent({ level, event: 'reset_failure',
      request: new Request(url + '?password=PRIVATE_QUERY'), route: '/reset-password/' + token,
      message: 'Unable to process ' + url, error,
      metadata: { path: url, route: '/reset-password/' + token, reason: 'Failure at ' + url } }));
    assert.equal(contains(record, token), false); assert.equal(contains(record, 'PRIVATE_QUERY'), false);
    assert.equal(record.path, '/reset-password/[token]'); assert.equal(record.route, '/reset-password/[token]');
    assert.equal(record.event, 'reset_failure'); assert.equal(record.error.name, 'ResetError');
  }
});

await check('private file paths never expose employee filenames or storage keys through shared logs', () => {
  const path = '/api/documents/media/businesses/restaurant/employee-onboarding/employee/' + file;
  const [record] = capture(() => logger.logOperationalError({ event: 'document_media_object_missing',
    request: new Request('https://criminiops.com' + path), route: path,
    message: 'Could not fetch ' + path, error: new Error('Missing key ' + path), metadata: { path, reason: path } }));
  assert.equal(contains(record, file), false); assert.equal(contains(record, 'employee-onboarding/employee'), false);
  assert.equal(record.path, '/api/documents/media/[...key]');
});

await check('encoded reset/media paths and sensitive URL query values are redacted in free text', () => {
  for (const path of ['/reset-password/' + encodeURIComponent(token), '/reset%2Dpassword%2F' + token,
    '/reset-password/' + token + '%0Aextra', '/reset-password/' + token + '%invalid',
    '/api/documents/media/businesses/a/' + file + '%0Aextra', '/api%2Fdocuments%2Fmedia%2Fbusinesses%2Fa%2F' + file]) {
    const [record] = capture(() => logger.logOperationalError({ event: 'request_guard_error',
      request: new Request('https://criminiops.com' + path), route: path,
      error: new Error('See https://criminiops.com' + path + '?invite=PRIVATE_INVITE&token=PRIVATE_TOKEN&X-Amz-Signature=PRIVATE_SIGNATURE') }));
    for (const value of [token, file, 'PRIVATE_INVITE', 'PRIVATE_TOKEN', 'PRIVATE_SIGNATURE']) assert.equal(contains(record, value), false, value);
  }
});

await check('credentials are redacted from message, error name and permitted string metadata too', () => {
  const error = new Error('Bearer PRIVATE_BEARER password=PRIVATE_PASSWORD PASSWORD_PEPPER=PRIVATE_PEPPER SENSITIVE_DATA_KEY=PRIVATE_KEY');
  error.name = 'token=PRIVATE_NAME';
  const [record] = capture(() => logger.logOperationalError({ event: 'provider_failure', error,
    message: 'RESEND_API_KEY=PRIVATE_PROVIDER BILLING_WEBHOOK_TOKEN=PRIVATE_WEBHOOK',
    metadata: { reason: 'password_hash=PRIVATE_HASH secret=PRIVATE_SECRET api_key=PRIVATE_API' } }));
  assert.equal(JSON.stringify(record).includes('PRIVATE_'), false);
});

await check('allowed metadata is bounded scalar information, not a nested HR/request/provider payload', () => {
  const [record] = capture(() => logger.logOperationalEvent({ event: 'safe_metadata', metadata: {
    reason: { payload: 'PRIVATE_HR' }, action: ['PRIVATE_BODY'], error: 'PRIVATE_PROVIDER',
    raw_count: 'PRIVATE_COUNTER', healthy_count: 5, retry_total: 3, attempt: 2, status: true,
    phase: 'x'.repeat(4000), table: null, invalid_total: Infinity, target: () => 'PRIVATE_FUNCTION'
  } }));
  assert.equal(contains(record, 'PRIVATE_'), false); assert.equal(record.metadata.healthy_count, 5);
  assert.equal(record.metadata.retry_total, 3); assert.equal(record.metadata.attempt, 2);
  assert.equal(record.metadata.status, true); assert.equal(record.metadata.table, null);
  assert.ok(record.metadata.phase.length <= 500);
});

await check('untrusted arbitrary request-ID headers cannot become a secret or unbounded log field', () => {
  for (const headers of [{ 'x-request-id': 'PRIVATE_CLIENT_PAYLOAD' }, { 'cf-ray': 'PRIVATE_RAY', 'x-request-id': 'PRIVATE_CLIENT_PAYLOAD' }]) {
    const [record] = capture(() => logger.logOperationalEvent({ event: 'header_check', request: new Request('https://criminiops.com/app', { headers }) }));
    assert.equal(contains(record, 'PRIVATE_'), false); assert.match(record.request_id, /^[a-f0-9-]{36}$/);
  }
});

await check('normal operational identifiers, route templates, counts, statuses and request correlation remain useful', () => {
  const ray = '0123456789abcdef-DEN';
  const [record] = capture(() => logger.logOperationalEvent({ event: 'schedule_save_failed',
    request: new Request('https://criminiops.com/admin/schedule?/publish&invite=PRIVATE_QUERY', { method: 'POST', headers: { 'cf-ray': ray } }),
    route: '/admin/schedule', businessId: 'business-a', userId: 'user-a', sessionId: 'session-a', status: 503,
    error: new Error('D1_ERROR: SQLITE_BUSY'), metadata: { action: 'publish', row_count: 20, phase: 'commit' } }));
  assert.equal(record.request_id, ray); assert.equal(record.path, '/admin/schedule'); assert.equal(record.route, '/admin/schedule');
  assert.equal(record.business_id, 'business-a'); assert.equal(record.user_id, 'user-a'); assert.equal(record.session_id, 'session-a');
  assert.equal(record.status, 503); assert.equal(record.metadata.row_count, 20); assert.equal(record.error.message, 'D1_ERROR: SQLITE_BUSY');
  assert.equal(record.method, 'POST'); assert.equal(contains(record, 'PRIVATE_QUERY'), false);
  const id = '12345678-1234-4234-9234-123456789abc';
  assert.equal(capture(() => logger.logOperationalEvent({ event: 'trace', request: new Request('https://criminiops.com/app', { headers: { 'x-request-id': id } }) }))[0].request_id, id);
});

await check('redaction leaves the original request, route, error and metadata untouched', () => {
  const path = '/reset-password/' + token;
  const args = { event: 'source_unchanged', request: new Request('https://criminiops.com' + path), route: path,
    error: new Error(path), message: path, metadata: { reason: path, path } };
  const before = JSON.stringify({ url: args.request.url, route: args.route, error: args.error.message, message: args.message, metadata: args.metadata });
  capture(() => logger.logOperationalError(args));
  assert.equal(JSON.stringify({ url: args.request.url, route: args.route, error: args.error.message, message: args.message, metadata: args.metadata }), before);
});

await check('actual reset request guard and denied private-media handler emit only safe paths, with unchanged HTTP behavior', async () => {
  const t = createTestD1(); const records = []; const original = { warn: console.warn, error: console.error };
  console.warn = console.error = value => {
    if (typeof value === 'string' && value.startsWith('{')) records.push(JSON.parse(value));
    else original.warn(value);
  };
  try {
    const modules = loadServerModules({ 'cloudflare:workers': { env: { DB: t.db }, waitUntil() {} },
      '#lib/server/operationalEvents.ts': { async processOperationalEvents() {} } });
    const hooks = modules('src/hooks.server.ts'); const cookies = new Map([['__Host-kitchen_session', 'invalid-fixture-session']]);
    const url = new URL('https://criminiops.com/reset-password/' + token);
    const response = await hooks.handle({ event: { url, request: new Request(url), locals: {}, route: { id: '/reset-password/[token]' },
      cookies: { get: key => cookies.get(key), set: (key, value) => cookies.set(key, value), delete: key => cookies.delete(key) } },
      resolve: async () => new Response('Reset form') });
    assert.equal(response.status, 200); assert.equal(await response.text(), 'Reset form');
    assert.equal(cookies.has('__Host-kitchen_session'), false);
    assert.match(response.headers.get('cache-control'), /no-store/);
    const key = 'businesses/a/employee-onboarding/employee/' + file;
    const media = modules('src/routes/api/documents/media/[...key]/+server.ts');
    const denied = await media.GET({ params: { key }, locals: { env: { DOC_MEDIA: {} } },
      request: new Request('https://criminiops.com/api/documents/media/' + key) });
    assert.equal(denied.status, 401);
    assert.ok(records.some(record => record.event === 'session_rejected' && record.path === '/reset-password/[token]'));
    assert.ok(records.some(record => record.event === 'document_media_access_denied' && record.path === '/api/documents/media/[...key]'));
    assert.equal(contains(records, token), false); assert.equal(contains(records, file), false);
  } finally { Object.assign(console, original); t.close(); }
});

await check('diagnostics use safe route templates, aggregate repeated failures and preserve tenant scope without extra queries', async () => {
  const t = createTestD1(); const now = Math.floor(Date.now() / 1000);
  const collector = load('src/lib/server/platformDiagnostics.ts'); const original = console.warn; const logs = [];
  console.warn = value => logs.push(JSON.parse(value));
  try {
    for (const id of ['a', 'b']) t.sqlite.prepare('INSERT INTO businesses(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)').run(id, id, id, now, now);
    const event = (businessId, raw, route) => ({ locals: { DB: t.db, businessId }, route: { id: route },
      url: new URL('https://criminiops.com' + raw), request: new Request('https://criminiops.com' + raw + '?invite=PRIVATE_QUERY') });
    const before = t.queryCount;
    await collector.recordRequestDiagnostic(event('a', '/reset-password/' + token, '/reset-password/[token]'), 200, 10, { now, random: 1 });
    assert.equal(t.queryCount, before);
    for (const businessId of ['a', 'a', 'b']) await collector.recordRequestDiagnostic(event(businessId, '/reset-password/' + token,
      '/reset-password/[token]'), 500, 10, { now, random: 1 });
    await collector.recordRequestDiagnostic(event('a', '/api/documents/media/businesses/a/' + file,
      '/api/documents/media/[...key]'), 500, 10, { now, random: 1 });
    const rows = t.sqlite.prepare('SELECT business_id,route_id,occurrences FROM platform_diagnostic_issues ORDER BY business_id,route_id').all();
    assert.equal(rows.length, 3); assert.equal(rows.find(row => row.business_id === 'a' && row.route_id === '/reset-password/[token]').occurrences, 2);
    for (const value of [token, file, 'PRIVATE_QUERY']) { assert.equal(contains(rows, value), false); assert.equal(contains(logs, value), false); }
    assert.equal(t.queryCount - before, 12, 'One issue plus two scope counters per failure, no new log reads');
  } finally { console.warn = original; t.close(); }
});

if (failed) { console.error(`${failed} log-safety cases failed.`); process.exitCode = 1; }
