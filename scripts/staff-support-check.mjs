import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

const test = createTestD1();
const { db, sqlite } = test;
const now = Math.floor(Date.now() / 1000);
const load = loadServerModules({ '#lib/server/security.ts': { checkRateLimit: async () => ({ allowed: true }) } });
const support = load('src/lib/server/platformSupport.ts');
const overview = load('src/lib/server/platformStaffOverview.ts');
function insert(table, row) {
  const keys = Object.keys(row);
  sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
}
const url = value => new URL('https://criminiops.com' + value);
const staffUrl = url('/staff');
const input = () => ({ subject: 'List will not save', body: 'Normal customer request', category: 'application', submission_id: crypto.randomUUID() });
const locals = (user, business = 'a') => ({ DB: db, userId: user, sessionId: user + '-session', businessId: business, businessName: 'Business ' + business });
try {
  assert.equal((await support.readSupportForm(formRequest({ subject: 'Normal form', body: 'Hello' }))).get('body'), 'Hello');
  await assert.rejects(support.readSupportForm(new Request('https://criminiops.com/support', { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': '40000' }, body: 'body=small' })), { status: 413 });
  const oversized = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(33 * 1024)); controller.close(); } });
  await assert.rejects(support.readSupportForm(new Request('https://criminiops.com/support', { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: oversized, duplex: 'half' })), { status: 413 });
  const upload = new FormData(); upload.set('body', 'Hello'); upload.set('file', new Blob(['Not supported']), 'upload.txt');
  await assert.rejects(support.readSupportForm(new Request('https://criminiops.com/support', { method: 'POST', body: upload })), { status: 400 });
  const workerSource = readFileSync('src/service-worker/index.ts', 'utf8');
  const cachedPaths = workerSource.match(/PUBLIC_NAVIGATION_PATHS = new Set\(\[([\s\S]*?)\]\)/)[1];
  assert.equal(cachedPaths.includes("'/support'"), false); assert.equal(cachedPaths.includes("'/staff'"), false);
  console.log('PASS bounded streaming form reads, oversized declared/chunked requests denied, files rejected and personalized support/staff excluded from navigation cache');
  for (const id of ['a', 'b']) insert('businesses', { id, name: 'Business ' + id, slug: id, created_at: now, updated_at: now });
  for (const id of ['owner', 'support', 'equipment', 'alice', 'alex', 'bob']) {
    insert('users', { id, email: `${id}@example.invalid`, email_normalized: `${id}@example.invalid`, display_name: id, created_at: now, updated_at: now });
    insert('business_users', { business_id: id === 'bob' ? 'b' : 'a', user_id: id, created_at: now, updated_at: now });
    insert('sessions', { id: id + '-session', user_id: id, session_token_hash: 'PRIVATE-' + id, created_at: now, last_seen_at: now, expires_at: now + 3600 });
    if (['owner', 'support', 'equipment'].includes(id)) {
      insert('platform_staff_members', { user_id: id, staff_role: id, created_at: now, updated_at: now });
      insert('platform_staff_step_up', { session_id: id + '-session', user_id: id, membership_revision: 1, verified_at: now, email_verified_at: now });
    }
  }
  const alice = await support.customerSupportContext(locals('alice'));
  const alex = await support.customerSupportContext(locals('alex'));
  const bob = await support.customerSupportContext(locals('bob', 'b'));
  assert.ok(alice && alex && bob);
  assert.equal(await support.customerSupportContext(locals('alice', 'b')), null);
  assert.equal(await support.customerSupportContext({ DB: db }), null);
  const staff = support.staffSupportContext({ userId: 'support', role: 'support' }, 'support-session', 'a');
  assert.throws(() => support.staffSupportContext({ userId: 'equipment', role: 'equipment' }, 'equipment-session', 'a'), { status: 403 });
  const submission = input();
  const id = await support.createSupportRequest(db, alice, { ...submission, business_id: 'b', requester_user_id: 'bob' }, now);
  assert.equal(await support.createSupportRequest(db, alice, submission, now + 1), id);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM platform_support_requests').get().n, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM platform_support_messages').get().n, 1);
  const otherA = await support.createSupportRequest(db, alex, input(), now);
  const otherB = await support.createSupportRequest(db, bob, input(), now);
  assert.equal((await support.listSupportRequests(db, staffUrl, { customer: alice })).requests.length, 1);
  for (const inaccessible of [otherA, otherB, "' OR 1=1--"]) await assert.rejects(support.loadSupportRequest(db, inaccessible, alice, staffUrl), { status: 404 });
  assert.equal((await support.loadSupportRequest(db, id, alice, staffUrl)).request.business_id, 'a');
  await support.updateSupportRequest(db, staff, id, { revision: 1, body: 'PRIVATE STAFF NOTE', visibility: 'internal', status: 'waiting', priority: 'urgent' }, now + 1);
  let customerView = await support.loadSupportRequest(db, id, alice, staffUrl);
  assert.equal(customerView.messages.length, 1);
  assert.equal(JSON.stringify(customerView).includes('PRIVATE STAFF NOTE'), false);
  assert.equal((await support.loadSupportRequest(db, id, staff, staffUrl)).messages.length, 2);
  await support.updateSupportRequest(db, alice, id, { revision: 2, body: '<script>alert(1)</script>', visibility: 'internal', status: 'closed', priority: 'normal' }, now + 2);
  customerView = await support.loadSupportRequest(db, id, alice, staffUrl);
  assert.equal(customerView.request.status, 'open'); assert.equal(customerView.request.priority, 'urgent');
  assert.equal(customerView.messages.length, 2); assert.equal(customerView.messages.at(-1).visibility, 'customer');
  await assert.rejects(support.updateSupportRequest(db, staff, id, { revision: 2, body: 'STALE OVERWRITE', status: 'closed' }, now + 3), { status: 409 });
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM platform_support_messages WHERE body='STALE OVERWRITE'").get().n, 0);
  await support.updateSupportRequest(db, staff, id, { revision: 3, body: 'Your settings are ready.', visibility: 'customer', status: 'closed', priority: 'urgent' }, now + 4);
  await assert.rejects(support.updateSupportRequest(db, alice, id, { revision: 4, body: 'Do not automatically reopen' }, now + 5), { status: 409 });
  assert.equal((await support.loadSupportRequest(db, id, alice, staffUrl)).request.status, 'closed');
  assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM platform_staff_audit').all()).includes('PRIVATE STAFF NOTE'), false);
  assert.throws(() => insert('platform_support_messages', { id: 'mismatch', business_id: 'b', request_id: id, author_type: 'customer', visibility: 'customer', body: 'Bad pair', created_at: now }), /FOREIGN KEY/);
  console.log('PASS real support SQL: business/requester isolation, idempotent submit, internal-note exclusion, escaped-text storage, explicit close, optimistic concurrency and composite tenant FK');

  const requestCount = sqlite.prepare('SELECT COUNT(*) n FROM platform_support_requests').get().n;
  const auditCount = sqlite.prepare('SELECT COUNT(*) n FROM platform_staff_audit').get().n;
  sqlite.exec("CREATE TRIGGER test_support_audit_failure BEFORE INSERT ON platform_staff_audit BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
  await assert.rejects(support.createSupportRequest(db, staff, input(), now));
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM platform_support_requests').get().n, requestCount);
  sqlite.exec('DROP TRIGGER test_support_audit_failure');
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM platform_staff_audit').get().n, auditCount);
  sqlite.prepare("UPDATE business_users SET is_active=0 WHERE user_id='alice'").run();
  await assert.rejects(support.createSupportRequest(db, alice, input(), now), { status: 409 });
  assert.equal(await support.customerSupportContext(locals('alice')), null);
  sqlite.prepare("UPDATE business_users SET is_active=1 WHERE user_id='alice'").run();
  sqlite.prepare("UPDATE platform_staff_members SET is_active=0 WHERE user_id='support'").run();
  await assert.rejects(support.updateSupportRequest(db, staff, otherA, { revision: 1, body: 'REVOKED', status: 'open' }, now), { status: 409 });
  sqlite.prepare("UPDATE platform_staff_members SET is_active=1 WHERE user_id='support'").run();
  await assert.rejects(support.createSupportRequest(db, staff, input(), now + 901), { status: 409 });
  console.log('PASS atomic audit rollback, membership revocation between load/write and expired email-proof denial');

  for (let i = 0; i < 28; i++) await support.createSupportRequest(db, alice, { ...input(), subject: 'Request ' + i }, now + i);
  const first = await support.listSupportRequests(db, staffUrl, { staff: { userId: 'owner', role: 'owner' } }, 'a');
  assert.equal(first.requests.length, 20); assert.ok(first.next);
  const next = url('/staff/support?after=' + encodeURIComponent(first.next));
  const second = await support.listSupportRequests(db, next, { staff: { userId: 'owner', role: 'owner' } }, 'a');
  assert.ok(second.requests.length); assert.equal(second.requests.some(row => first.requests.some(old => old.id === row.id)), false);
  await assert.rejects(support.listSupportRequests(db, url('/staff/support?after=bad'), { customer: alice }), { status: 400 });
  await assert.rejects(support.listSupportRequests(db, staffUrl, { staff: { userId: 'equipment', role: 'equipment' } }), { status: 403 });

  for (let i = 0; i < 35; i++) {
    const business = 'fleet-' + i;
    insert('businesses', { id: business, name: business, slug: business, created_at: now, updated_at: now });
    insert('platform_diagnostic_issues', { id: business + '-error', business_id: business, area: 'lists', kind: 'server_error', route_id: '/lists/[id]', operation: 'POST',
      status: 500, occurrences: 1000, first_seen_at: now - 10, last_seen_at: now, max_duration_ms: 30, last_request_id: 'PUBLIC-REFERENCE' });
  }
  insert('iot_devices', { id: 'offline-a', business_id: 'a', device_type: 'sensor_gateway', external_device_id: 'offline-a', display_name: 'Gateway', key_hash: 'PRIVATE GATEWAY', key_prefix: 'PRIVATE', last_seen_at: now - 700, created_at: now, updated_at: now });
  insert('iot_devices', { id: 'online-b', business_id: 'b', device_type: 'sensor_gateway', external_device_id: 'online-b', display_name: 'Gateway', key_hash: 'PRIVATE GATEWAY', key_prefix: 'PRIVATE', last_seen_at: now, created_at: now, updated_at: now });
  insert('platform_request_metrics', { scope_key: 'platform', bucket: Math.floor(now / 3600) * 3600, success_samples: 2, sample_duration_ms: 400, server_errors: 7 });
  insert('operational_events', { id: 'failed-a', business_id: 'a', event_type: 'test', category: 'onboarding', body: 'PRIVATE EMAIL BODY', title: 'PRIVATE TITLE', delivery_status: 'failed', created_at: now, updated_at: now });
  const before = test.queryCount;
  const fleet = await overview.loadStaffOverview(db, 'owner', staffUrl, now + 40);
  assert.equal(test.queryCount - before, 7, 'Fleet query count stays constant regardless of businesses');
  assert.equal(fleet.activeBusinesses, 37); assert.equal(fleet.affectedBusinesses, 36);
  assert.equal(fleet.groups[0].businesses, 35); assert.equal(fleet.metrics.errors, 7); assert.equal(fleet.metrics.averageMs, 200);
  assert.equal(fleet.gateways.total, 2); assert.equal(fleet.gateways.attention, 1); assert.equal(fleet.delivery.failed, 1);
  assert.equal(fleet.support.open, 30); assert.equal(fleet.support.urgent, 0);
  assert.equal(JSON.stringify(fleet).includes('PRIVATE'), false);
  const equipmentBefore = test.queryCount;
  const equipment = await overview.loadStaffOverview(db, 'equipment', staffUrl, now);
  assert.equal(test.queryCount - equipmentBefore, 2); assert.equal(equipment.support, null); assert.equal(equipment.metrics, null);
  assert.equal(equipment.affectedBusinesses, 1);
  const failures = await overview.loadStaffDeliveryIssues(db, 'owner', staffUrl, now);
  assert.equal(failures.rows.length, 1); assert.equal(JSON.stringify(failures).includes('PRIVATE'), false);
  await assert.rejects(overview.loadStaffDeliveryIssues(db, 'equipment', staffUrl), { status: 403 });
  console.log('PASS true fleet counts beyond 20 records, grouped signals, sampled trends, no content exposure and constant bounded query count');

  const customerPage = load('src/routes/support/+page.server.ts');
  const staffLayout = load('src/routes/staff/+layout.server.ts');
  const staffHealth = load('src/routes/staff/health/+page.server.ts');
  const headers = {};
  const setHeaders = values => { for (const [key, value] of Object.entries(values)) { assert.equal(key in headers, false, 'SvelteKit forbids setting a header twice across layout and page'); headers[key] = value; } };
  const healthEvent = { locals: locals('owner'), url: url('/staff/health?view=application'), setHeaders };
  await staffLayout.load(healthEvent);
  assert.ok((await staffHealth.load(healthEvent)).diagnostics);
  assert.equal(headers['cache-control'], 'no-store');
  const staffPage = load('src/routes/staff/support/+page.server.ts');
  const staffDetail = load('src/routes/staff/support/[id]/+page.server.ts');
  const noStore = headers => assert.equal(headers['cache-control'], 'no-store');
  assert.equal((await customerPage.load({ locals: { DB: db }, url: url('/support'), setHeaders: noStore })).canRequest, false);
  const customerLoad = await customerPage.load({ locals: locals('alice'), url: url('/support?request=' + id), setHeaders: noStore });
  assert.equal(JSON.stringify(customerLoad).includes('PRIVATE STAFF NOTE'), false);
  await assert.rejects(staffPage.load({ locals: locals('alice'), url: url('/staff/support') }), { status: 403 });
  await assert.rejects(staffPage.load({ locals: locals('equipment'), url: url('/staff/support') }), { status: 403 });
  assert.ok((await staffPage.load({ locals: locals('owner'), url: url('/staff/support?business=a') })).queue.requests.every(row => row.business_id === 'a'));
  sqlite.prepare("UPDATE platform_staff_step_up SET verified_at=?,email_verified_at=? WHERE user_id='owner'").run(now - 901, now - 901);
  assert.equal((await staffPage.actions.create({ locals: locals('owner'), request: formRequest(input()) })).status, 403);
  assert.equal((await staffDetail.actions.reply({ locals: locals('owner'), params: { id: otherA }, request: formRequest({}) })).status, 403);
  sqlite.prepare("UPDATE platform_staff_step_up SET verified_at=?,email_verified_at=? WHERE user_id='owner'").run(now, now);
  const wrongBusiness = await staffDetail.actions.reply({ locals: locals('owner'), params: { id: otherA }, request: formRequest({ business_id: 'b', revision: 1, body: 'Wrong business', status: 'closed' }) });
  assert.equal(wrongBusiness.status, 409);
  const newInput = input();
  await assert.rejects(customerPage.actions.create({ locals: locals('alice'), request: formRequest(newInput) }), error => error.status === 303 && error.location.startsWith('/support?request='));
  const limiting = loadServerModules({ '#lib/server/security.ts': { checkRateLimit: async () => ({ allowed: false }) } })('src/routes/support/+page.server.ts');
  assert.equal((await limiting.actions.create({ locals: locals('alice'), request: formRequest(input()) })).status, 429);
  const supportUi = readFileSync('src/lib/components/staff/SupportConversation.svelte', 'utf8');
  assert.ok(supportUi.includes('{message.body}')); assert.equal(supportUi.includes('@html'), false);
  console.log('PASS actual customer/staff loaders and actions, anonymous read-only Support, nonstaff/equipment denial, hidden-business tampering denial, save redirect and rate limit');

  for (const [sql, values, index] of [
    ["SELECT id FROM platform_support_requests WHERE business_id=? AND requester_user_id=? ORDER BY updated_at DESC,id DESC LIMIT 21", ['a', 'alice'], 'idx_support_requester_recent'],
    ["SELECT id FROM platform_support_requests INDEXED BY idx_support_active_recent WHERE status IN ('open','waiting') ORDER BY updated_at DESC,id DESC LIMIT 21", [], 'idx_support_active_recent'],
    ["SELECT id FROM platform_support_messages WHERE business_id=? AND request_id=? AND visibility='customer' ORDER BY created_at DESC,id DESC LIMIT 21", ['a', id], 'idx_support_messages_customer'],
    ["SELECT id FROM operational_events WHERE created_at>=? AND created_at<=? AND delivery_status='failed' ORDER BY created_at DESC,id DESC LIMIT 21", [now - 86400, now], 'idx_events_platform_staff_recent']
  ]) {
    const plan = sqlite.prepare('EXPLAIN QUERY PLAN ' + sql).all(...values).map(row => row.detail).join(' ');
    assert.ok(plan.includes(index), plan); assert.equal(plan.includes('USE TEMP B-TREE'), false, plan);
  }
  const bBefore = sqlite.prepare("SELECT * FROM platform_support_requests WHERE business_id='b'").all();
  sqlite.prepare("DELETE FROM businesses WHERE id='a'").run();
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM platform_support_requests WHERE business_id='a'").get().n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM platform_support_messages WHERE business_id='a'").get().n, 0);
  assert.deepEqual(sqlite.prepare("SELECT * FROM platform_support_requests WHERE business_id='b'").all(), bBefore);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  console.log('PASS indexed queue/message/delivery plans and tenant deletion cascade without touching another business');
} finally { test.close(); }
