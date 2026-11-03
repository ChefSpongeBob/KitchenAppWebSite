import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

function load(path, deps, extraSource = '') {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, 'utf8') + extraSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  new Function('require', 'exports', source)(name => {
    if (!(name in deps)) throw Error(`Unexpected dependency ${name}`);
    return deps[name];
  }, exports);
  return exports;
}
const sqlite = new DatabaseSync(':memory:');
const now = Math.floor(Date.now() / 1000);
sqlite.exec(`PRAGMA foreign_keys=ON;
  CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT, is_active INTEGER, role TEXT);
  CREATE TABLE businesses(id TEXT PRIMARY KEY, name TEXT, status TEXT);
  CREATE TABLE business_users(business_id TEXT, user_id TEXT, is_active INTEGER);
  CREATE TABLE iot_devices(id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id),
    device_type TEXT, external_device_id TEXT UNIQUE, display_name TEXT, key_hash TEXT, key_prefix TEXT,
    is_active INTEGER, last_seen_at INTEGER, revoked_at INTEGER, created_by TEXT, created_at INTEGER, updated_at INTEGER);
  INSERT INTO users VALUES ('owner', 'owner@example.invalid', 1, 'user'), ('manager', 'manager@example.invalid', 1, 'admin'),
    ('support', 'support@example.invalid', 1, 'user'), ('equipment', 'equipment@example.invalid', 1, 'user');
  INSERT INTO businesses VALUES ('a', 'Restaurant A', 'active'), ('b', 'Restaurant B', 'active');
  INSERT INTO business_users VALUES ('a','owner',1),('a','manager',1),('b','manager',1);
`);
sqlite.exec(readFileSync('migrations/0086_temperature_gateway_nodes.sql', 'utf8'));
const migration = readFileSync('migrations/0107_platform_staff_console.sql', 'utf8');
sqlite.exec(migration);
sqlite.exec(migration);
sqlite.exec(`CREATE TABLE devices(id TEXT PRIMARY KEY, revoked_at INTEGER);
  CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,device_id TEXT,expires_at INTEGER,
    revoked_at INTEGER,session_token_hash TEXT,last_seen_at INTEGER);
  ALTER TABLE users ADD COLUMN password_hash TEXT;
  ALTER TABLE users ADD COLUMN display_name TEXT;`);
sqlite.exec(readFileSync('migrations/0109_platform_staff_controls.sql', 'utf8'));
sqlite.exec(`INSERT INTO platform_staff_members (user_id,staff_role,is_active,granted_by,created_at,updated_at)
  VALUES ('owner','owner',1,NULL,1,1), ('support','support',1,'owner',1,1), ('equipment','equipment',1,'owner',1,1);
  INSERT INTO sessions VALUES('owner-session','owner',NULL,${now + 3600},NULL,'hashed-owner-token',${now}),
    ('manager-session','manager',NULL,${now + 3600},NULL,'hashed-manager-token',${now});
  INSERT INTO platform_staff_step_up VALUES ('owner-session','owner',1,${now},${now});
  INSERT INTO iot_device_inventory(serial,device_type,key_hash,key_prefix,claim_status,created_at,updated_at)
    VALUES ('gateway-a','sensor_gateway','${'a'.repeat(64)}','prefix','available',1,1),
           ('gateway-b','sensor_gateway','${'b'.repeat(64)}','prefix','available',1,1);`);
sqlite.exec(`INSERT INTO platform_staff_passkeys VALUES('old-credential','owner','criminiops.com','old-public-key',0,'Old key',1,NULL);
  INSERT INTO platform_staff_challenges VALUES('owner-session','owner',1,'register','old-challenge','criminiops.com',1);`);
const auditBeforeRemoval = sqlite.prepare('SELECT COUNT(*) n FROM platform_staff_audit').get().n;
sqlite.exec(readFileSync('migrations/0110_remove_staff_passkeys.sql','utf8'));
for (const table of ['platform_staff_passkeys','platform_staff_challenges']) {
  assert.equal(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table), undefined);
}
assert.deepEqual(sqlite.prepare('PRAGMA table_info(platform_staff_step_up)').all().map(row => row.name),
  ['session_id','user_id','membership_revision','verified_at']);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM platform_staff_step_up').get().n, 0);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM platform_staff_audit').get().n, auditBeforeRemoval);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM platform_staff_members').get().n, 3);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n, 2);
sqlite.exec(readFileSync('migrations/0112_staff_email_verification.sql', 'utf8'));
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM platform_staff_step_up').get().n, 0);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM platform_staff_audit').get().n, auditBeforeRemoval);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n, 2);
sqlite.prepare('INSERT INTO platform_staff_step_up VALUES (?,?,1,?,?)').run('owner-session','owner',now,now);
assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
console.log('PASS cleanup removes old credentials/challenges, requires fresh confirmation, and preserves identities, sessions, memberships, and audit');

function statement(sql) {
  let values = [];
  return {
    bind(...bindings) { values = bindings; return this; },
    async first() { return sqlite.prepare(sql).get(...values) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...values), success: true }; },
    async run() { return { success: true, meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; }
  };
}
const db = { prepare: statement, async batch(statements) {
  sqlite.exec('BEGIN');
  try { const results = []; for (const stmt of statements) results.push(await stmt.run()); sqlite.exec('COMMIT'); return results; }
  catch (err) { sqlite.exec('ROLLBACK'); throw err; }
} };
const kit = { error: (status, message) => { throw Object.assign(Error(message), { status, body: { message } }); } };
const actionKit = { ...kit, fail: (status, data) => ({ status, data }), isHttpError: err => Boolean(err.status) };
let maintenanceAllowed = true;
const maintenanceSecurity = { checkRateLimit: async () => ({ allowed: maintenanceAllowed }),
  rateLimitFailure: message => actionKit.fail(429, { error: message }) };
const staff = load('src/lib/server/platformStaff.ts', { '@sveltejs/kit': kit });
const ownerLocals = { DB: db, userId: 'owner', sessionId: 'owner-session' };
const owner = await staff.requirePlatformStaff(ownerLocals);
assert.equal(owner.role, 'owner');
await assert.rejects(staff.requirePlatformStaff({ DB: db }), { status: 401 });
await assert.rejects(staff.requirePlatformStaff({ DB: db, userId: 'manager', userRole: 'admin', businessRole: 'owner' }), { status: 403 });
await assert.rejects(staff.requirePlatformStaff({ DB: db, userId: 'support' }, ['owner']), { status: 403 });
sqlite.exec("UPDATE platform_staff_members SET is_active=0 WHERE user_id='equipment'");
await assert.rejects(staff.requirePlatformStaff({ DB: db, userId: 'equipment' }), { status: 403 });
sqlite.exec("UPDATE platform_staff_members SET is_active=1 WHERE user_id='equipment'; UPDATE users SET is_active=0 WHERE id='equipment'");
await assert.rejects(staff.requirePlatformStaff({ DB: db, userId: 'equipment' }), { status: 403 });
sqlite.exec("UPDATE users SET is_active=1 WHERE id='equipment'");
assert.equal(staff.isPlatformStaffPath('/staff/equipment'), true);
assert.equal(staff.isPlatformStaffPath('/staffing'), false);
assert.equal(staff.staffPageNumber('-2'), 1);
assert.equal(staff.staffPageNumber('999999'), 1000);
assert.equal(staff.staffSearch('a'.repeat(90)).length, 80);
assert.equal(staff.searchPattern('a%_'), 'a\\%\\_%');
console.log('PASS explicit staff membership, role restrictions, revocation, inactive accounts, bounded search');

