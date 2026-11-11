import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

const load = loadServerModules({ '#lib/server/security.ts': { checkRateLimit: async () => ({ allowed: true }),
  rateLimitFailure: message => ({ status: 429, data: { error: message } }) } });
const staff = load('src/lib/server/platformStaff.ts');
const forms = load('src/lib/server/platformStaffForm.ts');
const equipment = load('src/routes/staff/equipment/+page.server.ts');
const team = load('src/routes/staff/team/+page.server.ts');
const security = load('src/routes/staff/security/+page.server.ts');
const support = load('src/lib/server/platformSupport.ts');
const collector = load('src/lib/server/platformDiagnostics.ts');

function fixture() {
  const test = createTestD1(), { sqlite, db } = test, now = Math.floor(Date.now() / 1000);
  const insert = (table, row) => {
    const keys = Object.keys(row);
    sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
  };
  for (const id of ['a', 'b']) insert('businesses', { id, name: id, slug: id, created_at: now, updated_at: now });
  for (const role of ['owner', 'support', 'equipment', 'customer']) {
    insert('users', { id: role, email: role + '@example.invalid', email_normalized: role + '@example.invalid', created_at: now, updated_at: now });
    insert('sessions', { id: role + '-session', user_id: role, session_token_hash: 'fixture-' + role, created_at: now, last_seen_at: now, expires_at: now + 3600 });
    if (role !== 'customer') {
      insert('platform_staff_members', { user_id: role, staff_role: role, granted_by: role === 'owner' ? null : 'owner', created_at: now, updated_at: now });
      insert('platform_staff_step_up', { session_id: role + '-session', user_id: role, membership_revision: 1, verified_at: now, email_verified_at: now });
    } else insert('business_users', { business_id: 'a', user_id: role, created_at: now, updated_at: now });
  }
  for (const serial of ['gateway-one', 'gateway-two']) insert('iot_device_inventory', { serial, device_type: 'sensor_gateway', key_hash: 'a'.repeat(64), key_prefix: 'fixture', created_at: now, updated_at: now });
  const locals = (role = 'owner') => ({ DB: db, env: { DB: db }, userId: role, sessionId: role + '-session', businessId: 'a' });
  const version = (serial = 'gateway-one') => sqlite.prepare('SELECT reservation_id FROM iot_device_reservations WHERE serial=?').get(serial).reservation_id;
  const audit = () => sqlite.prepare('SELECT * FROM platform_staff_audit ORDER BY id').all();
  const actor = { userId: 'owner', role: 'owner' };
  return { ...test, get queryCount() { return test.queryCount; }, now, insert, locals, version, audit, actor };
}
let count = 0;
async function check(label, action) {
  const t = fixture();
  try { await action(t); count++; console.log('PASS ' + label); }
  finally { t.close(); }
}

await check('Staff read/write authorization uses one current role/proof snapshot, never browser/global restaurant roles', async t => {
  for (const [role, allowed] of [['owner', ['owner']], ['support', ['support']], ['equipment', ['equipment']]]) {
    for (const method of ['requirePlatformStaff', 'requireStaffStepUp']) {
      const before = t.queryCount;
      assert.equal((await staff[method](t.locals(role), allowed)).role, role);
      assert.equal(t.queryCount - before, 1);
    }
  }
  await assert.rejects(staff.requirePlatformStaff({ ...t.locals('customer'), userRole: 'admin', businessRole: 'owner', platformStaff: t.actor }), { status: 403 });
  await assert.rejects(staff.requirePlatformStaff(t.locals('support'), ['owner']), { status: 403 });
  t.sqlite.prepare("UPDATE platform_staff_members SET staff_role='support', revision=revision+1 WHERE user_id='equipment'").run();
  await assert.rejects(staff.requirePlatformStaff(t.locals('equipment')), { status: 403 });
  t.insert('platform_staff_step_up', { session_id: 'equipment-session', user_id: 'equipment', membership_revision: 2, verified_at: t.now, email_verified_at: t.now });
  assert.equal((await staff.requirePlatformStaff(t.locals('equipment'))).role, 'support');
  await assert.rejects(staff.requireStaffStepUp(t.locals('equipment'), ['equipment']), { status: 403 });
});

