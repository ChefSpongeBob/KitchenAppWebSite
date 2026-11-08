import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

let failures = 0;
async function check(label, work) {
  const test = createTestD1();
  const { sqlite } = test;
  let writes = Promise.resolve();
  // D1 serializes transactions; concurrent handlers must not create nested SQLite transactions.
  const db = { prepare: test.db.prepare, batch(statements) {
    const result = writes.then(() => test.db.batch(statements));
    writes = result.catch(() => {});
    return result;
  } };
  const load = loadServerModules({ '#lib/server/observability.ts': { logOperationalEvent() {}, logOperationalError() {} } });
  const now = Math.floor(Date.now() / 1000);
  function insert(table, row) {
    const keys = Object.keys(row);
    sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
  }
  try {
    for (const id of ['a', 'b']) {
      insert('businesses', { id, slug: id, name: id, created_at: now, updated_at: now });
      insert('users', { id: 'owner-' + id, email: `owner-${id}@example.invalid`, email_normalized: `owner-${id}@example.invalid`, created_at: now, updated_at: now });
      insert('business_users', { business_id: id, user_id: 'owner-' + id, role: 'owner', permission_template: 'owner', created_at: now, updated_at: now });
      insert('business_trials', { business_id: id, owner_user_id: 'owner-' + id, status: 'active', trial_started_at: now, trial_ends_at: now, created_at: now, updated_at: now });
      insert('iot_device_inventory', { serial: 'fixture-gateway-' + id, device_type: 'sensor_gateway', key_hash: createHash('sha256').update('fixture-credential-' + id).digest('hex'), key_prefix: 'fixture', created_at: now, updated_at: now });
    }
    const provisioning = load('src/lib/server/temperatureDeviceProvisioning.ts');
    const gateways = {};
    for (const id of ['a', 'b']) gateways[id] = await provisioning.claimTemperatureGateway(db, { businessId: id, serial: 'fixture-gateway-' + id, displayName: 'Gateway', createdBy: 'owner-' + id });
    const node = await provisioning.claimTemperatureSensorNode(db, { businessId: 'a', gatewayDeviceId: gateways.a.id, nodeSerial: 'fixture-node-a', displayName: 'Walk-in', createdBy: 'owner-a' });
    const api = load('src/routes/api/temps/+server.ts');
    const locals = (business = 'a', database = db) => ({ DB: database, env: { DB: database }, businessId: business, userId: 'owner-' + business, userRole: 'admin', businessRole: 'owner', businessPermissionTemplate: 'owner' });
    const reading = (extra = {}) => ({ node_serial: 'fixture-node-a', temperature: 37, humidity_pct: 48.5, packet_sequence: 1, wake_nonce: 'abcdef01', lqi: 200, ts: now, ...extra });
    async function post(body, { business = 'a', database = db, headers = {} } = {}) {
      const request = new Request('https://criminiops.com/api/temps', { method: 'POST', headers: {
        'content-type': 'application/json', 'x-device-id': 'fixture-gateway-' + business, 'x-device-key': 'fixture-credential-' + business, ...headers
      }, body: typeof body === 'string' ? body : JSON.stringify(body) });
      return api.POST({ request, url: new URL(request.url), locals: locals(business, database) });
    }
    await work({ sqlite, db, test, load, insert, provisioning, gateways, node, api, locals, reading, post, now });
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    console.log('PASS ' + label);
  } catch (error) {
    failures++;
    console.error('FAIL ' + label + ': ' + error.message);
  } finally { await writes; test.close(); }
}