await staff.reserveGateway(db, owner, 'gateway-a', 'a', 'Order A', 'owner-session');
assert.equal(sqlite.prepare("SELECT business_id FROM iot_device_reservations WHERE serial='gateway-a'").get().business_id, 'a');
await assert.rejects(staff.reserveGateway(db, owner, 'gateway-a', 'b', 'Order B', 'owner-session'));
await assert.rejects(staff.reserveGateway(db, { userId: 'support', role: 'support' }, 'gateway-b', 'b', 'Order B', 'support-session'), { status: 403 });
assert.throws(() => sqlite.prepare(`INSERT INTO iot_devices(id,business_id,device_type,external_device_id,is_active)
  VALUES('wrong','b','sensor_gateway','gateway-a',1)`).run(), /reserved for another business/);
const provisioning = load('src/lib/server/temperatureDeviceProvisioning.ts', {
  '$app/env': { dev: false }, '#lib/server/iotIngest.ts': {},
  '#lib/server/temperatureSensors.ts': { normalizeDeviceSerial: value => value.trim().toLowerCase() }
});
await assert.rejects(provisioning.claimTemperatureGateway(db, { businessId: 'b', serial: 'gateway-a', displayName: 'Wrong' }), /reserved for another business/);
const gateway = await provisioning.claimTemperatureGateway(db, { businessId: 'a', serial: 'gateway-a', displayName: 'Walk-in Gateway', createdBy: 'owner' });
assert.equal(sqlite.prepare('SELECT business_id FROM iot_devices WHERE id=?').get(gateway.id).business_id, 'a');
await assert.rejects(staff.releaseGatewayReservation(db, owner, 'gateway-a', 'Already used', 'owner-session'), { status: 409 });
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM iot_device_reservations WHERE serial='gateway-a'").get().n, 1);
console.log('PASS reserved gateway only registers to its intended tenant; claimed reservations cannot be released');

sqlite.exec(`CREATE TRIGGER test_audit_failure BEFORE INSERT ON platform_staff_audit BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;`);
await assert.rejects(staff.reserveGateway(db, owner, 'gateway-b', 'b', 'Order B', 'owner-session'), /test audit failure/);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM iot_device_reservations WHERE serial='gateway-b'").get().n, 0);
sqlite.exec('DROP TRIGGER test_audit_failure');
await staff.reserveGateway(db, owner, 'gateway-b', 'b', 'Order B', 'owner-session');
await staff.releaseGatewayReservation(db, owner, 'gateway-b', 'Order cancelled', 'owner-session');
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM iot_device_reservations WHERE serial='gateway-b'").get().n, 0);
assert.throws(() => sqlite.exec("UPDATE platform_staff_members SET is_active=0 WHERE user_id='owner'"), /active platform owner/);
sqlite.exec("DELETE FROM platform_staff_step_up WHERE user_id='owner'");
await assert.rejects(staff.reserveGateway(db, owner, 'gateway-b', 'b', 'Expired actor', 'owner-session'), { status: 409 });
sqlite.prepare('INSERT INTO platform_staff_step_up VALUES (?,?,1,?,?)').run('owner-session','owner',now,now);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM platform_staff_audit WHERE action='gateway_reserved'").get().n, 2);
console.log('PASS assignments are audited atomically, roll back on audit failure, and reject stale authority');

const directory = load('src/routes/staff/businesses/+page.server.ts', { '#lib/server/platformStaff.ts': staff });
sqlite.exec(`ALTER TABLE businesses ADD COLUMN slug TEXT; ALTER TABLE businesses ADD COLUMN plan_tier TEXT;
  ALTER TABLE businesses ADD COLUMN contact_email TEXT; ALTER TABLE businesses ADD COLUMN contact_phone TEXT;
  ALTER TABLE businesses ADD COLUMN created_at INTEGER;`);
const found = await directory.load({ locals: ownerLocals, url: new URL('https://criminiops.com/staff/businesses?q=Restaurant') });
assert.equal(found.businesses.length, 2);
assert.equal((await directory.load({ locals: ownerLocals, url: new URL('https://criminiops.com/staff/businesses?q=%27%20OR%201%3D1--') })).businesses.length, 0);
const inventory = load('src/routes/staff/equipment/+page.server.ts', {
  '@sveltejs/kit': actionKit,
  '#lib/server/platformStaff.ts': staff, '#lib/server/security.ts': maintenanceSecurity
});
const list = await inventory.load({ locals: ownerLocals, url: new URL('https://criminiops.com/staff/equipment') });
assert.equal(list.equipment.length, 2);
assert.equal(JSON.stringify(list).includes('key_hash'), false);
assert.equal(JSON.stringify(list).includes('a'.repeat(64)), false);
const rejected = inventory.actions.reserve({ locals: { DB: db, userId: 'manager', businessRole: 'owner' } });
await assert.rejects(rejected, { status: 403 });
console.log('PASS actual directory/inventory SQL is bounded, parameterized, and excludes device credentials');
assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);

sqlite.exec(readFileSync('migrations/0076_operational_events.sql', 'utf8'));
sqlite.exec(readFileSync('migrations/0108_staff_health_indexes.sql', 'utf8'));
sqlite.exec(readFileSync('migrations/0108_staff_health_indexes.sql', 'utf8'));
const health = load('src/lib/server/platformHealth.ts', {
  '@sveltejs/kit': kit, '#lib/server/platformStaff.ts': staff,
  '#lib/server/temperatureMonitoring.ts': { TEMPERATURE_ONLINE_WINDOW_SECONDS: 600 }
});
const healthNow = 2_000_000;
assert.equal(health.gatewayConnection(healthNow - 599, healthNow), 'Online');
assert.equal(health.gatewayConnection(healthNow - 600, healthNow), 'Offline');
assert.equal(health.gatewayConnection(null, healthNow), 'Never connected');
assert.equal(health.gatewayConnection(healthNow + 61, healthNow), 'Timestamp issue');
const job = { delivery_status: 'pending', delivery_attempts: 0, created_at: healthNow - 1000,
  updated_at: healthNow - 1000, last_attempt_at: null, next_attempt_at: null, expires_at: null };
