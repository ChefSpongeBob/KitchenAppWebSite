import assert from 'node:assert/strict';
import { createTestD1, loadServerModules } from './helpers/test-d1.mjs';

const test = createTestD1();
const { sqlite } = test;
const now = Math.floor(Date.now() / 1000);
const day = new Date(now * 1000).toISOString().slice(0, 10);
const trace = [];
const db = { prepare(sql) {
  const original = test.db.prepare(sql); let bindings = [];
  const statement = { bind(...values) { bindings = values; original.bind(...values); return statement; } };
  for (const method of ['all', 'first', 'run']) statement[method] = async (...args) => {
    const result = await original[method](...args);
    trace.push({ sql, bindings, method, rows: method === 'all' ? result.results.length : method === 'first' ? Number(result !== null) : 0 });
    return result;
  };
  return statement;
}, async batch(statements) { return test.db.batch(statements); } };
const load = loadServerModules();
function insert(table, row) {
  const keys = Object.keys(row);
  sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
}
async function seed(business) {
  insert('businesses', { id: business, name: business, slug: business, created_at: now, updated_at: now });
  insert('schedule_departments', { id: `dept-${business}`, business_id: business, name: 'Kitchen', created_at: now, updated_at: now });
  insert('list_sections', { id: `list-${business}`, business_id: business, domain: 'preplists', slug: 'daily', title: 'Daily', created_at: now, updated_at: now });
  for (let index = 0; index < 40; index++) {
    const id = `${business}-user-${index}`;
    insert('users', { id, email: `${id}@example.invalid`, email_normalized: `${id}@example.invalid`, display_name: id, created_at: now, updated_at: now });
    insert('business_users', { business_id: business, user_id: id, role: index ? 'staff' : 'owner', permission_template: index ? 'staff' : 'owner', created_at: now, updated_at: now });
    insert('user_schedule_departments', { business_id: business, user_id: id, department: 'Kitchen', updated_at: now });
  }
  for (let index = 0; index < 60; index++) {
    insert('list_items', { id: `${business}-item-${index}`, business_id: business, section_id: `list-${business}`, content: `Item ${index}`, created_at: now, updated_at: now });
    insert('recipes', { business_id: business, title: `Recipe ${index}`, category: 'Kitchen', ingredients: 'Ingredient\n'.repeat(20), instructions: 'Instruction\n'.repeat(20) });
    insert('documents', { id: `${business}-doc-${index}`, business_id: business, slug: `doc-${index}`, title: `Document ${index}`, section: 'Docs', category: 'Kitchen', content: 'Instructions\n'.repeat(20), created_at: now, updated_at: now });
  }
  insert('creator_category_registry', { id: `category-${business}`, business_id: business, editor_type: 'document', category: 'Kitchen', created_at: now });
  for (let batch = 0; batch < 5; batch++) {
    insert('list_submission_batches', { id: `${business}-batch-${batch}`, business_id: business, domain: 'preplists', section_id: `list-${business}`,
      section_title_snapshot: 'Daily', submitted_by: `${business}-user-0`, submitted_at: now - batch, business_day: day });
    for (let index = 0; index < 60; index++) insert('list_submission_items', { id: `${business}-snapshot-${batch}-${index}`, batch_id: `${business}-batch-${batch}`, business_id: business,
      item_id: `${business}-item-${index}`, item_name_snapshot: `Item ${index}`, submitted_value: '2 pans' });
  }
  insert('iot_devices', { id: `gateway-${business}`, business_id: business, device_type: 'sensor_gateway', external_device_id: `gateway-${business}`, display_name: `Gateway ${business}`,
    key_hash: 'isolated-fixture-not-a-real-credential', key_prefix: 'fixture', created_at: now, updated_at: now });
  for (let sensor = 1; sensor <= 25; sensor++) {
    insert('temperature_sensor_nodes', { id: `${business}-sensor-${sensor}`, business_id: business, gateway_device_id: `gateway-${business}`, node_serial: `${business}-node-${sensor}`, sensor_id: sensor,
      display_name: `${business} Sensor ${sensor}`, last_seen_at: now, created_at: now, updated_at: now });
    for (let reading = 0; reading < 24; reading++) insert('temps', { business_id: business, sensor_id: sensor, ts: now - reading * 300, temperature: 37, humidity_pct: 45 });
  }
  await load('src/lib/server/business.ts').ensureDefaultBusinessPositions(test.db, business);
}
const results = {};
async function measure(label, work, maxQueries, maxBytes) {
  trace.length = 0;
  const value = await work();
  const bytes = Buffer.byteLength(JSON.stringify(value));
  assert.ok(trace.length <= maxQueries, `${label}: ${trace.length} queries exceeds ${maxQueries}`);
  assert.ok(bytes <= maxBytes, `${label}: ${bytes} bytes exceeds ${maxBytes}`);
  assert.equal(JSON.stringify(value).includes('other-'), false, `${label}: unrelated businesses must not reach the payload`);
  results[label] = { queries: trace.length, rows: trace.reduce((sum, row) => sum + row.rows, 0), bytes };
  return { value, queries: trace.slice() };
}
try {
  await seed('target');
  const locals = { DB: db, env: { DB: db }, userId: 'target-user-0', userRole: 'admin', businessId: 'target', businessRole: 'owner', businessPermissionTemplate: 'owner' };
  const creator = load('src/routes/admin/creator/+page.server.ts');
  const creatorBefore = await measure('creator', () => creator.load({ locals, url: new URL('https://criminiops.com/admin/creator') }), 20, 200000);
  for (let index = 0; index < 19; index++) await seed(`other-${index}`);
  sqlite.exec('ANALYZE');
  const creatorAfter = await measure('creator', () => creator.load({ locals, url: new URL('https://criminiops.com/admin/creator') }), 20, 200000);
  assert.equal(creatorBefore.queries.length, creatorAfter.queries.length);
  assert.deepEqual(creatorAfter.value, creatorBefore.value, 'Adding 19 unrelated tenants cannot grow this workspace response');
  await measure('people', () => load('src/routes/admin/users/+page.server.ts').load({ locals, url: new URL('https://criminiops.com/admin/users?view=team') }), 20, 100000);
  await measure('employee-record', () => load('src/routes/admin/users/[id]/+page.server.ts').load({ locals, params: { id: 'target-user-1' }, url: new URL('https://criminiops.com/admin/users/target-user-1') }), 30, 30000);
  await measure('settings', () => load('src/routes/settings/+page.server.ts').load({ locals, url: new URL('https://criminiops.com/settings'), cookies: { get() {} } }), 15, 10000);
  const docs = await measure('docs', () => load('src/routes/docs/+page.server.ts').load({ locals }), 5, 20000);
  assert.equal(docs.value.docs.length, 60);
  assert.ok(docs.value.docs.every(row => !('content' in row)), 'Document library excludes bodies needed only for an opened document');
  const temps = await measure('temperature-summary', () => load('src/lib/server/temperatureMonitoring.ts').loadLatestTemperatureSnapshots(db, 'target'), 1, 20000);
  assert.equal(temps.value.length, 25);
  const latestPlan = sqlite.prepare('EXPLAIN QUERY PLAN ' + temps.queries[0].sql).all(...temps.queries[0].bindings).map(row => row.detail);
  assert.ok(latestPlan.some(detail => /SEARCH t USING .*INDEX idx_temps_business_sensor_ts/.test(detail)), JSON.stringify(latestPlan));
  const averages = await measure('temperature-report', () => load('src/lib/server/reports.ts').loadTemperatureHourlyAverageReport(db, 'target', { start: day, end: day }), 1, 150000);
  const reportPlan = sqlite.prepare('EXPLAIN QUERY PLAN ' + averages.queries[0].sql).all(...averages.queries[0].bindings).map(row => row.detail);
  assert.ok(reportPlan.some(detail => /SEARCH t USING INDEX idx_temps_business_ts \(business_id=\? AND ts>\? AND ts<\?\)/.test(detail)), JSON.stringify(reportPlan));
  const legacySql = averages.queries[0].sql.replace("t.ts >= unixepoch(?) AND t.ts < unixepoch(?, '+1 day')", "date(t.ts, 'unixepoch') BETWEEN ? AND ?");
  assert.deepEqual(averages.value.rows, sqlite.prepare(legacySql).all(...averages.queries[0].bindings), 'Indexed filtering preserves the old report results');
  const history = await measure('list-history', () => load('src/routes/reports/lists/+page.server.ts').load({ locals, url: new URL(`https://criminiops.com/reports/lists?start=${day}&end=${day}`) }), 1, 200000);
  assert.equal(history.value.rows.length, 300);
  const summary = await measure('temperature-api', async () => {
    const response = await load('src/routes/api/temps/+server.ts').GET({ locals, url: new URL('https://criminiops.com/api/temps?view=summary&limit=50') });
    return response.json();
  }, 2, 20000);
  assert.equal(summary.value.latest.length, 25); assert.equal(summary.value.history.length, 50);
  const staff = await measure('staff-diagnostics', () => load('src/lib/server/platformStaffDashboard.ts').loadRequestDiagnostics(db, 'owner', new URL('https://criminiops.com/staff'), 'target', now), 2, 2000);
  assert.equal(staff.value.issues.length, 0);
  insert('temperature_sensor_nodes', { id: 'mismatched-gateway-child', business_id: 'target', gateway_device_id: 'gateway-other-0', node_serial: 'mismatched-gateway-child', sensor_id: 99,
    display_name: 'Quarantined fixture', created_at: now, updated_at: now });
  const nodes = await load('src/lib/server/temperatureDeviceProvisioning.ts').loadTemperatureSensorNodes(db, 'target');
  const mismatched = nodes.find(node => node.id === 'mismatched-gateway-child');
  assert.equal(mismatched.gatewaySerial, null);
  assert.equal(mismatched.gatewayName, null, 'A malformed node relationship cannot disclose another tenant gateway');
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  console.log('PASS actual route/query/payload budgets for a 40-employee, 60-content-item, 25-sensor tenant among 20 isolated businesses');
  console.log(JSON.stringify({ isolatedFixtureMeasurements: results }));
} finally { test.close(); }