await check('gateway claim rolls back device creation when inventory update fails', async ({ sqlite, db, insert, provisioning, now }) => {
  insert('iot_device_inventory', { serial: 'fixture-gateway-fail', device_type: 'sensor_gateway', key_hash: 'a'.repeat(64), key_prefix: 'fixture', created_at: now, updated_at: now });
  sqlite.exec("CREATE TRIGGER fail_claim BEFORE UPDATE ON iot_device_inventory WHEN NEW.serial='fixture-gateway-fail' BEGIN SELECT RAISE(ABORT,'fixture inventory failure'); END");
  await assert.rejects(provisioning.claimTemperatureGateway(db, { businessId: 'a', serial: 'fixture-gateway-fail', displayName: 'Failed' }), /fixture inventory failure/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM iot_devices WHERE external_device_id='fixture-gateway-fail'").get().n, 0);
});

await check('reading and node-state writes roll back together', async ({ sqlite, post, reading }) => {
  sqlite.exec("CREATE TRIGGER fail_node BEFORE UPDATE ON temperature_sensor_nodes BEGIN SELECT RAISE(ABORT,'fixture node failure'); END");
  await assert.rejects(post(reading()), /fixture node failure/);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM temps').get().n, 0);
});

await check('concurrent replay with a different nonce cannot insert a second reading', async ({ sqlite, db, post, reading }) => {
  let lookups = 0; let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const racing = { ...db, prepare(sql) {
    const original = db.prepare(sql);
    const statement = { bind(...values) { original.bind(...values); return statement; } };
    for (const method of ['first', 'all', 'run']) statement[method] = async (...args) => {
      const value = await original[method](...args);
      if (sql.trimStart().startsWith('SELECT') && sql.includes('packet_sequence') && sql.includes('FROM temperature_sensor_nodes')) {
        if (++lookups === 2) release();
        await barrier;
      }
      return value;
    };
    return statement;
  } };
  const responses = await Promise.all([post(reading(), { database: racing }), post(reading({ wake_nonce: 'abcdef02' }), { database: racing })]);
  const outcomes = await Promise.all(responses.map(response => response.json()));
  assert.equal(outcomes.reduce((sum, result) => sum + result.accepted, 0), 1);
  assert.equal(outcomes.reduce((sum, result) => sum + result.rejected, 0), 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM temps').get().n, 1);
  assert.equal(sqlite.prepare("SELECT packet_sequence FROM temperature_sensor_nodes WHERE node_serial='fixture-node-a'").get().packet_sequence, 1);
});

await check('boolean temperatures are rejected rather than becoming a one-degree reading', async ({ post, reading, sqlite }) => {
  assert.equal((await post(reading({ temperature: true }))).status, 400);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM temps').get().n, 0);
});

await check('delayed gateway uploads cannot make old node measurements current', async ({ post, reading, now, load, db }) => {
  assert.equal((await post(reading({ ts: now - 3600 }))).status, 201);
  const [snapshot] = await load('src/lib/server/temperatureMonitoring.ts').loadLatestTemperatureSnapshots(db, 'a');
  assert.equal(snapshot.connection_status, 'offline');
  assert.equal(snapshot.temperature, null);
});

await check('20-minute readings stay current until 25 minutes; deeper offline remains 45 minutes', async ({ post, reading, now, load, db, sqlite }) => {
  const monitoring = load('src/lib/server/temperatureMonitoring.ts');
  assert.equal(monitoring.defaultTemperatureSetting(1).stale_after_minutes, 25);
  assert.equal(monitoring.defaultTemperatureSetting(1).offline_after_minutes, 45);
  assert.equal((await post(reading())).status, 201);
  const [snapshot] = await monitoring.loadLatestTemperatureSnapshots(db, 'a');
  for (const seconds of [20 * 60, 25 * 60 - 1]) {
    const state = monitoring.deriveTemperatureSnapshotState(snapshot, now + seconds);
    assert.equal(state.connection_status, 'online');
    assert.equal(state.temperature, 37);
  }
  const expired = monitoring.deriveTemperatureSnapshotState(snapshot, now + 25 * 60);
  assert.equal(expired.connection_status, 'offline'); assert.equal(expired.temperature, null);
  await monitoring.processTemperatureStaleAlerts(db, 'a', now + 20 * 60);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM temperature_alert_events').get().n, 0);
  await monitoring.processTemperatureStaleAlerts(db, 'a', now + 25 * 60);
  assert.equal(sqlite.prepare("SELECT event_type FROM temperature_alert_events WHERE status='active'").get().event_type, 'stale');
  await monitoring.processTemperatureStaleAlerts(db, 'a', now + 45 * 60);
  assert.equal(sqlite.prepare("SELECT event_type FROM temperature_alert_events WHERE status='active'").get().event_type, 'offline');
});

await check('saved per-node continuity and offline settings are preserved', async ({ post, reading, now, load, db, node, sqlite }) => {
  const monitoring = load('src/lib/server/temperatureMonitoring.ts');
  await monitoring.saveTemperatureSensorSetting(db, {
    businessId: 'a', sensorId: node.sensorId, highThreshold: 42, lowThreshold: 32,
    staleAfterMinutes: 15, offlineAfterMinutes: 60, alertCooldownMinutes: 60, isAlertingEnabled: true
  });
  assert.equal((await post(reading())).status, 201);
  const [snapshot] = await monitoring.loadLatestTemperatureSnapshots(db, 'a');
  assert.equal(snapshot.stale_after_minutes, 15); assert.equal(snapshot.offline_after_minutes, 60);
  await monitoring.processTemperatureStaleAlerts(db, 'a', now + 20 * 60);
  assert.equal(sqlite.prepare("SELECT event_type FROM temperature_alert_events WHERE status='active'").get().event_type, 'stale');
  const [setting] = await monitoring.loadTemperatureSensorSettings(db, 'a');
  assert.equal(setting.stale_after_minutes, 15); assert.equal(setting.offline_after_minutes, 60);
});

await check('Staff gateway health/overview/attention keep the separate 10-minute heartbeat window', async ({ load, db, sqlite, gateways, now }) => {
  const health = load('src/lib/server/platformHealth.ts');
  assert.equal(health.gatewayConnection(now - 599, now), 'Online');
  assert.equal(health.gatewayConnection(now - 600, now), 'Offline');
  sqlite.prepare('UPDATE iot_devices SET last_seen_at=? WHERE id=?').run(now - 1200, gateways.a.id);
  const overview = await load('src/lib/server/platformStaffOverview.ts').loadStaffOverview(db, 'owner', new URL('https://criminiops.com/staff'), now);
  assert.equal(overview.gateways.online, 0); assert.equal(overview.gateways.offline, 1);
  const attention = await load('src/lib/server/platformStaffDashboard.ts').loadGatewayAttention(db, new URL('https://criminiops.com/staff'), undefined, now);
  assert.equal(attention.gateways.find(row => row.id === gateways.a.id).connection, 'Offline');
});

await check('20-minute high readings retain one-hour continuity but a gap over 25 minutes resets it', async ({ load, db, node, sqlite, now, gateways }) => {
  const monitoring = load('src/lib/server/temperatureMonitoring.ts');
  const originalNow = Date.now;
  const evaluate = async (seconds) => {
    Date.now = () => (now + seconds) * 1000;
    await monitoring.evaluateTemperatureReadings(db, { businessId: 'a', deviceId: gateways.a.id,
      readings: [{ sensor_id: node.sensorId, temperature: 60, humidity_pct: 48, ts: now + seconds }]
    });
    return sqlite.prepare("SELECT * FROM temperature_alert_events WHERE event_type='high'").get();
  };
  try {
    for (const seconds of [0, 1200, 2400, 3600]) {
      const alert = await evaluate(seconds);
      assert.equal(alert.first_seen_at, now); assert.equal(alert.notification_ready_at, now + 3600);
      assert.equal(alert.last_seen_at, now + seconds);
      assert.equal(alert.notification_ready_at <= now + seconds, seconds === 3600);
    }
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM temperature_alert_events').get().n, 1);
    const reset = await evaluate(3600 + 25 * 60 + 1);
    assert.equal(reset.first_seen_at, now + 3600 + 25 * 60 + 1);
    assert.equal(reset.notification_ready_at, reset.first_seen_at + 3600);
  } finally { Date.now = originalNow; }
});

await check('inactive billing cannot upload while the approved active test tenant remains allowed', async ({ sqlite, post, reading }) => {
  sqlite.exec("UPDATE business_trials SET status='pending_payment' WHERE business_id='a'");
  assert.equal((await post(reading())).status, 403);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM temps').get().n, 0);
  sqlite.exec("UPDATE business_trials SET status='active' WHERE business_id='a'");
  assert.equal((await post(reading())).status, 201);
});

await check('revocation between lookup and persistence cannot write readings', async ({ db, sqlite, post, reading }) => {
  let revoked = false;
  const racing = { ...db, async batch(statements) {
    if (!revoked) { revoked = true; sqlite.exec("UPDATE temperature_sensor_nodes SET is_active=0, revoked_at=1 WHERE node_serial='fixture-node-a'"); }
    return db.batch(statements);
  } };
  await post(reading(), { database: racing });
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM temps').get().n, 0);
});

await check('Wi-Fi confirmation rejects impossible future gateway check-ins', async ({ sqlite, load, locals, gateways, now }) => {
  sqlite.prepare('UPDATE iot_devices SET last_seen_at=? WHERE id=?').run(now + 3600, gateways.a.id);
  const result = await load('src/routes/admin/sensors/+page.server.ts').actions.gateway_connection({
    request: formRequest({ gateway_id: gateways.a.id, started_at: now - 60 }, '/admin/sensors'), locals: locals(), setHeaders() {}
  });
  assert.equal(result.connected, false);
});

await check('real sensor action, ingest, summaries and replay preserve the assigned tenant/name/values', async ({ sqlite, db, load, gateways, locals, api, post, reading, now }) => {
  const actions = load('src/routes/admin/sensors/+page.server.ts').actions;
  assert.equal((await actions.register_sensor({ request: formRequest({ external_device_id: 'second-node', gateway_device_id: gateways.a.id, display_name: 'Freezer' }), locals: locals() })).success, true);
  assert.equal((await actions.register_sensor({ request: formRequest({ external_device_id: 'wrong-gateway', gateway_device_id: gateways.b.id, display_name: 'Wrong' }), locals: locals() })).status, 400);
  const response = await post(reading({ battery_mv: 2900, rssi: -61 }));
  assert.equal(response.status, 201); assert.deepEqual(await response.json(), { accepted: 1, rejected: 0, inserted: 1 });
  const row = sqlite.prepare('SELECT * FROM temps').get();
  assert.equal(row.business_id, 'a'); assert.equal(row.temperature, 37); assert.equal(row.humidity_pct, 48.5);
  const node = sqlite.prepare("SELECT * FROM temperature_sensor_nodes WHERE node_serial='fixture-node-a'").get();
  assert.equal(node.last_seen_at, now); assert.equal(node.packet_sequence, 1); assert.equal(node.battery_mv, 2900); assert.equal(node.lqi, 200);
  const before = { ...node };
  assert.deepEqual(await (await post(reading({ wake_nonce: 'different-nonce', ts: now + 1 }))).json(), { accepted: 0, rejected: 1, inserted: 0 });
  assert.deepEqual({ ...sqlite.prepare('SELECT * FROM temperature_sensor_nodes WHERE id=?').get(node.id) }, before);
  const snapshots = await load('src/lib/server/temperatureMonitoring.ts').loadLatestTemperatureSnapshots(db, 'a');
  assert.equal(snapshots.find(row => row.name === 'Walk-in').temperature, 37);
  const other = await api.GET({ locals: locals('b'), url: new URL('https://criminiops.com/api/temps?view=latest') });
  assert.deepEqual(await other.json(), []);
  const history = await api.GET({ locals: locals(), url: new URL('https://criminiops.com/api/temps?view=summary') });
  assert.equal((await history.json()).history.length, 1);
});

await check('authenticated heartbeats confirm Wi-Fi but never freshen a node or contain factory credentials', async ({ sqlite, db, load, locals, gateways, post, now }) => {
  const actions = load('src/routes/admin/sensors/+page.server.ts').actions;
  const actionEvent = (fields, business = 'a') => ({ request: formRequest(fields, '/admin/sensors'), locals: locals(business), setHeaders(headers) { assert.equal(headers['cache-control'], 'no-store'); }, getClientAddress() { return '127.0.0.1'; } });
  const setup = await actions.gateway_setup(actionEvent({ gateway_id: gateways.a.id }));
  assert.equal(setup.success, true); assert.equal(setup.provisioning.networkName, 'Crimini-fixture-gateway-a');
  assert.equal(setup.provisioning.setupUrl, 'http://192.168.4.1/'); assert.equal(setup.provisioning.networkPassword.length, 32);
  assert.equal(JSON.stringify(setup).includes('fixture-credential-a'), false);
  assert.equal((await actions.gateway_setup(actionEvent({ gateway_id: gateways.a.id }, 'b'))).status, 400);
  const fields = { gateway_id: gateways.a.id, started_at: now - 60 };
  sqlite.prepare('UPDATE iot_devices SET last_seen_at=? WHERE id=?').run(now - 120, gateways.a.id);
  assert.equal((await actions.gateway_connection(actionEvent(fields))).connected, false);
  const before = sqlite.prepare('SELECT * FROM temperature_sensor_nodes').all();
  const response = await post({ gateway_status: true });
  assert.deepEqual(await response.json(), { connected: true }); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await actions.gateway_connection(actionEvent(fields))).connected, true);
  assert.deepEqual(sqlite.prepare('SELECT * FROM temperature_sensor_nodes').all(), before);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM temps').get().n, 0);
  assert.equal(JSON.stringify(sqlite.prepare('SELECT metadata_json FROM account_audit_logs').all()).includes(setup.provisioning.networkPassword), false);
  assert.equal((await post({ gateway_status: true, password: 'must-not-enter-D1' })).status, 400);
  assert.equal((await load('src/lib/server/temperatureMonitoring.ts').loadLatestTemperatureSnapshots(db, 'a'))[0].connection_status, 'never');
});