assert.equal(health.queueCondition(job, healthNow), 'Waiting');
assert.equal(health.queueCondition({ ...job, created_at: healthNow - 20 }, healthNow), 'Ready');
assert.equal(health.queueCondition({ ...job, next_attempt_at: healthNow + 60, delivery_attempts: 2 }, healthNow), 'Retry scheduled');
assert.equal(health.queueCondition({ ...job, next_attempt_at: healthNow + 60 }, healthNow), 'Scheduled');
assert.equal(health.queueCondition({ ...job, expires_at: healthNow }, healthNow), 'Expired');
assert.equal(health.queueCondition({ ...job, delivery_status: 'processing' }, healthNow), 'Processing delayed');
assert.equal(health.queueCondition({ ...job, delivery_status: 'failed' }, healthNow), 'Delivery failed');
assert.equal(health.staffQueueStatus("failed' OR 1=1--"), 'failed');
const insertJob = sqlite.prepare(`INSERT INTO operational_events
  (id,business_id,event_type,category,delivery_status,delivery_attempts,created_at,updated_at,payload_json,body)
  VALUES(?,?,'private.employee.event','onboarding',?,2,?,?,?,?)`);
const privateText = 'PRIVATE HR BODY SECRET bank details person@example.invalid';
for (let i = 0; i < 25; i++) {
  insertJob.run(`job-a-${String(i).padStart(2,'0')}`, 'a', 'failed', healthNow - i, healthNow - i, privateText, privateText);
}
insertJob.run('job-b', 'b', 'failed', healthNow + 20, healthNow + 20, privateText, privateText);
const insertAttempt = sqlite.prepare(`INSERT INTO operational_event_delivery_attempts
  (id,event_id,business_id,channel,status,provider_message_id,error_message,attempted_at)
  VALUES(?,?,?,'email','failed','PRIVATE PROVIDER TOKEN',?,?)`);
for (let i = 0; i < 25; i++) insertAttempt.run(`attempt-a-${String(i).padStart(2,'0')}`, 'job-a-00', 'a', privateText, healthNow - i);
insertAttempt.run('attempt-b', 'job-b', 'b', privateText, healthNow + 20);
insertAttempt.run('attempt-mismatched-business', 'job-b', 'a', privateText, healthNow + 30);
sqlite.prepare(`INSERT INTO iot_devices(id,business_id,device_type,external_device_id,display_name,is_active,last_seen_at)
  VALUES('gateway-b-live','b','sensor_gateway','gateway-b-live','Private B Gateway',1,?)`).run(healthNow);
let healthBusiness = await health.loadStaffHealth(db, 'owner', new URL('https://criminiops.com/staff/health?business=a'), healthNow);
assert.equal(healthBusiness.delivery.jobs.length, 20);
assert.equal(healthBusiness.delivery.attempts.length, 20);
assert.equal(healthBusiness.delivery.moreJobs, true);
assert.equal(healthBusiness.delivery.moreAttempts, true);
assert.ok(healthBusiness.gateways.every(row => row.external_device_id !== 'gateway-b-live'));
assert.ok(healthBusiness.delivery.jobs.every(row => row.id.startsWith('job-a-')));
assert.ok(healthBusiness.delivery.attempts.every(row => row.id.startsWith('attempt-a-')));
for (const forbidden of [privateText, 'PRIVATE PROVIDER TOKEN', 'payload_json', 'error_message', 'private.employee.event']) {
  assert.equal(JSON.stringify(healthBusiness).includes(forbidden), false);
}
assert.equal(healthBusiness.delivery.attempts[0].issue, 'Email delivery failed');
healthBusiness = await health.loadStaffHealth(db, 'support', new URL('https://criminiops.com/staff/health?business=a&jobs=2&attempts=2'), healthNow);
assert.equal(healthBusiness.delivery.jobs.length, 5);
assert.equal(healthBusiness.delivery.moreJobs, false);
assert.equal(healthBusiness.delivery.attempts.length, 5);
const equipmentReadDb = { prepare(sql) {
  assert.doesNotMatch(sql, /operational_event/);
  return db.prepare(sql);
} };
assert.equal((await health.loadStaffHealth(equipmentReadDb, 'equipment', new URL('https://criminiops.com/staff/health?business=a'), healthNow)).delivery, null);
assert.equal((await health.loadStaffHealth({ prepare() { throw Error('No business selected must not query health data'); } }, 'owner', new URL('https://criminiops.com/staff/health'))).business, null);
await assert.rejects(health.loadStaffHealth(db, 'owner', new URL("https://criminiops.com/staff/health?business='OR%201=1--")), { status: 404 });
for (const [table, index, ordering, filter] of [
  ['operational_events', 'idx_operational_events_staff_queue', 'created_at DESC, id DESC', "AND delivery_status='failed'"],
  ['operational_event_delivery_attempts', 'idx_operational_attempts_staff_recent', 'attempted_at DESC, id DESC', '']
]) {
  const plan = sqlite.prepare(`EXPLAIN QUERY PLAN SELECT id FROM ${table} WHERE business_id='a' ${filter} ORDER BY ${ordering} LIMIT 21`).all();
  assert.ok(plan.some(row => row.detail.includes(index)));
  assert.ok(plan.every(row => !row.detail.includes('TEMP B-TREE')));
}
const healthPage = load('src/routes/staff/health/+page.server.ts', {
  '#lib/server/platformStaff.ts': staff, '#lib/server/platformHealth.ts': health,
  '#lib/server/email.ts': { isEmailConfigured: env => Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) }
});
await assert.rejects(healthPage.load({ locals: { DB: db, userId: 'manager', businessRole: 'owner' }, setHeaders() {} }), { status: 403 });
const healthResponse = await healthPage.load({ locals: { ...ownerLocals,
  env: { RESEND_API_KEY: 'PRIVATE RESEND KEY', RESEND_FROM_EMAIL: 'private@example.invalid' } },
  url: new URL('https://criminiops.com/staff/health?business=a'),
  setHeaders(headers) { assert.equal(headers['cache-control'], 'no-store'); }
});
assert.equal(healthResponse.emailConfigured, true);
assert.equal(JSON.stringify(healthResponse).includes('PRIVATE RESEND KEY'), false);
console.log('PASS health uses indexed bounded tenant reads, safe status metadata, no secrets, and role-scoped delivery visibility');

