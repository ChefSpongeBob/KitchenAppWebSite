import assert from 'node:assert/strict';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

const env = { PASSWORD_PEPPER: 'isolated-auth-lifecycle-pepper', APP_BASE_URL: 'https://criminiops.com' };
const auth = loadServerModules()('src/lib/server/auth.ts');
const password = 'Isolated-password-123!';
const originalHash = await auth.hashPassword(password, env);
const replacementHash = await auth.hashPassword('Changed-password-456!', env);
let failures = 0;

async function check(label, run) {
  const t = createTestD1(); const now = Math.floor(Date.now() / 1000);
  const insert = (table, row) => t.sqlite.prepare(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?')})`)
    .run(...Object.values(row));
  for (const id of ['alice', 'bob']) {
    insert('users', { id, email: id + '@example.invalid', email_normalized: id + '@example.invalid',
      password_hash: originalHash, display_name: id, created_at: now, updated_at: now });
    insert('businesses', { id: id + '-business', name: id, slug: id, status: 'active', created_at: now, updated_at: now });
    insert('business_users', { business_id: id + '-business', user_id: id, role: 'owner', permission_template: 'owner', created_at: now, updated_at: now });
    insert('business_trials', { business_id: id + '-business', owner_user_id: id, status: 'active', trial_started_at: now, trial_ends_at: now, created_at: now, updated_at: now });
    insert('devices', { id: id + '-device', user_id: id, pin_hash: '', created_at: now, updated_at: now });
    insert('sessions', { id: id + '-session', user_id: id, device_id: id + '-device', session_token_hash: await auth.hashSessionToken(id + '-token'),
      created_at: now, last_seen_at: now, expires_at: now + 3600 });
  }
  const token = 'a'.repeat(64); const tokenHash = await auth.sha256Hex(token);
  insert('password_resets', { id: 'reset-alice', user_id: 'alice', email: 'alice@example.invalid', token_hash: tokenHash,
    created_at: now, expires_at: now + 3600 });
  const cookies = new Map([['__Host-kitchen_session', 'bob-token'], ['kitchen_active_business', 'bob-business']]);
  const cookieOptions = [];
  const load = overrides => loadServerModules({ '#lib/server/observability.ts': { logOperationalError() {}, logOperationalEvent() {} }, ...overrides });
  const event = (path, fields, locals = {}) => ({ request: formRequest(fields, path), url: new URL('https://criminiops.com' + path),
    params: { token }, locals: { DB: t.db, env: { ...env, DB: t.db }, ...locals }, getClientAddress: () => '192.0.2.10',
    cookies: { get: key => cookies.get(key), delete: key => cookies.delete(key), set: (key, value, options) => { cookies.set(key, value); cookieOptions.push({ key, options }); } } });
  const outcome = async promise => { try { return await promise; } catch (error) { if (error.location) return error; throw error; } };
  const reset = (loader = load(), locals) => outcome(loader('src/routes/reset-password/[token]/+page.server.ts').actions.default(
    event('/reset-password/' + token, { password: 'New-password-789!', confirm_password: 'New-password-789!' }, locals)));
  const login = (loader = load(), locals, fields = {}, query = '') => outcome(loader('src/routes/login/+page.server.ts').actions.login(
    event('/login' + query, { email: 'alice@example.invalid', password, ...fields }, locals)));
  const row = (table, id) => t.sqlite.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
  const beforeBatch = action => {
    let called = false;
    return { ...t.db, batch: async statements => { if (!called) { called = true; await action(); } return t.db.batch(statements); } };
  };
  const guard = async (value = 'alice-token', path = '/app') => {
    const hooks = load({ 'cloudflare:workers': { env: { ...env, DB: t.db }, waitUntil() {} },
      '#lib/server/platformDiagnostics.ts': { async recordRequestDiagnostic() {} },
      '#lib/server/operationalEvents.ts': { async processOperationalEvents() {} } })('src/hooks.server.ts');
    const current = event(path, {}); current.request = new Request(current.url); current.locals = {};
    cookies.set('__Host-kitchen_session', value); cookies.delete('kitchen_active_business');
    return outcome(hooks.handle({ event: current, resolve: async () => new Response('Authorized') }));
  };
  try {
    await run({ ...t, now, insert, token, tokenHash, load, cookies, cookieOptions, event, outcome, reset, login, row, beforeBatch, guard });
    assert.deepEqual(t.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    console.log('PASS ' + label);
  } catch (error) { failures++; console.error('FAIL ' + label + ': ' + error.message); }
  finally { t.close(); }
}

await check('a reset request does not delete another account\'s unused reset link', async t => {
  const helper = t.load()('src/lib/server/passwordReset.ts');
  await helper.createPasswordResetRecord({ db: t.db, userId: 'bob', email: 'bob@example.invalid', tokenHash: await auth.sha256Hex('b'.repeat(64)) });
  assert.equal(t.row('password_resets', 'reset-alice')?.used_at, null);
});

await check('failed reset issuance rolls back invalidation of the previous link', async t => {
  t.sqlite.exec("CREATE TRIGGER fixture_fail_reset BEFORE INSERT ON password_resets BEGIN SELECT RAISE(ABORT,'isolated reset insert failure'); END");
  await assert.rejects(t.load()('src/lib/server/passwordReset.ts').createPasswordResetRecord({ db: t.db, userId: 'alice', email: 'alice@example.invalid', tokenHash: 'another-hash' }));
  assert.equal(t.row('password_resets', 'reset-alice')?.used_at, null);
});

for (const [label, change] of [
  ['expiry is exclusive', t => t.sqlite.prepare('UPDATE password_resets SET expires_at=?').run(t.now)],
  ['changed email invalidates an old-address reset link', t => t.sqlite.exec("UPDATE users SET email='new@example.invalid',email_normalized='new@example.invalid' WHERE id='alice'")],
  ['inactive accounts cannot use reset links', t => t.sqlite.exec("UPDATE users SET is_active=0 WHERE id='alice'")]
]) await check(label, async t => {
  change(t); const result = await t.reset(); assert.equal(result.status, 400); assert.equal(t.row('users', 'alice').password_hash, originalHash);
});

await check('a consumed token cannot win a second reset after validation', async t => {
  const db = t.beforeBatch(() => t.sqlite.exec("UPDATE password_resets SET used_at=1 WHERE id='reset-alice'"));
  assert.equal((await t.reset(t.load(), { DB: db })).status, 400);
  assert.equal(t.row('users', 'alice').password_hash, originalHash);
});

await check('a concurrent password change cannot be overwritten by a stale reset submission', async t => {
  const db = t.beforeBatch(() => t.sqlite.prepare("UPDATE users SET password_hash=? WHERE id='alice'").run(replacementHash));
  assert.equal((await t.reset(t.load(), { DB: db })).status, 400);
  assert.equal(t.row('users', 'alice').password_hash, replacementHash);
});

for (const table of ['sessions', 'devices', 'account_audit_logs']) await check('reset rolls back password/token/session/device changes when ' + table + ' fails', async t => {
  t.sqlite.exec(`CREATE TRIGGER fixture_reset_failure BEFORE ${table === 'account_audit_logs' ? 'INSERT' : 'UPDATE'} ON ${table} BEGIN SELECT RAISE(ABORT,'isolated write failure'); END`);
  assert.equal((await t.reset()).status, 503);
  assert.equal(t.row('users', 'alice').password_hash, originalHash);
  assert.equal(t.row('password_resets', 'reset-alice').used_at, null);
  assert.equal(t.row('sessions', 'alice-session').revoked_at, null);
  assert.equal(t.row('devices', 'alice-device').revoked_at, null);
});

await check('successful reset consumes all own links and revokes only own sessions/devices, with a hashed audit', async t => {
  assert.equal((await t.reset()).location, '/login?reset=success');
  assert.equal((await auth.verifyPassword('New-password-789!', t.row('users', 'alice').password_hash, env)).valid, true);
  assert.ok(t.row('sessions', 'alice-session').revoked_at); assert.ok(t.row('devices', 'alice-device').revoked_at);
  assert.equal(t.row('sessions', 'bob-session').revoked_at, null); assert.equal(t.row('devices', 'bob-device').revoked_at, null);
  assert.ok(t.row('password_resets', 'reset-alice').used_at);
  assert.equal((await t.reset()).status, 400);
  const audits = t.sqlite.prepare("SELECT * FROM account_audit_logs WHERE action='password_reset_completed'").all();
  assert.equal(audits.length, 1); assert.ok(audits[0].email_hash); assert.ok(!JSON.stringify(audits).includes('alice@example.invalid'));
});

await check('an interrupted reset response recovers its exact committed result without replaying the password change', async t => {
  const db = { ...t.db, batch: async statements => { await t.db.batch(statements); throw Error('isolated lost commit response'); } };
  assert.equal((await t.reset(t.load(), { DB: db })).location, '/login?reset=success');
});

await check('bad credentials preserve the current account and workspace', async t => {
  assert.equal((await t.login(t.load(), { userId: 'bob' }, { password: 'wrong' })).status, 400);
  assert.equal(t.cookies.get('__Host-kitchen_session'), 'bob-token'); assert.equal(t.cookies.get('kitchen_active_business'), 'bob-business');
  assert.equal(t.row('sessions', 'bob-session').revoked_at, null);
});

await check('failed session insertion preserves the current session and workspace without orphaning a device', async t => {
  t.sqlite.exec("DELETE FROM sessions WHERE user_id='alice'; DELETE FROM devices WHERE user_id='alice'; CREATE TRIGGER fixture_session_failure BEFORE INSERT ON sessions BEGIN SELECT RAISE(ABORT,'isolated insert failure'); END");
  assert.equal((await t.login()).status, 500);
  assert.equal(t.cookies.get('__Host-kitchen_session'), 'bob-token'); assert.equal(t.cookies.get('kitchen_active_business'), 'bob-business');
  assert.equal(t.row('sessions', 'bob-session').revoked_at, null);
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM devices WHERE user_id='alice'").get().n, 0);
});

for (const [label, change] of [
  ['password changes during sign-in cannot mint an old-password session', t => t.sqlite.prepare("UPDATE users SET password_hash=? WHERE id='alice'").run(replacementHash)],
  ['account deactivation during sign-in cannot mint a session', t => t.sqlite.exec("UPDATE users SET is_active=0 WHERE id='alice'")]
]) await check(label, async t => {
  const loader = t.load({ '#lib/server/auth.ts': { ...auth, verifyPassword: async (...args) => { const result = await auth.verifyPassword(...args); change(t); return result; } } });
  assert.equal((await t.login(loader)).status, 400);
  assert.equal(t.cookies.get('__Host-kitchen_session'), 'bob-token'); assert.equal(t.row('sessions', 'bob-session').revoked_at, null);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n, 2);
});

await check('missing restaurant membership cannot discard the previous signed-in account', async t => {
  t.sqlite.exec("DELETE FROM business_users WHERE user_id='alice'");
  assert.equal((await t.login()).status, 403); assert.equal(t.cookies.get('__Host-kitchen_session'), 'bob-token');
  assert.equal(t.row('sessions', 'bob-session').revoked_at, null);
});

await check('successful alternate-account sign-in rotates only this browser session and clears restaurant context', async t => {
  assert.equal((await t.login()).location, '/app');
  const cookie = t.cookies.get('__Host-kitchen_session'); assert.ok(cookie && cookie !== 'bob-token');
  assert.ok(t.row('sessions', 'bob-session').revoked_at); assert.equal(t.row('sessions', 'alice-session').revoked_at, null);
  assert.equal(t.cookies.has('kitchen_active_business'), false);
  assert.equal(t.sqlite.prepare('SELECT user_id FROM sessions WHERE session_token_hash=?').get(await auth.hashSessionToken(cookie)).user_id, 'alice');
  assert.equal(t.cookieOptions.at(-1).options.httpOnly, true); assert.equal(t.cookieOptions.at(-1).options.secure, true);
});

await check('already signed-in same-account continuation does not create another session', async t => {
  t.cookies.set('__Host-kitchen_session', 'alice-token');
  assert.equal((await t.login(t.load(), { userId: 'alice', businessId: 'alice-business' })).location, '/app');
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n, 2);
});