await check('bad credentials, tenant hints, foreign nodes, disabled features and revocation fail closed', async ({ db, sqlite, load, post, reading, gateways }) => {
  assert.equal((await post(reading(), { headers: { 'x-device-key': 'wrong' } })).status, 401);
  assert.equal((await post(reading(), { headers: { 'x-business-id': 'b' } })).status, 401);
  assert.deepEqual(await (await post(reading(), { business: 'b' })).json(), { accepted: 0, rejected: 1, inserted: 0 });
  assert.deepEqual(await (await post({ readings: [reading(), reading({ node_serial: 'unregistered' })] })).json(), { accepted: 1, rejected: 1, inserted: 1 });
  await load('src/lib/server/appFeatures.ts').saveAppFeatureModes(db, { temps: 'off' }, null, 'a');
  assert.equal((await post({ gateway_status: true })).status, 403);
  await load('src/lib/server/appFeatures.ts').saveAppFeatureModes(db, { temps: 'all' }, null, 'a');
  await load('src/lib/server/iotIngest.ts').revokeIoTDevice(db, 'b', gateways.a.id);
  assert.equal((await post({ gateway_status: true })).status, 200, 'Another tenant cannot revoke this gateway');
  await load('src/lib/server/iotIngest.ts').revokeIoTDevice(db, 'a', gateways.a.id);
  assert.equal((await post({ gateway_status: true })).status, 401);
  sqlite.exec("UPDATE iot_devices SET is_active=1, revoked_at=NULL; UPDATE businesses SET status='suspended' WHERE id='a'");
  assert.equal((await post({ gateway_status: true })).status, 401);
});