const redirect = (status, location) => { throw Object.assign(Error('Redirect'), { status, location }); };
let tenantCalls = 0;
const hooks = load('src/hooks.server.ts', {
  'cloudflare:workers': { env: { DB: db }, waitUntil: () => {} },
  '$app/env': { building: false, dev: false },
  '@sveltejs/kit': { redirect, isRedirect: err => Boolean(err.location) },
  '#lib/server/auth.ts': { hashSessionToken: async token => `hashed-${token}` },
  '#lib/features/appFeatures.ts': { resolveFeatureKeyForUrl: () => null },
  '#lib/server/appFeatures.ts': { loadAppFeatureModes: async () => ({}) },
  '#lib/server/tenant.ts': { ensureTenantSchema: async () => {} },
  '#lib/server/business.ts': {
    getUserBusinessContext: async () => { tenantCalls++; return { businessId: 'a', businessRole: 'user' }; },
    isBusinessOnboardingComplete: async () => true
  },
  '#lib/server/activeBusiness.ts': { ACTIVE_BUSINESS_COOKIE: 'active-business', getActiveBusinessCookieOptions: () => ({ path: '/' }), getActiveBusinessCookieDeleteOptions: () => ({ path: '/' }) },
  '#lib/server/trial.ts': { getBusinessTrialAccess: async () => ({ allowApp: false, shouldPurge: false }), getRequestIpAddress: () => '127.0.0.1' },
  '#lib/server/authCookies.ts': {
    getSessionCookieName: () => 'session', getSessionCookieOptions: () => ({ path: '/' }),
    getSessionCookieDeleteOptions: () => ({ path: '/' }), isNativeAppRequest: () => false
  },
  '#lib/server/permissions.ts': { effectiveAppRoleFromBusinessRole: () => 'user', hasBusinessCapability: () => true },
  '#lib/auth/routeCapabilities.ts': { resolveBusinessCapabilityForPath: () => null },
  '#lib/server/schemaGuard.ts': { wrapProductionSchemaGuard: db => db },
  '#lib/server/observability.ts': { logOperationalEvent: () => {}, logOperationalError: () => {} },
  '#lib/server/operationalEvents.ts': {}, '#lib/server/platformStaff.ts': staff
});
function hookEvent(path, token = 'owner-token', options = {}) {
  const url = new URL(`https://criminiops.com${path}`);
  return { url, request: new Request(url, options), locals: {},
    cookies: { get: name => name === 'session' ? token : null, set: () => {}, delete: () => {} }
  };
}
const ownerEvent = hookEvent('/staff/equipment');
const ownerResponse = await hooks.handle({ event: ownerEvent, resolve: async () => new Response('Staff') });
assert.equal(ownerResponse.status, 200);
assert.equal(ownerEvent.locals.platformStaff.role, 'owner');
assert.equal(tenantCalls, 0);
assert.match(ownerResponse.headers.get('cache-control'), /no-store/);
const managerResponse = await hooks.handle({ event: hookEvent('/staff/equipment', 'manager-token'), resolve: async () => { throw Error('Must not reach route'); } });
assert.equal(managerResponse.status, 403);
assert.equal(tenantCalls, 0);
await assert.rejects(hooks.handle({ event: hookEvent('/staff', null), resolve: async () => new Response() }), { location: '/login?staff=1' });
const crossSite = await hooks.handle({ event: hookEvent('/staff/equipment', 'owner-token', {
  method: 'POST', headers: { origin: 'https://attacker.invalid' }
}), resolve: async () => { throw Error('Cross-site mutation must not resolve'); } });
assert.equal(crossSite.status, 403);
await assert.rejects(hooks.handle({ event: hookEvent('/app'), resolve: async () => new Response() }), { location: '/billing?access=required' });
assert.equal(tenantCalls, 1);
console.log('PASS real request hook separates staff access, preserves restaurant billing gates, and rejects CSRF');
const normalLookup = staff.findPlatformStaff;
staff.findPlatformStaff = async () => { throw Error('Simulated database outage'); };
let clearedCookies = 0;
const unavailableEvent = hookEvent('/staff');
unavailableEvent.cookies.delete = () => { clearedCookies++; };
assert.equal((await hooks.handle({ event: unavailableEvent, resolve: async () => new Response() })).status, 503);
assert.equal(clearedCookies, 0);
staff.findPlatformStaff = normalLookup;
console.log('PASS staff lookup failure denies access without destroying an otherwise valid login session');
const loginSource = readFileSync('src/routes/login/+page.svelte', 'utf8');
assert.ok(loginSource.includes("'?/login&staff=1' : '?/login'"), 'Staff destination must survive the actual named login form action');
const login = load('src/routes/login/+page.server.ts', {
  '@sveltejs/kit': { redirect, isRedirect: err => Boolean(err.location), fail: (status, data) => ({ status, data }) },
  '$app/env': { dev: false }, '#lib/server/auth.ts': {}, '#lib/server/authCookies.ts': {},
  '#lib/server/activeBusiness.ts': {}, '#lib/server/dbSchema.ts': {}, '#lib/server/business.ts': {},
  '#lib/server/permissions.ts': {}, '#lib/server/security.ts': {}, '#lib/server/turnstile.ts': {},
  '#lib/server/platformStaff.ts': staff
});
const loginForm = new FormData();
loginForm.set('email', 'owner@example.invalid');
loginForm.set('password', 'not-used-for-existing-session');
const staffLoginUrl = new URL('https://criminiops.com/login?/login&staff=1');
await assert.rejects(login.actions.login({
  locals: { DB: db, userId: 'owner' }, url: staffLoginUrl,
  request: new Request(staffLoginUrl, { method: 'POST', body: loginForm })
}), { location: '/staff' });
console.log('PASS named login action preserves the staff destination for authenticated platform accounts');

// Exercise the actual session proof, administration SQL, password verifier, and cleanup code.
assert.equal(staff.staffReturnPath('https://attacker.invalid/staff'), '/staff');
assert.equal(staff.staffReturnPath('//attacker.invalid/staff'), '/staff');
assert.equal(staff.staffReturnPath('/staff/security'), '/staff');
assert.equal(staff.staffReturnPath('/staff/equipment?business=a'), '/staff/equipment?business=a');
await assert.rejects(staff.requirePlatformStaff({ DB: db, userId: 'owner', sessionId: 'manager-session' }), { status: 403 });
sqlite.prepare('UPDATE platform_staff_step_up SET verified_at=?,email_verified_at=?').run(now - 901,now - 901);
await staff.requirePlatformStaff(ownerLocals);
await assert.rejects(staff.requireStaffStepUp(ownerLocals), { status: 403 });
sqlite.prepare('UPDATE platform_staff_step_up SET verified_at=?,email_verified_at=?').run(now - 8 * 3600,now - 8 * 3600);
await assert.rejects(hooks.handle({ event: hookEvent('/staff/equipment'), resolve: async () => { throw Error('Unverified'); } }),
  { location: '/staff/security?next=%2Fstaff%2Fequipment' });
assert.equal((await hooks.handle({ event: hookEvent('/staff/security'), resolve: async () => new Response('Confirm') })).status, 200);
sqlite.prepare('UPDATE platform_staff_step_up SET verified_at=?,email_verified_at=?').run(now + 100,now + 100);
assert.equal(await staff.loadStaffStepUp(db, 'owner', 'owner-session', now), null);
sqlite.prepare('UPDATE platform_staff_step_up SET verified_at=?,email_verified_at=?').run(now,now);
sqlite.exec("UPDATE sessions SET revoked_at=1 WHERE id='owner-session'");
assert.equal(await staff.loadStaffStepUp(db, 'owner', 'owner-session'), null);
sqlite.exec("UPDATE sessions SET revoked_at=NULL WHERE id='owner-session'");
const normalProofLookup = staff.loadStaffStepUp;
staff.loadStaffStepUp = async () => { throw Error('Verification database outage'); };
const proofOutage = hookEvent('/staff');
proofOutage.cookies.delete = () => { throw Error('Must preserve restaurant session during staff outage'); };
assert.equal((await hooks.handle({ event: proofOutage, resolve: async () => new Response() })).status, 503);
staff.loadStaffStepUp = normalProofLookup;
for (const sql of [
  "UPDATE platform_staff_members SET staff_role='support' WHERE user_id='owner'",
  "DELETE FROM platform_staff_members WHERE user_id='owner'",
  "UPDATE users SET is_active=0 WHERE id='owner'",
  "DELETE FROM users WHERE id='owner'"
]) assert.throws(() => sqlite.exec(sql), /active platform owner/);