await check('concurrent abuse attempts cannot overwrite the same rate-limit counter', async t => {
  const security = t.load()('src/lib/server/security.ts');
  const results = await Promise.all(Array.from({ length: 30 }, () => security.checkRateLimit(t.db, {
    action: 'isolated-concurrent-limit', identifier: 'same-identity', limit: 8, windowSeconds: 900, blockSeconds: 900
  })));
  assert.equal(results.filter(result => result.allowed).length, 8);
  assert.ok(results.filter(result => !result.allowed).every(result => result.retryAfterSeconds > 0));
});

for (const failed of [false, true, 'throw']) await check('reset requests retain the same response for unknown users and provider result ' + failed, async t => {
  const loader = t.load({ '#lib/server/email.ts': { sendPasswordResetEmail: async () => {
    if (failed === 'throw') throw Error('isolated provider failure');
    return { sent: !failed, reason: 'PRIVATE PROVIDER ERROR' };
  } } });
  const handler = loader('src/routes/forgot-password/+page.server.ts').actions.default;
  const known = await handler(t.event('/forgot-password', { email: 'alice@example.invalid' }));
  const unknown = await handler(t.event('/forgot-password', { email: 'unknown@example.invalid' }));
  assert.equal(known.notice, unknown.notice); assert.equal(known.status, unknown.status);
  assert.ok(!JSON.stringify(known).includes('PRIVATE PROVIDER'));
  if (failed) assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM password_resets WHERE user_id='alice' AND used_at IS NULL").get().n, 0);
});