await check('Staff proof, user, session and device revocation fail closed without changing the account', async t => {
  const row = t.sqlite.prepare("SELECT * FROM users WHERE id='support'").get();
  t.sqlite.prepare("UPDATE platform_staff_step_up SET verified_at=?,email_verified_at=? WHERE user_id='support'").run(t.now - 901, t.now - 901);
  assert.equal((await staff.requirePlatformStaff(t.locals('support'))).role, 'support');
  await assert.rejects(staff.requireStaffStepUp(t.locals('support')), { status: 403 });
  t.sqlite.prepare("UPDATE platform_staff_step_up SET verified_at=?,email_verified_at=? WHERE user_id='support'").run(t.now, t.now);
  t.insert('devices', { id: 'device', user_id: 'support', name: 'Fixture', created_at: t.now, updated_at: t.now, last_seen_at: t.now });
  t.sqlite.prepare("UPDATE sessions SET device_id='device' WHERE id='support-session'").run();
  t.sqlite.prepare("UPDATE devices SET revoked_at=? WHERE id='device'").run(t.now);
  await assert.rejects(staff.requirePlatformStaff(t.locals('support')), { status: 403 });
  assert.deepEqual(t.sqlite.prepare("SELECT * FROM users WHERE id='support'").get(), row);
});

await check('Gateway release is fenced to the business and the exact reservation, including same-second replacements', async t => {
  await staff.reserveGateway(t.db, t.actor, 'gateway-one', 'a', 'Shipment', 'owner-session');
  const old = t.version();
  await staff.releaseGatewayReservation(t.db, t.actor, 'gateway-one', 'a', old, 'Cancel', 'owner-session');
  await staff.reserveGateway(t.db, t.actor, 'gateway-one', 'b', 'Replacement', 'owner-session');
  const current = t.version(), before = t.audit();
  assert.notEqual(current, old);
  await assert.rejects(staff.releaseGatewayReservation(t.db, t.actor, 'gateway-one', 'a', old, 'Old page', 'owner-session'), { status: 409 });
  await assert.rejects(staff.releaseGatewayReservation(t.db, t.actor, 'gateway-one', 'a', current, 'Wrong business', 'owner-session'), { status: 409 });
  await assert.rejects(staff.releaseGatewayReservation(t.db, t.actor, 'gateway-one', 'b', old, 'Old version', 'owner-session'), { status: 409 });
  assert.equal(t.version(), current); assert.deepEqual(t.audit(), before);
  await staff.releaseGatewayReservation(t.db, t.actor, 'gateway-one', 'b', current, 'Cancel replacement', 'owner-session');
  const after = t.audit();
  await assert.rejects(staff.releaseGatewayReservation(t.db, t.actor, 'gateway-one', 'b', current, 'Retry', 'owner-session'), { status: 409 });
  assert.deepEqual(t.audit(), after);
});

await check('Gateway release cannot erase an already claimed device or bypass audit rollback', async t => {
  await staff.reserveGateway(t.db, t.actor, 'gateway-one', 'a', 'Shipment', 'owner-session');
  const id = t.version(), before = t.audit();
  t.sqlite.exec("CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON platform_staff_audit BEGIN SELECT RAISE(ABORT,'fixture audit rollback'); END");
  await assert.rejects(staff.releaseGatewayReservation(t.db, t.actor, 'gateway-one', 'a', id, 'Cancel', 'owner-session'), /fixture audit rollback/);
  assert.equal(t.version(), id); assert.deepEqual(t.audit(), before);
  t.sqlite.exec('DROP TRIGGER fixture_audit_failure');
  t.insert('iot_devices', { id: 'claimed', business_id: 'a', device_type: 'sensor_gateway', external_device_id: 'gateway-one', display_name: 'Gateway', key_hash: 'a'.repeat(64), key_prefix: 'fixture', created_at: t.now, updated_at: t.now });
  await assert.rejects(staff.releaseGatewayReservation(t.db, t.actor, 'gateway-one', 'a', id, 'Too late', 'owner-session'), { status: 409 });
  assert.equal(t.version(), id); assert.deepEqual(t.audit(), before);
});

await check('The actual equipment form round-trips its hidden version and rejects old forms without destructive fallback', async t => {
  const result = await equipment.actions.reserve({ locals: t.locals(), request: formRequest({ serial: 'gateway-one', business_id: 'a', reason: 'Shipment', confirmed: 'yes' }, '/staff/equipment?/reserve') });
  assert.equal(result.success, true);
  const data = await equipment.load({ locals: t.locals(), url: new URL('https://criminiops.com/staff/equipment?business=a') });
  const row = data.equipment.find(row => row.serial === 'gateway-one');
  assert.equal(row.reservation_id, t.version()); assert.equal(row.reserved_business_id, 'a');
  const fields = { serial: row.serial, business_id: row.reserved_business_id, reason: 'Cancel', confirmed: 'yes' };
  assert.equal((await equipment.actions.release({ locals: t.locals(), request: formRequest(fields, '/staff/equipment?/release') })).status, 400);
  assert.equal(t.version(), row.reservation_id);
  assert.equal((await equipment.actions.release({ locals: t.locals(), request: formRequest({ ...fields, reservation_id: row.reservation_id }, '/staff/equipment?/release') })).success, true);
});

