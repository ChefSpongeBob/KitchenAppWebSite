import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTestD1, loadServerModules } from './helpers/test-d1.mjs';

const test = createTestD1();
const { sqlite, db } = test;
const now = Math.floor(Date.now() / 1000);
const load = loadServerModules();
const collector = load('src/lib/server/platformDiagnostics.ts');
const dashboard = load('src/lib/server/platformStaffDashboard.ts');
function insert(table, row) {
  const keys = Object.keys(row);
  sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
}
function event(businessId, path = '/admin/creator?/add_list_item&business=b&password=PRIVATE') {
  return { locals: { DB: db, businessId }, route: { id: '/admin/creator' },
    url: new URL('https://criminiops.com' + path), request: new Request('https://criminiops.com' + path,
      { method: 'POST', headers: { 'x-request-id': 'PRIVATE CLIENT VALUE' }, body: 'PRIVATE BODY HR PASSWORD BANK TAX' }) };
}
const quiet = console.warn;
console.warn = () => {};
try {
  for (const id of ['a', 'b']) insert('businesses', { id, name: 'Business ' + id, slug: id, created_at: now, updated_at: now });
  for (const id of ['owner', 'support', 'equipment', 'employee', 'other-tenant']) {
    insert('users', { id, email: id + '@example.invalid', email_normalized: id + '@example.invalid', display_name: id, created_at: now, updated_at: now });
    insert('business_users', { business_id: id === 'other-tenant' ? 'b' : 'a', user_id: id, created_at: now, updated_at: now });
  }
  for (const role of ['owner', 'support', 'equipment']) {
    insert('platform_staff_members', { user_id: role, staff_role: role, created_at: now, updated_at: now });
    insert('sessions', { id: role + '-session', user_id: role, session_token_hash: 'test-hash-' + role,
      created_at: now, last_seen_at: now, expires_at: now + 3600 });
    insert('platform_staff_step_up', { session_id: role + '-session', user_id: role, membership_revision: 1,
      verified_at: now, email_verified_at: now });
  }
  const before = test.queryCount;
  await collector.recordRequestDiagnostic(event('a'), 200, 150, { now, random: 0.5 });
  assert.equal(test.queryCount, before, 'Ordinary unsampled success must not read or write D1');
  await collector.recordRequestDiagnostic(event('a'), 400, 150, { now, random: 0 });
  assert.equal(test.queryCount, before, 'Normal validation is not a security or server-failure incident');
  await collector.recordRequestDiagnostic(event(undefined), 403, 150, { now, random: 0 });
  assert.equal(test.queryCount, before, 'Anonymous probes cannot create a D1 diagnostic write storm');
  await collector.recordRequestDiagnostic(event('a'), 500, 400, { now, random: 0.5 });
  await collector.recordRequestDiagnostic(event('a'), 503, 700, { now: now + 1, random: 0.5 });
  await collector.recordRequestDiagnostic(event('b'), 500, 100, { now, random: 0.5 });
  const issues = sqlite.prepare('SELECT * FROM platform_diagnostic_issues ORDER BY business_id').all();
  assert.equal(issues.length, 2);
  assert.equal(issues[0].business_id, 'a');
  assert.equal(issues[0].area, 'lists');
  assert.equal(issues[0].occurrences, 2);
  assert.equal(issues[1].occurrences, 1);
  assert.notEqual(issues[0].id, issues[1].id);
  assert.equal(JSON.stringify(issues).includes('PRIVATE'), false);
  assert.match(issues[0].last_request_id, /^[a-f0-9-]{36}$/);
  await collector.recordRequestDiagnostic(event('a'), 200, 120, { now, random: 0 });
  await collector.recordRequestDiagnostic(event('b'), 200, 780, { now, random: 0 });
  await collector.recordRequestDiagnostic(event('a'), 403, 50, { now, random: 0.5 });
  await collector.recordRequestDiagnostic(event('a'), 200, 2200, { now, random: 0.5 });
  const view = new URL('https://criminiops.com/staff?hours=24');
  const a = await dashboard.loadRequestDiagnostics(db, 'owner', view, 'a', now + 2);
  const b = await dashboard.loadRequestDiagnostics(db, 'support', view, 'b', now + 2);
  const all = await dashboard.loadRequestDiagnostics(db, 'owner', view, undefined, now + 2);
  assert.equal(a.metrics.errors, 2); assert.equal(b.metrics.errors, 1); assert.equal(all.metrics.errors, 3);
  assert.equal(a.metrics.averageMs, 120); assert.equal(b.metrics.averageMs, 780);
  assert.equal(all.metrics.averageMs, 450); assert.equal(a.metrics.denials, 1); assert.equal(a.metrics.slow, 1);
  assert.throws(() => insert('platform_request_metrics', { scope_key: 'business:a', business_id: 'b', bucket: 1 }), /CHECK constraint/);
  assert.ok(a.issues.every(row => row.business_id === 'a'));
  assert.ok(b.issues.every(row => row.business_id === 'b'));
  const beforeEquipment = test.queryCount;
  assert.equal((await dashboard.loadRequestDiagnostics(db, 'equipment', view, 'a', now)).metrics, null);
  assert.equal(test.queryCount, beforeEquipment, 'Equipment scope never reads app/performance diagnostics');
  await assert.rejects(dashboard.loadRequestDiagnostics(db, 'employee', view), { status: 403 });
  const skipped = test.queryCount;
  await collector.recordRequestDiagnostic({ ...event('a'), route: { id: '/staff/security' } }, 500, 5000, { now });
  await collector.recordRequestDiagnostic({ ...event('a'), route: { id: null } }, 500, 5000, { now });
  assert.equal(test.queryCount, skipped, 'Staff and unrecognized paths cannot pollute tenant diagnostics');
  console.log('PASS real collection: zero D1 work for ordinary successes/validation, safe grouped failures, separate tenant/global metrics, sampled timing and role boundaries');

  for (let i = 0; i < 25; i++) {
    const row = { ...event('a'), route: { id: '/lists/[domain]/[slug-' + i + ']' } };
    await collector.recordRequestDiagnostic(row, 500, 200, { now: now - 10, random: 0.5 });
  }
  const first = await dashboard.loadRequestDiagnostics(db, 'owner', view, 'a', now + 2);
  assert.equal(first.issues.length, 20); assert.ok(first.next);
  const secondUrl = new URL(view); secondUrl.searchParams.set('after', first.next);
  const second = await dashboard.loadRequestDiagnostics(db, 'owner', secondUrl, 'a', now + 2);
  assert.ok(second.issues.length > 0);
  assert.equal(second.issues.some(row => first.issues.some(old => row.id === old.id)), false);
  const filtered = new URL(view); filtered.searchParams.set('kind', 'access_denied');
  assert.ok((await dashboard.loadRequestDiagnostics(db, 'owner', filtered, 'a', now + 2)).issues.every(row => row.kind === 'access_denied'));
  const invalid = new URL(view); invalid.searchParams.set('after', 'not-a-cursor');
  await assert.rejects(dashboard.loadRequestDiagnostics(db, 'owner', invalid, 'a'), { status: 400 });
  for (const [id, business, seen] of [['a-off', 'a', now - 601], ['b-live', 'b', now], ['a-new', 'a', null], ['b-clock', 'b', now + 100]]) {
    insert('iot_devices', { id, business_id: business, device_type: 'sensor_gateway', external_device_id: id, display_name: id,
      key_hash: 'PRIVATE GATEWAY SECRET', key_prefix: 'PRIVATE', last_seen_at: seen, created_at: now, updated_at: now });
  }
  const gatewayA = await dashboard.loadGatewayAttention(db, view, 'a', now);
  assert.equal(gatewayA.gateways.length, 2);
  assert.ok(gatewayA.gateways.every(row => row.business_id === 'a'));
  const attention = await dashboard.loadGatewayAttention(db, view, undefined, now);
  assert.equal(attention.gateways.length, 3);
  assert.equal(attention.gateways.some(row => row.id === 'b-live'), false);
  assert.equal(JSON.stringify(attention).includes('PRIVATE'), false);
  console.log('PASS keyset pagination, type/time filters, invalid cursors and accurate business-scoped gateway health without credentials');

  insert('account_audit_logs', { id: 'audit-a', business_id: 'a', action: 'business_capabilities_updated', actor_user_id: 'owner', target_user_id: 'employee',
    metadata_json: '{"private":"PRIVATE HR DATA"}', created_at: now });
  insert('account_audit_logs', { id: 'audit-b', business_id: 'b', action: 'invite_created', actor_user_id: 'other-tenant', created_at: now });
  insert('account_audit_logs', { id: 'hr-a', business_id: 'a', action: 'employee_onboarding_item_submitted', actor_user_id: 'employee',
    metadata_json: '{"private":"PRIVATE HR DATA"}', created_at: now });
  insert('announcement_history', { id: 'post-a', business_id: 'a', content: 'PRIVATE ANNOUNCEMENT BODY', created_by: 'employee', created_at: now });
  insert('announcement_history', { id: 'post-b', business_id: 'b', content: 'OTHER TENANT CONTENT', created_by: 'other-tenant', created_at: now });
  const security = await dashboard.loadBusinessSecurity(db, 'owner', 'a', view, now + 2);
  assert.equal(security.events.length, 1); assert.equal(security.publications.length, 1);
  assert.equal(security.publications[0].created_by, 'employee');
  assert.equal(JSON.stringify(security).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(security).includes('other-tenant'), false);
  await assert.rejects(dashboard.loadBusinessSecurity(db, 'support', 'a', view), { status: 403 });
  await assert.rejects(dashboard.loadBusinessSecurity(db, 'equipment', 'a', view), { status: 403 });
  const staffRoot = load('src/routes/staff/+page.server.ts');
  for (const role of ['owner', 'support', 'equipment']) {
    const locals = { DB: db, userId: role, sessionId: role + '-session' };
    const home = await staffRoot.load({ locals, url: view });
    assert.equal(home.canViewActivity, role === 'owner');
    assert.equal(home.diagnostics.canViewApplication, role !== 'equipment');
    const detail = load('src/routes/staff/businesses/[id]/+page.server.ts');
    const privateTab = new URL('https://criminiops.com/staff/businesses/a?view=security');
    if (role !== 'owner') await assert.rejects(detail.load({ locals, params: { id: 'a' }, url: privateTab }), { status: 403 });
    else assert.equal((await detail.load({ locals, params: { id: 'a' }, url: privateTab })).security.publications.length, 1);
  }
  await assert.rejects(staffRoot.load({ locals: { DB: db, userId: 'employee' }, url: view }), { status: 403 });
  console.log('PASS actual dashboard/business routes: OTP and role guards, owner-only security metadata, tenant isolation, no announcement bodies or HR payloads');

  const originalAudit = sqlite.prepare('SELECT * FROM account_audit_logs ORDER BY id').all();
  const originalStaffAudit = sqlite.prepare('SELECT * FROM platform_staff_audit ORDER BY id').all();
  const stale = sqlite.prepare('SELECT id FROM platform_diagnostic_issues LIMIT 1').get();
  sqlite.prepare('UPDATE platform_diagnostic_issues SET last_seen_at=? WHERE id=?').run(now - 15 * 86400, stale.id);
  insert('platform_request_metrics', { scope_key: 'business:a', business_id: 'a', bucket: now - 8 * 86400 });
  const removed = await collector.cleanupPlatformDiagnostics(db, now);
  assert.equal(removed.issuesRemoved, 1); assert.equal(removed.metricBucketsRemoved, 1);
  assert.deepEqual(sqlite.prepare('SELECT * FROM account_audit_logs ORDER BY id').all(), originalAudit);
  assert.deepEqual(sqlite.prepare('SELECT * FROM platform_staff_audit ORDER BY id').all(), originalStaffAudit);
  const globalBefore = sqlite.prepare("SELECT * FROM platform_request_metrics WHERE scope_key='platform'").all();
  sqlite.prepare('DELETE FROM businesses WHERE id=?').run('a');
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM platform_diagnostic_issues WHERE business_id='a'").get().n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM platform_request_metrics WHERE business_id='a'").get().n, 0);
  assert.deepEqual(sqlite.prepare("SELECT * FROM platform_request_metrics WHERE scope_key='platform'").all(), globalBefore);
  assert.ok(sqlite.prepare("SELECT COUNT(*) n FROM platform_diagnostic_issues WHERE business_id='b'").get().n > 0);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  console.log('PASS bounded retention leaves security/staff audits unchanged; tenant removal clears only its diagnostics and preserves anonymous global aggregates');

  const queries = [
    ["SELECT id FROM platform_diagnostic_issues WHERE business_id=? AND last_seen_at>=? ORDER BY last_seen_at DESC,id DESC LIMIT 21", ['b', now - 86400], 'idx_platform_issues_business_recent'],
    ["SELECT success_samples FROM platform_request_metrics WHERE scope_key=? AND bucket>=?", ['business:b', now - 86400], 'sqlite_autoindex_platform_request_metrics_1'],
    ["SELECT id FROM account_audit_logs WHERE business_id=? AND created_at>=? ORDER BY created_at DESC,id DESC LIMIT 21", ['b', now - 86400], 'idx_account_audit_staff_recent']
  ];
  for (const [sql, bindings, index] of queries) {
    const plan = sqlite.prepare('EXPLAIN QUERY PLAN ' + sql).all(...bindings).map(row => row.detail).join(' ');
    assert.ok(plan.includes(index), plan);
    assert.equal(plan.includes('USE TEMP B-TREE'), false, plan);
  }
  const collectorSource = readFileSync('src/lib/server/platformDiagnostics.ts', 'utf8');
  for (const forbidden of ['request.formData(', 'request.json(', 'request.text(', 'metadata_json', 'error.message']) assert.equal(collectorSource.includes(forbidden), false);
  assert.equal(readFileSync('src/routes/staff/businesses/[id]/+page.server.ts', 'utf8').includes('export const actions'), false);
  console.log('PASS indexed bounded read plans, no request-body/error-message collection and no new intervention actions');
} finally { console.warn = quiet; test.close(); }