await check('40 successful logins behind a restaurant IP do not consume its failed-login budget', async t => {
  const loader = t.load();
  for (let i = 0; i < 40; i++) assert.equal((await t.login(loader)).location, '/app', 'Successful login ' + (i + 1));
  const failedKey = await auth.sha256Hex('login_failed_ip:192.0.2.10');
  assert.equal(t.sqlite.prepare('SELECT * FROM security_rate_limits WHERE key_hash=?').get(failedKey), undefined);
});

await check('distributed bad-account attempts still block the restaurant IP after the failure allowance', async t => {
  const loader = t.load();
  for (let i = 0; i < 21; i++) assert.equal((await t.login(loader, {}, { email: `unknown${i}@example.invalid` })).status, 400);
  assert.equal((await t.login(loader)).status, 429);
});

await check('individual-account limits remain enforced independently of the IP failure allowance', async t => {
  const loader = t.load();
  for (let i = 0; i < 8; i++) assert.equal((await t.login(loader, {}, { password: 'wrong' })).status, 400);
  assert.equal((await t.login(loader)).status, 429);
});

await check('a displayed session row ID is not an authentication bearer token', async t => {
  assert.equal((await t.guard('alice-session')).location, '/login?error=session');
});

await check('a stored SHA-256 session hash cannot be used as a bearer token', async t => {
  assert.equal((await t.guard(await auth.hashSessionToken('alice-token'))).location, '/login?error=session');
});