await check('Reservation mutation rechecks proof at commit time and cannot create a success audit after revocation', async t => {
  const before = t.audit();
  const db = { ...t.db, async batch(statements) {
    t.sqlite.prepare("DELETE FROM platform_staff_step_up WHERE user_id='owner'").run();
    return t.db.batch(statements);
  } };
  await assert.rejects(staff.reserveGateway(db, t.actor, 'gateway-one', 'a', 'Revoked', 'owner-session'), { status: 409 });
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM iot_device_reservations').get().n, 0);
  assert.deepEqual(t.audit(), before);
});

await check('Staff forms bound actual streamed bytes, reject files/unsupported/malformed content and preserve ordinary forms', async () => {
  assert.equal((await forms.readStaffForm(formRequest({ code: '123456', reason: 'Shipment' }, '/staff/security'))).get('code'), '123456');
  await assert.rejects(forms.readStaffForm(new Request('https://fixture.invalid', { method: 'POST', body: 'x=small', headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': '40000' } })), { status: 413 });
  let cancelled = false;
  const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(33000)); }, cancel() { cancelled = true; } });
  await assert.rejects(forms.readStaffForm(new Request('https://fixture.invalid', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, duplex: 'half' })), { status: 413 });
  assert.equal(cancelled, true);
  await assert.rejects(forms.readStaffForm(new Request('https://fixture.invalid', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })), { status: 415 });
  await assert.rejects(forms.readStaffForm(new Request('https://fixture.invalid', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=broken' }, body: 'not a multipart form' })), { status: 400 });
  const upload = new FormData(); upload.set('file', new Blob(['private']), 'file.txt');
  await assert.rejects(forms.readStaffForm(new Request('https://fixture.invalid', { method: 'POST', body: upload })), { status: 400 });
});

await check('All three Staff write pages reject oversized forms before mutations or OTP processing', async t => {
  const before = t.audit();
  for (const action of [equipment.actions.reserve, team.actions.default, security.actions.default]) {
    await assert.rejects(action({ locals: t.locals(), request: new Request('https://criminiops.com/staff/security', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'reason=' + 'x'.repeat(33000)
    }) }), { status: 413 });
  }
  assert.deepEqual(t.audit(), before);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM platform_staff_email_challenges').get().n, 0);
});

await check('Customer Support honors revoked device access at context and commit time', async t => {
  const context = await support.customerSupportContext(t.locals('customer'));
  const id = await support.createSupportRequest(t.db, context, { subject: 'Fixture', body: 'Help', category: 'application', submission_id: crypto.randomUUID() }, t.now);
  t.insert('devices', { id: 'customer-device', user_id: 'customer', name: 'Fixture', created_at: t.now, updated_at: t.now, last_seen_at: t.now });
  t.sqlite.exec("UPDATE sessions SET device_id='customer-device' WHERE user_id='customer'");
  t.sqlite.prepare("UPDATE devices SET revoked_at=? WHERE id='customer-device'").run(t.now);
  assert.equal(await support.customerSupportContext(t.locals('customer')), null);
  await assert.rejects(support.updateSupportRequest(t.db, context, id, { revision: 1, body: 'Not authorized' }, t.now), { status: 409 });
  assert.equal(t.sqlite.prepare('SELECT revision FROM platform_support_requests WHERE id=?').get(id).revision, 1);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM platform_support_messages WHERE request_id=?').get(id).n, 1);
});

await check('Diagnostic operation cardinality is bounded; GET queries cannot pretend a write action executed', async t => {
  const warn = console.warn; console.warn = () => {};
  try {
    for (let i = 0; i < 20; i++) {
      const url = new URL('https://fixture.invalid/app?private=PRIVATE&/delete_recipe');
      await collector.recordRequestDiagnostic({ locals: t.locals(), route: { id: '/app' }, url, request: new Request(url, { method: 'PRIVATE-' + i }) }, 500, 100, { now: t.now });
    }
    assert.deepEqual(t.sqlite.prepare('SELECT operation,occurrences FROM platform_diagnostic_issues').all().map(row => ({ ...row })), [{ operation: 'OTHER', occurrences: 20 }]);
    const url = new URL('https://fixture.invalid/app?/delete_recipe');
    await collector.recordRequestDiagnostic({ locals: t.locals(), route: { id: '/app' }, url, request: new Request(url) }, 500, 100, { now: t.now });
    assert.equal(t.sqlite.prepare("SELECT occurrences FROM platform_diagnostic_issues WHERE operation='GET'").get().occurrences, 1);
    assert.equal(JSON.stringify(t.sqlite.prepare('SELECT * FROM platform_diagnostic_issues').all()).includes('PRIVATE'), false);
  } finally { console.warn = warn; }
});