const administration = load('src/lib/server/platformStaffAdministration.ts', { '@sveltejs/kit': kit, './platformStaff': staff });
const addStaff = { email: 'manager@example.invalid', role: 'support', active: 1, revision: 0, reason: 'Approved support access' };
await assert.rejects(administration.changeStaffMembership(db, { userId: 'support', role: 'support' }, 'owner-session', addStaff), { status: 403 });
sqlite.exec("CREATE TRIGGER test_audit_failure BEFORE INSERT ON platform_staff_audit BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;");
await assert.rejects(administration.changeStaffMembership(db, owner, 'owner-session', addStaff), /test audit failure/);
assert.equal(await staff.hasPlatformStaffMembership(db, 'manager'), false);
sqlite.exec('DROP TRIGGER test_audit_failure');
await administration.changeStaffMembership(db, owner, 'owner-session', addStaff);
assert.equal(sqlite.prepare("SELECT staff_role FROM platform_staff_members WHERE user_id='manager'").get().staff_role, 'support');
assert.equal(sqlite.prepare("SELECT role FROM users WHERE id='manager'").get().role, 'admin', 'No tenant/global role mutation');
await assert.rejects(administration.changeStaffMembership(db, owner, 'owner-session', addStaff), { status: 409 });
await assert.rejects(administration.changeStaffMembership(db, owner, 'manager-session', { ...addStaff, userId: 'manager', revision: 1 }), { status: 409 });
sqlite.prepare('INSERT INTO platform_staff_step_up VALUES (?,?,1,?,?)').run('manager-session', 'manager', now, now);
await administration.changeStaffMembership(db, owner, 'owner-session', { ...addStaff, userId: 'manager', revision: 1, active: 0 });
assert.equal(await staff.loadStaffStepUp(db, 'manager', 'manager-session'), null);
assert.equal(sqlite.prepare("SELECT revoked_at FROM sessions WHERE id='manager-session'").get().revoked_at, null);
await assert.rejects(staff.requirePlatformStaff({ DB: db, userId: 'manager', sessionId: 'manager-session' }), { status: 403 });
await assert.rejects(administration.changeStaffMembership(db, owner, 'owner-session', { ...addStaff, userId: 'manager', revision: 1 }), { status: 409 });
await assert.rejects(administration.changeStaffMembership(db, owner, 'owner-session', { ...addStaff, userId: 'owner', revision: 1, active: 0 }), { status: 400 });
const staffTeam = load('src/routes/staff/team/+page.server.ts', {
  '@sveltejs/kit': actionKit, '#lib/server/platformStaff.ts': staff,
  '#lib/server/platformStaffAdministration.ts': administration, '#lib/server/security.ts': maintenanceSecurity
});
const roster = await staffTeam.load({ locals: ownerLocals, url: new URL('https://criminiops.com/staff/team') });
assert.equal(roster.members.length, 4);
assert.equal(JSON.stringify(roster).includes('password_hash'), false);
await assert.rejects(staffTeam.load({ locals: { DB: db, userId: 'support' } }), { status: 403 });
console.log('PASS session-bound expiry, write step-up, last-owner guards, audited grants/revocation, version conflicts, and unchanged tenant roles');

function maintenanceEvent(path, fields, locals = ownerLocals) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, String(value));
  return { locals, request: new Request(`https://criminiops.com${path}`, { method: 'POST', body }) };
}
const auditBeforeConfirm = sqlite.prepare('SELECT COUNT(*) AS n FROM platform_staff_audit').get().n;
const reservationFields = { serial: 'gateway-b', business_id: 'b', reason: 'Approved shipment' };
assert.equal((await inventory.actions.reserve(maintenanceEvent('/staff/equipment', reservationFields))).status, 400);
assert.equal((await staffTeam.actions.default(maintenanceEvent('/staff/team', {
  user_id: 'manager', role: 'support', active: 0, revision: 2, reason: 'Approved revocation'
}))).status, 400);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM platform_staff_audit').get().n, auditBeforeConfirm);
maintenanceAllowed = false;
assert.equal((await inventory.actions.reserve(maintenanceEvent('/staff/equipment', { ...reservationFields, confirmed: 'yes' }))).status, 429);
assert.equal((await staffTeam.actions.default(maintenanceEvent('/staff/team', { confirmed: 'yes' }))).status, 429);
maintenanceAllowed = true;
assert.equal((await inventory.actions.reserve(maintenanceEvent('/staff/equipment', { ...reservationFields, confirmed: 'yes', reason: '' }))).status, 400);
assert.equal((await inventory.actions.reserve(maintenanceEvent('/staff/equipment', { ...reservationFields, confirmed: 'yes' }))).success, true);
assert.equal((await inventory.actions.release(maintenanceEvent('/staff/equipment', {
  serial: 'gateway-b', reason: 'Shipment cancelled', confirmed: 'yes'
}))).success, true);
sqlite.exec("UPDATE users SET is_active=0 WHERE id='manager'");
const revokeInactive = { user_id: 'manager', role: 'support', active: 0, revision: 2, reason: 'Offboard inactive identity', confirmed: 'yes' };
assert.equal((await staffTeam.actions.default(maintenanceEvent('/staff/team', revokeInactive))).success, true);
assert.equal(sqlite.prepare("SELECT revision FROM platform_staff_members WHERE user_id='manager'").get().revision, 3);
assert.equal(sqlite.prepare("SELECT is_active FROM users WHERE id='manager'").get().is_active, 0);
assert.equal((await staffTeam.actions.default(maintenanceEvent('/staff/team', { ...revokeInactive, revision: 3, active: 1 }))).status, 409);
assert.equal(sqlite.prepare("SELECT is_active FROM users WHERE id='manager'").get().is_active, 0);
sqlite.exec("UPDATE users SET is_active=1 WHERE id='manager'");
console.log('PASS actual maintenance actions require confirmation/reasons, rate-limit changes, and revoke inactive staff without reactivating their login');