await check('a session cannot inherit a device belonging to another account', async t => {
  t.sqlite.exec("UPDATE sessions SET device_id='bob-device' WHERE id='alice-session'");
  assert.equal((await t.guard()).location, '/login?error=session');
});

await check('session expiry is exclusive at the exact expiry second', async t => {
  t.sqlite.prepare("UPDATE sessions SET expires_at=? WHERE id='alice-session'").run(t.now);
  const realNow = Date.now; Date.now = () => t.now * 1000;
  try { assert.equal((await t.guard()).location, '/login?error=session'); } finally { Date.now = realNow; }
});

await check('valid private responses prohibit browser caches and revoked sessions cannot re-enter', async t => {
  const response = await t.guard(); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  t.sqlite.exec("UPDATE sessions SET revoked_at=1 WHERE id='alice-session'");
  assert.equal((await t.guard()).location, '/login?error=session');
});

await check('expired trials block app access but retain the restaurant, all memberships and profiles', async t => {
  t.sqlite.prepare("UPDATE business_trials SET status='trialing',trial_ends_at=? WHERE business_id='alice-business'").run(t.now - 1);
  const trial = t.load()('src/lib/server/trial.ts');
  const result = await trial.getBusinessTrialAccess(t.db, 'alice-business');
  assert.equal(result.allowApp, false); assert.equal(result.shouldPurge, false);
  assert.equal((await t.guard()).location, '/billing?access=required');
  assert.ok(t.row('businesses', 'alice-business')); assert.ok(t.row('users', 'alice'));
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM business_users').get().n, 2);
  assert.equal(t.row('sessions', 'alice-session').revoked_at, null);
  assert.equal(t.row('businesses', 'bob-business').status, 'active');
});

await check('concurrent paid activation cannot be overwritten by an older expiry check', async t => {
  t.sqlite.prepare("UPDATE business_trials SET status='trialing',trial_ends_at=? WHERE business_id='alice-business'").run(t.now - 1);
  const db = t.beforeBatch(() => t.sqlite.exec("UPDATE business_trials SET status='active' WHERE business_id='alice-business'"));
  const result = await t.load()('src/lib/server/trial.ts').getBusinessTrialAccess(db, 'alice-business');
  assert.equal(result.allowApp, true); assert.equal(t.row('businesses', 'alice-business').status, 'active');
});