await check('Diagnostic retention drains a larger indexed backlog in bounded batches without changing current data or audits', async t => {
  const old = t.now - 20 * 86400;
  t.sqlite.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<3005)
    INSERT INTO platform_diagnostic_issues(id,business_id,area,route_id,operation,kind,status,first_seen_at,last_seen_at,max_duration_ms,last_request_id)
    SELECT 'old-'||x,'a','application','/app','GET','server_error',500,?,?,0,'fixture' FROM n`).run(old, old);
  t.sqlite.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<3005)
    INSERT INTO platform_request_metrics(scope_key,business_id,bucket) SELECT 'business:a','a',?-x*3600 FROM n`).run(old);
  t.insert('platform_diagnostic_issues', { id: 'current', business_id: 'b', area: 'application', route_id: '/app', operation: 'GET',
    kind: 'server_error', status: 500, first_seen_at: t.now, last_seen_at: t.now, max_duration_ms: 1, last_request_id: 'fixture' });
  t.insert('platform_request_metrics', { scope_key: 'business:b', business_id: 'b', bucket: Math.floor(t.now / 3600) * 3600 });
  const audits = t.audit(), before = t.queryCount;
  const result = await collector.cleanupPlatformDiagnostics(t.db, t.now);
  assert.deepEqual(result, { issuesRemoved: 3005, metricBucketsRemoved: 3005, batches: 2 });
  assert.equal(t.queryCount - before, 4);
  assert.deepEqual(t.audit(), audits);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM platform_diagnostic_issues').get().n, 1);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM platform_request_metrics').get().n, 1);
  for (const [sql, index] of [
    ['SELECT id FROM platform_diagnostic_issues WHERE last_seen_at < ? ORDER BY last_seen_at LIMIT 2000', 'idx_platform_issues_recent'],
    ['SELECT scope_key,bucket FROM platform_request_metrics WHERE bucket < ? ORDER BY bucket LIMIT 2000', 'idx_platform_metrics_expiry']
  ]) {
    const plan = t.sqlite.prepare('EXPLAIN QUERY PLAN ' + sql).all(old).map(row => row.detail).join(' ');
    assert.ok(plan.includes(index), plan); assert.equal(plan.includes('USE TEMP B-TREE'), false, plan);
  }
});

const base = readFileSync('scripts/fixtures/current-schema.sql', 'utf8');
const migration = readFileSync('migrations/0117_staff_reservation_versions.sql', 'utf8');
for (const failure of [false, true]) {
  const t = createTestD1(base);
  try {
    t.sqlite.exec("INSERT INTO businesses(id,name,slug,created_at,updated_at) VALUES('a','A','a',1,1); INSERT INTO iot_device_inventory(serial,device_type,key_hash,key_prefix,created_at,updated_at) VALUES('gateway','sensor_gateway','fixture','fixture',1,1); INSERT INTO iot_device_reservations(serial,business_id,created_at) VALUES('gateway','a',1)");
    const before = t.sqlite.prepare('SELECT * FROM iot_device_reservations').all();
    if (failure) t.sqlite.exec('CREATE INDEX idx_iot_reservation_version ON businesses(id)');
    t.sqlite.exec('BEGIN');
    try { t.sqlite.exec(migration); if (failure) assert.fail('Expected migration failure'); t.sqlite.exec('COMMIT'); }
    catch (error) { t.sqlite.exec('ROLLBACK'); if (!failure) throw error; }
    if (failure) {
      assert.deepEqual(t.sqlite.prepare('SELECT * FROM iot_device_reservations').all(), before);
      assert.equal(t.sqlite.prepare('PRAGMA table_info(iot_device_reservations)').all().some(row => row.name === 'reservation_id'), false);
    } else {
      const version = t.sqlite.prepare('SELECT reservation_id FROM iot_device_reservations').get().reservation_id;
      assert.match(version, /^[a-f0-9]{32}$/);
      assert.deepEqual(t.sqlite.prepare('SELECT serial,business_id,reserved_by,created_at FROM iot_device_reservations').all(), before);
      assert.throws(() => t.sqlite.exec("UPDATE iot_device_reservations SET reservation_id='different'"), /before replacing/);
      t.sqlite.exec("DELETE FROM iot_device_reservations; INSERT INTO iot_device_reservations(serial,business_id,created_at) VALUES('gateway','a',1)");
      assert.notEqual(t.sqlite.prepare('SELECT reservation_id FROM iot_device_reservations').get().reservation_id, version);
    }
    assert.deepEqual(t.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { t.close(); }
}
console.log(`PASS ${count} actual-schema Staff operation groups plus migration preservation, old-insert compatibility, immutable versions and failure rollback`);