sqlite.exec(readFileSync('migrations/0059_store_entitlements.sql', 'utf8'));
sqlite.exec(`INSERT INTO business_store_entitlements
  (id,business_id,owner_user_id,store,product_id,entitlement_key,status,purchase_token_hash,raw_payload_json,created_at,updated_at)
  VALUES ('subscription-a','a','owner','google_play','product-a','plan_small','active','PRIVATE PURCHASE TOKEN','PRIVATE STORE PAYLOAD',1,1),
    ('subscription-b','b','manager','app_store','product-b','plan_large','active','OTHER TENANT TOKEN','OTHER TENANT PAYLOAD',1,1);
  INSERT INTO sessions VALUES('support-session','support',NULL,${now + 3600},NULL,'hashed-support-token',${now}),
    ('equipment-session','equipment',NULL,${now + 3600},NULL,'hashed-equipment-token',${now});
  INSERT INTO platform_staff_step_up SELECT s.id,s.user_id,m.revision,${now},${now}
    FROM sessions s JOIN platform_staff_members m ON m.user_id=s.user_id WHERE s.user_id IN ('support','equipment');`);
const businessDetail = load('src/routes/staff/businesses/[id]/+page.server.ts', { '@sveltejs/kit': kit, '#lib/server/platformStaff.ts': staff });
const activityPage = load('src/routes/staff/activity/+page.server.ts', { '#lib/server/platformStaff.ts': staff });
const staffEntry = load('src/routes/staff/+page.server.ts', { '@sveltejs/kit': { redirect }, '#lib/server/platformStaff.ts': staff });
const staffLayout = load('src/routes/staff/+layout.server.ts', { '#lib/server/platformStaff.ts': staff });
const staffPaths = ['/staff','/staff/businesses','/staff/businesses/a','/staff/equipment','/staff/health',
  '/staff/team','/staff/activity','/staff/security'];
const tenantCallsBeforeMatrix = tenantCalls;
for (const path of staffPaths) {
  const event = hookEvent(path, 'manager-token');
  event.locals = { userRole: 'admin', businessRole: 'owner' };
  assert.equal((await hooks.handle({ event, resolve: async () => { throw Error(`Nonstaff route reached: ${path}`); } })).status, 403);
  await assert.rejects(hooks.handle({ event: hookEvent(path, null), resolve: async () => new Response() }), { location: '/login?staff=1' });
  assert.equal((await hooks.handle({ event: hookEvent(path, 'owner-token', { method: 'POST', headers: { origin: 'https://attacker.invalid' } }),
    resolve: async () => { throw Error(`Cross-site staff route reached: ${path}`); } })).status, 403);
}
assert.equal(tenantCalls, tenantCallsBeforeMatrix, 'Staff requests never bootstrap or bypass a restaurant workspace');
for (const role of ['owner','support','equipment']) {
  const locals = { DB: db, userId: role, sessionId: `${role}-session` };
  const event = { locals, params: { id: 'a' }, url: new URL('https://criminiops.com/staff/health?business=a'), setHeaders(headers) { assert.equal(headers['cache-control'],'no-store'); } };
  await assert.rejects(staffEntry.load(event), { location: '/staff/businesses' });
  assert.equal((await staffLayout.load(event)).staff.role, role);
  assert.equal((await directory.load(event)).businesses.length, 2);
  assert.equal((await inventory.load(event)).canAssign, role !== 'support');
  const detail = await businessDetail.load(event);
  assert.equal(detail.business.id, 'a'); assert.equal(detail.business.members, 2);
  assert.equal(detail.subscriptions.length, 1); assert.equal(detail.subscriptions[0].store, 'google_play');
  for (const secret of ['PRIVATE PURCHASE TOKEN','PRIVATE STORE PAYLOAD','OTHER TENANT TOKEN','OTHER TENANT PAYLOAD','purchase_token_hash','raw_payload_json']) {
    assert.equal(JSON.stringify(detail).includes(secret), false);
  }
  await assert.rejects(businessDetail.load({ ...event, params: { id: "a' OR 1=1--" } }), { status: 404 });
  assert.equal((await healthPage.load(event)).canViewDelivery, role !== 'equipment');
  if (role === 'owner') {
    assert.ok((await activityPage.load(event)).events.length);
    assert.equal((await staffTeam.load(event)).members.length, 4);
  } else {
    await assert.rejects(activityPage.load(event), { status: 403 });
    await assert.rejects(staffTeam.load(event), { status: 403 });
    await assert.rejects(staffTeam.actions.default(maintenanceEvent('/staff/team', { confirmed: 'yes' }, locals)), { status: 403 });
  }
}
for (let i = 0; i < 22; i++) {
  sqlite.prepare('INSERT INTO businesses(id,name,status) VALUES(?,?,?)').run(`page-business-${i}`,`Paged Business ${i}`,'active');
  sqlite.prepare(`INSERT INTO iot_device_inventory(serial,device_type,key_hash,key_prefix,claim_status,created_at,updated_at)
    VALUES(?,'sensor_gateway',?,'prefix','available',1,1)`).run(`page-gateway-${i}`, 'c'.repeat(64));
}
for (const [loader, path, field] of [[directory,'businesses','businesses'],[inventory,'equipment','equipment']]) {
  const firstPage = await loader.load({ locals: ownerLocals, url: new URL(`https://criminiops.com/staff/${path}`) });
  const secondPage = await loader.load({ locals: ownerLocals, url: new URL(`https://criminiops.com/staff/${path}?page=2`) });
  assert.equal(firstPage[field].length,20); assert.equal(firstPage.hasNext,true);
  assert.equal(secondPage[field].length,4); assert.equal(secondPage.hasNext,false);
  const literalWildcard = await loader.load({ locals: ownerLocals, url: new URL(`https://criminiops.com/staff/${path}?q=%25`) });
  assert.equal(literalWildcard[field].length,0);
}
console.log('PASS all eight staff paths deny anonymous/nonstaff/forged-role/CSRF access; actual owner/support/equipment loads respect roles, tenant selection, secret exclusion, and pagination');