await check('authorized workspace cancellation changes only its access records and audit, never operational/HR/account data', async t => {
  t.insert('employee_profiles', { business_id: 'alice-business', user_id: 'alice', real_name: 'Preserved employee', updated_at: t.now });
  t.insert('employee_onboarding_packages', { id: 'retained-packet', business_id: 'alice-business', user_id: 'alice', status: 'in_progress', sent_at: t.now, updated_at: t.now });
  const tables = t.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
    .map(row => row.name).filter(name => !['businesses', 'business_trials', 'account_audit_logs'].includes(name));
  const snapshot = () => tables.map(name => [name, JSON.stringify(t.sqlite.prepare(`SELECT * FROM ${name}`).all())]);
  const before = snapshot(); const other = JSON.stringify(t.row('businesses', 'bob-business'));
  const cancel = t.load()('src/lib/server/trial.ts').cancelBusinessAccess;
  assert.equal(await cancel(t.db, { businessId: 'alice-business', requestedByUserId: 'alice', sessionId: 'alice-session', request: formRequest({}) }), true);
  assert.deepEqual(snapshot(), before); assert.equal(JSON.stringify(t.row('businesses', 'bob-business')), other);
  assert.equal(t.row('businesses', 'alice-business').status, 'canceled');
  assert.equal(t.sqlite.prepare("SELECT action FROM account_audit_logs").get().action, 'billing_workspace_canceled');
});

for (const mode of ['foreign', 'revoked', 'permissions', 'rollback']) await check('cancellation rejects stale/foreign authority or rolls back on ' + mode, async t => {
  const cancel = t.load()('src/lib/server/trial.ts').cancelBusinessAccess;
  let db = t.db;
  if (mode === 'revoked') db = t.beforeBatch(() => t.sqlite.exec("UPDATE sessions SET revoked_at=1 WHERE id='alice-session'"));
  if (mode === 'permissions') db = t.beforeBatch(() => t.sqlite.exec("UPDATE business_users SET role='staff',permission_template='staff' WHERE user_id='alice'"));
  if (mode === 'rollback') t.sqlite.exec("CREATE TRIGGER fixture_cancel_failure BEFORE UPDATE ON businesses BEGIN SELECT RAISE(ABORT,'isolated cancellation failure');END");
  const pending = cancel(db, { businessId: 'alice-business', requestedByUserId: mode === 'foreign' ? 'bob' : 'alice', sessionId: 'alice-session', request: formRequest({}) });
  if (mode === 'rollback') await assert.rejects(pending); else assert.equal(await pending, false);
  assert.equal(t.row('businesses', 'alice-business').status, 'active');
  assert.equal(t.sqlite.prepare("SELECT status FROM business_trials WHERE business_id='alice-business'").get().status, 'active');
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n, 0);
});

await check('Staff verification cannot outlive device revocation or a mismatched device owner', async t => {
  t.insert('platform_staff_members', { user_id: 'alice', staff_role: 'owner', created_at: t.now, updated_at: t.now });
  t.insert('platform_staff_step_up', { session_id: 'alice-session', user_id: 'alice', membership_revision: 1, verified_at: t.now, email_verified_at: t.now });
  const loader = t.load(), staff = loader('src/lib/server/platformStaff.ts'), email = loader('src/lib/server/platformStaffEmail.ts');
  assert.ok(await staff.loadStaffStepUp(t.db, 'alice', 'alice-session'));
  assert.ok(await email.staffEmailIdentity(t.db, 'alice', 'alice-session'));
  t.sqlite.exec("UPDATE devices SET revoked_at=1 WHERE id='alice-device'");
  assert.equal(await staff.loadStaffStepUp(t.db, 'alice', 'alice-session'), null);
  assert.equal(await email.staffEmailIdentity(t.db, 'alice', 'alice-session'), null);
  t.sqlite.exec("UPDATE devices SET revoked_at=NULL WHERE id='alice-device'; UPDATE sessions SET device_id='bob-device' WHERE id='alice-session'");
  assert.equal(await staff.loadStaffStepUp(t.db, 'alice', 'alice-session'), null);
  assert.equal(await email.staffEmailIdentity(t.db, 'alice', 'alice-session'), null);
});

await check('a missing production pepper fails closed even when NODE_ENV is unset, while explicit local development remains available', async () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, PASSWORD_PEPPER: process.env.PASSWORD_PEPPER };
  delete process.env.PASSWORD_PEPPER;
  try {
    for (const mode of [undefined, 'production']) {
      if (mode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = mode;
      await assert.rejects(auth.hashPassword(password, {}), /PASSWORD_PEPPER is required/);
    }
    process.env.NODE_ENV = 'development';
    const hash = await auth.hashPassword(password, {}); assert.equal((await auth.verifyPassword(password, hash, {})).valid, true);
  } finally {
    for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});

if (failures) { console.error(`${failures} authentication lifecycle cases failed.`); process.exitCode = 1; }