await check('malformed/oversized/future readings are rejected and absent optional metadata remains null', async ({ sqlite, post, reading, now }) => {
  for (const extra of [{ temperature: [] }, { temperature: '' }, { temperature: {} }, { temperature: 186 }, { temperature: -41 },
    { packet_sequence: true }, { packet_sequence: 0 }, { packet_sequence: 2 ** 32 }, { wake_nonce: 123 }, { wake_nonce: 'x'.repeat(65) },
    { ts: now + 3600 }, { ts: 1 }, { node_serial: 'fixture node a' }]) assert.equal((await post(reading(extra))).status, 400, JSON.stringify(extra));
  assert.equal((await post('{invalid')).status, 400);
  assert.equal((await post({ readings: Array.from({ length: 201 }, () => reading()) })).status, 413);
  assert.equal((await post('x'.repeat(65537))).status, 413);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM temps').get().n, 0);
  assert.equal((await post(reading({ humidity_pct: null, battery_mv: null, rssi: null, lqi: null }))).status, 201);
  assert.equal(sqlite.prepare('SELECT humidity_pct, lqi FROM temps').get().humidity_pct, null);
  const node = sqlite.prepare("SELECT battery_mv,rssi,lqi FROM temperature_sensor_nodes WHERE node_serial='fixture-node-a'").get();
  assert.deepEqual({ ...node }, { battery_mv: null, rssi: null, lqi: null });
});