const auth = load('src/lib/server/auth.ts', {});
const passwordEnv = { PASSWORD_PEPPER: 'test-only-platform-confirmation-pepper' };
sqlite.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await auth.hashPassword('Staff-test-password!', passwordEnv), 'owner');
assert.equal(await staff.loadStaffStepUp(db, 'owner', 'owner-session'), null, 'Password changes invalidate staff verification');
let rateAllowed = true;
let emailAccepted = true;
let emailConfigured = true;
const messages = [];
const emailModule = {
  isEmailConfigured: () => emailConfigured,
  renderCriminiEmail: ({ body }) => body,
  sendTransactionalEmail: async message => { messages.push(message); return { sent: emailAccepted }; }
};
const staffEmailModule = load('src/lib/server/platformStaffEmail.ts', {
  '@sveltejs/kit': kit, '#lib/server/auth.ts': auth, '#lib/server/platformStaff.ts': staff,
  '#lib/server/email.ts': emailModule
});
const securityPage = load('src/routes/staff/security/+page.server.ts', {
  '@sveltejs/kit': { ...actionKit, redirect, isRedirect: error => Boolean(error.location) },
  '#lib/server/platformStaff.ts': staff, '#lib/server/platformStaffEmail.ts': staffEmailModule,
  '#lib/server/authCookies.ts': { getSessionCookieName: () => 'session', getSessionCookieOptions: () => ({ path: '/', httpOnly: true }) },
  '#lib/server/security.ts': { checkRateLimit: async () => ({ allowed: rateAllowed }), rateLimitFailure: error => ({ status: 429, error }) }
});
let rotatedToken = null;
function securityEvent(fields, locals = ownerLocals) {
  const form = new FormData();
  for (const [key,value] of Object.entries(fields)) form.set(key,value);
  return { locals: { ...locals, env: passwordEnv }, url: new URL('https://criminiops.com/staff/security?next=/staff/team'),
    request: new Request('https://criminiops.com/staff/security', { method: 'POST', body: form }),
    cookies: { set(name, token, options) {
      assert.equal(name, 'session'); assert.equal(options.httpOnly, true);
      assert.ok(options.maxAge <= 3600, 'Staff verification never extends the primary session'); rotatedToken = token;
    } } };
}
const action = fields => securityPage.actions.default(securityEvent(fields));
const sendFields = { intent: 'send', password: 'Staff-test-password!' };
const challengeRow = () => sqlite.prepare("SELECT * FROM platform_staff_email_challenges WHERE session_id='owner-session'").get();
function mailedCode() {
  const value = messages.at(-1).text.match(/code is ([0-9]{6})/)[1];
  assert.equal(messages.at(-1).sensitive, true);
  assert.equal(challengeRow().code_hash.includes(value), false);
  return value;
}
async function issue(fields = sendFields) {
  sqlite.exec('UPDATE platform_staff_email_challenges SET created_at=created_at-61');
  assert.equal((await action(fields)).sent, true);
  return { intent: 'verify', challenge: challengeRow().challenge_id, code: mailedCode() };
}
const beforePasswordOnly = sqlite.prepare("SELECT session_token_hash FROM sessions WHERE id='owner-session'").get().session_token_hash;
assert.equal((await action({ ...sendFields, password: 'wrong' })).status, 400);
assert.equal(messages.length,0);
rateAllowed = false;
assert.equal((await action(sendFields)).status, 429);
rateAllowed = true;
emailConfigured = false;
assert.equal((await action(sendFields)).status, 503);
emailConfigured = true;
emailAccepted = false;
assert.equal((await action(sendFields)).status, 503);
assert.equal(challengeRow(),undefined);
assert.equal(await staff.loadStaffStepUp(db,'owner','owner-session'),null);
emailAccepted = true;
const firstCode = await issue();
assert.equal(messages.at(-1).to,'owner@example.invalid');
assert.equal(rotatedToken,null);
assert.equal(sqlite.prepare("SELECT session_token_hash FROM sessions WHERE id='owner-session'").get().session_token_hash,beforePasswordOnly);
assert.equal(await staff.loadStaffStepUp(db,'owner','owner-session'),null,'Password alone cannot unlock staff tools');
assert.equal((await action(sendFields)).status,429,'Account-wide resend cooldown is atomic');
const pendingPage = await securityPage.load({ locals: ownerLocals, url: new URL('https://criminiops.com/staff/security') });
assert.equal(pendingPage.pending.id,firstCode.challenge);
for (const secret of [firstCode.code,challengeRow().code_hash,beforePasswordOnly,'owner@example.invalid']) {
  assert.equal(JSON.stringify(pendingPage).includes(secret),false);
}
const wrongCode = { ...firstCode, code: String((Number(firstCode.code)+1)%1_000_000).padStart(6,'0') };
assert.equal((await action(wrongCode)).status,400);
assert.equal(challengeRow().attempts,1);
sqlite.exec("CREATE TRIGGER test_audit_failure BEFORE INSERT ON platform_staff_audit BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;");
assert.equal((await action(firstCode)).status,503);
assert.equal(challengeRow().attempts,1,'Audit failure rolls back attempts and token/proof changes');
assert.equal(rotatedToken,null);
assert.equal(sqlite.prepare("SELECT session_token_hash FROM sessions WHERE id='owner-session'").get().session_token_hash,beforePasswordOnly);
sqlite.exec('DROP TRIGGER test_audit_failure');
await assert.rejects(action(firstCode),{ location:'/staff/team' });
assert.ok(rotatedToken);
assert.equal(sqlite.prepare("SELECT session_token_hash FROM sessions WHERE id='owner-session'").get().session_token_hash,await auth.hashSessionToken(rotatedToken));
assert.ok(await staff.loadStaffStepUp(db,'owner','owner-session'));
assert.equal(challengeRow(),undefined);
assert.equal((await action(firstCode)).status,400,'Consumed code cannot be replayed');
const confirmedPage = await securityPage.load({ locals:ownerLocals,url:new URL('https://criminiops.com/staff/security?next=/staff/team') });
assert.equal(confirmedPage.verified,true);
assert.equal(confirmedPage.pending,null);
console.log('PASS password + single-use emailed code, masked responses, provider failure, cooldown, rate limits, rotation and audit rollback');

const attemptCode = await issue();
const badAttempt = { ...attemptCode,code:String((Number(attemptCode.code)+1)%1_000_000).padStart(6,'0') };
for (let i=0;i<5;i++) assert.equal((await action(badAttempt)).status,400);
assert.equal(challengeRow().attempts,5);
assert.equal((await action(attemptCode)).status,400,'Five failed attempts exhaust even the correct code');
const replacement = await issue();
assert.equal((await action(attemptCode)).status,400,'Resend invalidates the earlier challenge');
sqlite.exec('UPDATE platform_staff_email_challenges SET expires_at=1');
assert.equal((await action(replacement)).status,400,'Expired codes are denied');
const crossSessionCode = await issue();
const foreign = await securityPage.actions.default(securityEvent(crossSessionCode,{ DB:db,userId:'support',sessionId:'support-session' }));
assert.equal(foreign.status,400);
sqlite.exec("UPDATE sessions SET session_token_hash='another-login' WHERE id='owner-session'");
assert.equal((await action(crossSessionCode)).status,400,'Rotated primary session invalidates an outstanding code');
const changingPasswordCode = await issue();
sqlite.exec("UPDATE users SET password_hash='changed' WHERE id='owner'");
assert.equal(challengeRow(),undefined);
assert.equal((await action(changingPasswordCode)).status,400);
sqlite.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await auth.hashPassword('Staff-test-password!',passwordEnv),'owner');
assert.equal((await action({ ...sendFields,intent:'change_email',email:'new-owner@example.invalid' })).status,403,'No address change without the current email factor');
await assert.rejects(action(await issue()),{ location:'/staff/team' });
console.log('PASS expiry, five-attempt exhaustion, resend, cross-session replay, password changes and unverified address-change denial');

sqlite.exec(`INSERT INTO sessions VALUES('owner-other-session','owner',NULL,${now+3600},NULL,'other-session-token',${now});
  INSERT INTO platform_staff_step_up SELECT 'owner-other-session',user_id,revision,${now},${now} FROM platform_staff_members WHERE user_id='owner';`);
const originalEmail = sqlite.prepare("SELECT email FROM users WHERE id='owner'").get().email;
const changeCode = await issue({ ...sendFields,intent:'change_email',email:'new-owner@example.invalid' });
assert.equal(messages.at(-1).to,'new-owner@example.invalid');
assert.equal(sqlite.prepare("SELECT otp_email FROM platform_staff_members WHERE user_id='owner'").get().otp_email,null,'No address change until the new mailbox is verified');
sqlite.exec("CREATE TRIGGER test_audit_failure BEFORE INSERT ON platform_staff_audit BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;");
assert.equal((await action(changeCode)).status,503);
assert.equal(sqlite.prepare("SELECT otp_email FROM platform_staff_members WHERE user_id='owner'").get().otp_email,null);
assert.ok(await staff.loadStaffStepUp(db,'owner','owner-other-session'));
sqlite.exec('DROP TRIGGER test_audit_failure');
await assert.rejects(action(changeCode),{ location:'/staff/security?updated=1' });
assert.equal(sqlite.prepare("SELECT otp_email FROM platform_staff_members WHERE user_id='owner'").get().otp_email,'new-owner@example.invalid');
assert.equal(sqlite.prepare("SELECT email FROM users WHERE id='owner'").get().email,originalEmail);
assert.equal(await staff.loadStaffStepUp(db,'owner','owner-other-session'),null,'Changing the factor revokes other staff confirmations');
assert.ok(await staff.loadStaffStepUp(db,'owner','owner-session'));
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM platform_staff_email_challenges WHERE user_id='owner'").get().n,0);
const afterChange = await issue();
assert.equal(messages.at(-1).to,'new-owner@example.invalid');
sqlite.exec("UPDATE platform_staff_members SET otp_email='operator-approved@example.invalid' WHERE user_id='owner'");
assert.equal((await action(afterChange)).status,400);
assert.equal(await staff.loadStaffStepUp(db,'owner','owner-session'),null);
assert.ok(sqlite.prepare("SELECT id FROM platform_staff_audit WHERE action='staff_verification_email_updated' AND actor_user_id IS NULL AND target_user_id='owner'").get());
assert.equal(sqlite.prepare("SELECT role FROM users WHERE id='owner'").get().role,'user');
assert.equal(sqlite.prepare("SELECT email FROM users WHERE id='owner'").get().email,originalEmail);
await assert.rejects(action(await issue()),{ location:'/staff/team' });
for (const message of messages) assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM platform_staff_audit').all()).includes(message.text),false);
const securityUi = readFileSync('src/routes/staff/security/+page.svelte','utf8');
assert.match(securityUi,/<form method="POST"/);
assert.ok(securityUi.includes('autocomplete="one-time-code"'));
assert.equal(/webauthn|passkey|navigator\.credentials/i.test(securityUi),false);
assert.equal(existsSync('src/routes/staff/security/passkeys/+server.ts'),false);
assert.equal(Object.keys(JSON.parse(readFileSync('package.json','utf8')).dependencies).some(name=>name.startsWith('@simplewebauthn/')),false);
console.log('PASS verified in-app email changes and audited operator updates invalidate other staff access, preserve restaurant identity, and use ordinary browser forms');

sqlite.exec(`DELETE FROM business_users WHERE business_id IN ('a','b') AND user_id IN ('owner','manager');
  INSERT INTO businesses(id,name,status) VALUES('cleanup','Cleanup tenant','active');
  INSERT INTO users(id,email,is_active,role) VALUES('ordinary','ordinary@example.invalid',1,'user');
  INSERT INTO business_users VALUES('cleanup','owner',1),('cleanup','manager',1),('cleanup','ordinary',1);
  INSERT INTO platform_staff_audit(id,actor_user_id,action,business_id,reason,created_at)
    VALUES('cleanup-proof','owner','test-cleanup','cleanup','Preserve platform history',1);`);
const trial = load('src/lib/server/trial.ts', { '$app/env': { dev: false }, '#lib/server/auth.ts': auth }, '\nexport { purgeBusinessWorkspaceData };');
await trial.purgeBusinessWorkspaceData(db, 'cleanup');
assert.ok(sqlite.prepare("SELECT id FROM users WHERE id='owner'").get());
assert.ok(sqlite.prepare("SELECT id FROM users WHERE id='manager'").get(), 'Revoked staff identity is still platform-owned');
assert.equal(sqlite.prepare("SELECT id FROM users WHERE id='ordinary'").get(), undefined);
assert.ok(sqlite.prepare("SELECT id FROM platform_staff_audit WHERE id='cleanup-proof'").get());
assert.ok(await staff.loadStaffStepUp(db, 'owner', 'owner-session'));
assert.equal(sqlite.prepare("SELECT id FROM businesses WHERE id='cleanup'").get(), undefined);
assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
console.log('PASS actual tenant purge preserves platform identities, verification, and audit without retaining ordinary tenant identities');

sqlite.exec(`INSERT INTO users(id,email,is_active,role) VALUES('backup-owner','backup@example.invalid',1,'user');
  INSERT INTO platform_staff_members(user_id,staff_role,is_active,granted_by,created_at,updated_at)
    VALUES('backup-owner','owner',1,'owner',1,1);
  UPDATE platform_staff_members SET staff_role='support' WHERE user_id='owner';`);
assert.equal(await staff.loadStaffStepUp(db, 'owner', 'owner-session'), null);
await assert.rejects(administration.changeStaffMembership(db, owner, 'owner-session', {
  userId: 'equipment', role: 'owner', active: 1, revision: 1, reason: 'Stale cached actor'
}), { status: 409 });
sqlite.exec(`UPDATE platform_staff_members SET staff_role='owner' WHERE user_id='owner';
  UPDATE users SET is_active=0 WHERE id='backup-owner';`);
assert.throws(() => sqlite.exec("UPDATE platform_staff_members SET staff_role='support' WHERE user_id='owner'"), /active platform owner/);
sqlite.exec(`UPDATE users SET is_active=1 WHERE id='backup-owner';
  INSERT INTO iot_device_reservations VALUES('gateway-b','b','backup-owner',1);
  DELETE FROM users WHERE id='backup-owner';`);
assert.equal(sqlite.prepare("SELECT reserved_by FROM iot_device_reservations WHERE serial='gateway-b'").get().reserved_by, null);
assert.equal(sqlite.prepare("SELECT business_id FROM iot_device_reservations WHERE serial='gateway-b'").get().business_id, 'b');
assert.throws(() => sqlite.exec("UPDATE iot_device_reservations SET business_id='a' WHERE serial='gateway-b'"), /Release the reservation/);
assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
console.log('PASS multiple-owner transitions, inactive-owner exclusion, stale actor rejection, and FK cleanup without gateway reassignment');
sqlite.close();
console.log('Platform staff integration checks passed.');