await check('factory revocation cannot be undone by re-entering the serial; registration races keep one owner', async ({ db, sqlite, insert, provisioning, gateways, now }) => {
  sqlite.exec("UPDATE iot_device_inventory SET claim_status='revoked' WHERE serial='fixture-gateway-a'");
  await assert.rejects(provisioning.claimTemperatureGateway(db, { businessId: 'a', serial: 'fixture-gateway-a', displayName: 'Retry' }), /not available/);
  insert('iot_device_inventory', { serial: 'contested-gateway', device_type: 'sensor_gateway', key_hash: 'b'.repeat(64), key_prefix: 'fixture', created_at: now, updated_at: now });
  const results = await Promise.allSettled(['a', 'b'].map(businessId => provisioning.claimTemperatureGateway(db, { businessId, serial: 'contested-gateway', displayName: 'Contested' })));
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  const device = sqlite.prepare("SELECT id,business_id FROM iot_devices WHERE external_device_id='contested-gateway'").get();
  const inventory = sqlite.prepare("SELECT claimed_business_id,claimed_iot_device_id FROM iot_device_inventory WHERE serial='contested-gateway'").get();
  assert.equal(inventory.claimed_business_id, device.business_id); assert.equal(inventory.claimed_iot_device_id, device.id);
  const claims = await Promise.allSettled(['a', 'b'].map(businessId => provisioning.claimTemperatureSensorNode(db, { businessId, gatewayDeviceId: gateways[businessId].id, nodeSerial: 'contested-node', displayName: 'Contested' })));
  assert.equal(claims.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM temperature_sensor_nodes WHERE node_serial='contested-node'").get().n, 1);
});

await check('sensor hash collisions are tenant-local and concurrent edits return the stored node ID', async ({ db, sqlite, provisioning, gateways }) => {
  for (const [businessId, nodeSerial] of [['a', 'fixture-collision-24708'], ['b', 'fixture-collision-388462']]) {
    await provisioning.claimTemperatureSensorNode(db, { businessId, gatewayDeviceId: gateways[businessId].id, nodeSerial, displayName: 'Collision fixture' });
  }
  const collisions = sqlite.prepare("SELECT sensor_id FROM temperature_sensor_nodes WHERE node_serial LIKE 'fixture-collision-%'").all();
  assert.equal(collisions.length, 2); assert.equal(collisions[0].sensor_id, collisions[1].sensor_id);
  await assert.rejects(provisioning.claimTemperatureSensorNode(db, { businessId: 'a', gatewayDeviceId: gateways.a.id, nodeSerial: 'fixture-collision-388462', displayName: 'Wrong' }));
  const input = { businessId: 'a', gatewayDeviceId: gateways.a.id, nodeSerial: 'concurrent-node', displayName: 'Concurrent' };
  const saved = await Promise.all([provisioning.claimTemperatureSensorNode(db, input), provisioning.claimTemperatureSensorNode(db, input)]);
  const stored = sqlite.prepare("SELECT id FROM temperature_sensor_nodes WHERE node_serial='concurrent-node'").get();
  assert.ok(saved.every(row => row.id === stored.id));
});

await check('25-node batches use one registry lookup, short-lived digest guards and exact persisted counts', async ({ db, test, sqlite, provisioning, gateways, post, reading }) => {
  const readings = [reading()];
  for (let index = 1; index < 25; index++) {
    const serial = 'batch-node-' + index;
    await provisioning.claimTemperatureSensorNode(db, { businessId: 'a', gatewayDeviceId: gateways.a.id, nodeSerial: serial, displayName: serial });
    readings.push(reading({ node_serial: serial }));
  }
  let registryReads = 0;
  const measured = { ...db, prepare(sql) { if (sql.includes('SELECT node_serial, sensor_id, packet_sequence')) registryReads++; return db.prepare(sql); } };
  const queries = test.queryCount;
  assert.deepEqual(await (await post({ readings }, { database: measured })).json(), { accepted: 25, rejected: 0, inserted: 25 });
  assert.equal(registryReads, 1); assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM temps').get().n, 25);
  const total = test.queryCount - queries;
  assert.ok(total <= 90, 'Representative 25-node query budget: ' + total);
  const guard = sqlite.prepare('SELECT * FROM iot_ingest_guard').get();
  assert.ok(guard.guard_key.length < 120 && !guard.guard_key.includes('fixture-node'));
  assert.equal(guard.expires_at - guard.last_seen_at, 120);
  console.log(JSON.stringify({ isolated25NodeBatch: { registryReads, sqlStatements: total } }));
});

await check('old buffered highs cannot raise current alerts, and post-commit maintenance failure does not report a lost save', async ({ sqlite, reading, post, now }) => {
  assert.equal((await post(reading({ ts: now - 3600, temperature: 60 }))).status, 201);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM temperature_alert_events').get().n, 0);
  sqlite.exec("CREATE TRIGGER fail_alert BEFORE INSERT ON temperature_alert_events BEGIN SELECT RAISE(ABORT,'fixture alert failure'); END");
  assert.equal((await post(reading({ packet_sequence: 2, temperature: 60 }))).status, 201);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM temps').get().n, 2);
  assert.equal(sqlite.prepare("SELECT packet_sequence FROM temperature_sensor_nodes WHERE node_serial='fixture-node-a'").get().packet_sequence, 2);
});

if (failures) { console.error(`${failures} temperature integration checks failed.`); process.exitCode = 1; }
