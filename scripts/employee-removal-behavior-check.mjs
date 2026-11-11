import assert from 'node:assert/strict';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

const now = Math.floor(Date.now() / 1000);
function fixture() {
  const test = createTestD1(), { sqlite, db } = test;
  const insert = (table, row) => {
    const keys = Object.keys(row);
    sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
  };
  for (const id of ['owner', 'employee', 'outsider', 'manager']) {
    insert('users', { id, email: `${id}@example.invalid`, email_normalized: `${id}@example.invalid`,
      display_name: id, password_hash: 'unchanged-isolated-hash', role: 'admin', created_at: now, updated_at: now });
    insert('devices', { id: `${id}-device`, user_id: id, pin_hash: '', created_at: now, updated_at: now });
    insert('sessions', { id: `${id}-session`, user_id: id, device_id: `${id}-device`, session_token_hash: `${id}-isolated-hash`,
      created_at: now, last_seen_at: now, expires_at: now + 3600 });
  }
  for (const id of ['a', 'b']) insert('businesses', { id, name: `Restaurant ${id}`, slug: id, status: 'active', created_at: now, updated_at: now });
  const member = (business, user, role = 'staff', active = 1) => insert('business_users', { business_id: business,
    user_id: user, role, permission_template: role, is_active: active, created_at: now, updated_at: now });
  member('a', 'owner', 'owner'); member('a', 'employee'); member('a', 'manager', 'manager'); member('b', 'outsider', 'owner');
  insert('employee_profiles', { business_id: 'a', user_id: 'employee', real_name: 'Retained name', phone: '', updated_at: now });
  insert('employee_employment_records', { business_id: 'a', user_id: 'employee', employment_status: 'active', created_at: now, updated_at: now });
  insert('employee_onboarding_packages', { id: 'packet', business_id: 'a', user_id: 'employee', status: 'approved', sent_at: now,
    approved_at: now, locked_at: now, updated_at: now });
  insert('employee_sensitive_record_vault', { id: 'vault', business_id: 'a', user_id: 'employee', record_scope: 'tax', record_type: 'withholding',
    encrypted_payload: 'unchanged-encrypted-record', status: 'accepted', locked_at: now, created_at: now, updated_at: now });
  insert('employee_compliance_documents', { id: 'document', business_id: 'a', user_id: 'employee', status: 'approved',
    file_url: '/api/documents/media/private-retained-document', file_name: 'retained.pdf', created_at: now, updated_at: now });
  for (const business of ['a', 'b']) insert('business_invites', { id: `invite-${business}`, business_id: business,
    email: 'employee@example.invalid', email_normalized: 'employee@example.invalid', invite_code: `FRESH-${business}`,
    role: 'staff', permission_template: 'staff', created_at: now, expires_at: now + 3600 });
  const load = loadServerModules({ '#lib/server/observability.ts': { logOperationalError() {}, logOperationalEvent() {} } });
  const locals = { DB: db, userId: 'owner', sessionId: 'owner-session', userRole: 'admin', businessId: 'a', businessRole: 'owner', businessPermissionTemplate: 'owner' };
  const remove = (overrides = {}, target = 'employee') => load('src/lib/server/admin.ts').deleteUser(
    formRequest({ user_id: target }, '/admin/users/employee?/delete_user'), { ...locals, ...overrides });
  const all = table => sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
  const retained = () => JSON.stringify(['users', 'employee_profiles', 'employee_employment_records', 'employee_onboarding_packages',
    'employee_sensitive_record_vault', 'employee_compliance_documents'].map(all));
  return { ...test, insert, member, load, locals, remove, all, retained };
}
let passed = 0;
async function check(name, run) {
  const t = fixture();
  try { await run(t); assert.deepEqual(t.sqlite.prepare('PRAGMA foreign_key_check').all(), []); passed++; console.log(`PASS ${name}`); }
  finally { t.close(); }
}
const saved = async promise => assert.rejects(promise, { status: 303, location: '/admin/users' });
const active = t => t.sqlite.prepare("SELECT is_active FROM business_users WHERE business_id='a' AND user_id='employee'").get().is_active;

await check('last-restaurant removal retains identity, encrypted HR, packet and private-file references; revokes sessions/devices and pending scoped invites', async t => {
  const records = t.retained(); await saved(t.remove()); assert.equal(active(t), 0); assert.equal(t.retained(), records);
  assert.ok(t.all('sessions').find(r => r.user_id === 'employee').revoked_at);
  assert.ok(t.all('devices').find(r => r.user_id === 'employee').revoked_at);
  assert.equal(t.all('sessions').find(r => r.user_id === 'owner').revoked_at, null);
  assert.ok(t.all('business_invites').find(r => r.business_id === 'a').revoked_at);
  assert.equal(t.all('business_invites').find(r => r.business_id === 'b').revoked_at, null);
  const audit = t.all('account_audit_logs'); assert.equal(audit.length, 1);
  assert.equal(audit[0].actor_user_id, 'owner'); assert.equal(audit[0].target_user_id, 'employee'); assert.equal(audit[0].business_id, 'a');
  assert.deepEqual(JSON.parse(audit[0].metadata_json), { removedUserId: 'employee', accountDeleted: false, membershipDeactivated: true });
  await saved(t.remove()); assert.equal(t.all('account_audit_logs').length, 1, 'retry does not create another event');
});

for (const other of ['active restaurant', 'active Staff', 'inactive restaurant', 'inactive Staff']) {
  await check(`${other}: removal preserves only other active access, never deletes an identity`, async t => {
    const enabled = other.startsWith('active');
    if (other.endsWith('restaurant')) t.member('b', 'employee', 'staff', enabled ? 1 : 0);
    else t.insert('platform_staff_members', { user_id: 'employee', staff_role: 'support', is_active: enabled ? 1 : 0, created_at: now, updated_at: now });
    const otherBefore = t.sqlite.prepare("SELECT * FROM business_users WHERE business_id='b'").all();
    await saved(t.remove()); assert.equal(active(t), 0);
    assert.equal(t.all('sessions').find(r => r.user_id === 'employee').revoked_at === null, enabled);
    assert.equal(t.all('devices').find(r => r.user_id === 'employee').revoked_at === null, enabled);
    assert.deepEqual(t.sqlite.prepare("SELECT * FROM business_users WHERE business_id='b'").all(), otherBefore);
    assert.ok(t.sqlite.prepare("SELECT id FROM users WHERE id='employee'").get());
  });
}

await check('removed membership is absent from actual workspace/assignable roster; management retains the inactive employee record', async t => {
  await saved(t.remove());
  const business = t.load('src/lib/server/business.ts'), schedules = t.load('src/lib/server/schedules.ts');
  assert.equal(await business.getUserBusinessContext(t.db, 'employee', 'a'), null);
  assert.equal((await business.loadUserBusinessMemberships(t.db, 'employee')).length, 0);
  assert.equal((await schedules.loadScheduleAssignableUsers(t.db, 'a')).some(r => r.id === 'employee'), false);
  const roster = await t.load('src/lib/server/admin.ts').loadAdminUsers(t.db, 'a');
  assert.equal(roster.find(r => r.id === 'employee').is_active, 0);
});

for (const [label, target, status] of [['self', 'owner', 400], ['other restaurant', 'outsider', 404], ['unknown identity', 'missing', 404]]) {
  await check(`${label} cannot be removed through the employee action`, async t => {
    const before = t.retained(); assert.equal((await t.remove({}, target)).status, status); assert.equal(t.retained(), before); assert.equal(t.all('account_audit_logs').length, 0);
  });
}
await check('manager cannot remove an owner or another manager without Manage Managers; explicit current grant permits it', async t => {
  const actor = { userId: 'manager', sessionId: 'manager-session', businessRole: 'manager', businessPermissionTemplate: 'general_manager' };
  assert.equal((await t.remove(actor, 'owner')).status, 403);
  t.sqlite.exec("UPDATE business_users SET role='manager',permission_template='general_manager' WHERE user_id='employee'");
  assert.equal((await t.remove(actor)).status, 403);
  t.insert('employee_role_permissions', { business_id: 'a', user_id: 'manager', permission_key: 'manage_managers', is_enabled: 1, updated_at: now });
  await saved(t.remove(actor)); assert.equal(active(t), 0);
});

for (const [label, sql] of [
  ['actor revoked', "UPDATE business_users SET is_active=0 WHERE user_id='owner'"],
  ['actor disabled', "UPDATE users SET is_active=0 WHERE id='owner'"],
  ['owner demoted', "UPDATE business_users SET role='staff',permission_template='staff' WHERE user_id='owner'"],
  ['individual permission revoked', "INSERT INTO employee_role_permissions(business_id,user_id,permission_key,is_enabled,updated_at) VALUES('a','owner','manage_people',0,1)"],
  ['target becomes owner', "UPDATE business_users SET role='owner' WHERE user_id='employee'"],
  ['target becomes manager', "UPDATE business_users SET role='manager' WHERE user_id='employee'"],
  ['target removed concurrently', "UPDATE business_users SET is_active=0 WHERE user_id='employee'"],
  ['session revoked', "UPDATE sessions SET revoked_at=1 WHERE id='owner-session'"],
  ['session expires', "UPDATE sessions SET expires_at=1 WHERE id='owner-session'"],
  ['device revoked', "UPDATE devices SET revoked_at=1 WHERE id='owner-device'"],
  ['device owner changes', "UPDATE devices SET user_id='outsider' WHERE id='owner-device'"],
  ['restaurant canceled', "UPDATE businesses SET status='canceled' WHERE id='a'"]
]) await check(`commit-time ${label} rejects every child write and removal audit`, async t => {
  const raced = { ...t.db, async batch(statements) { t.sqlite.exec(sql); return t.db.batch(statements); } };
  assert.equal((await t.remove({ DB: raced })).status, 409);
  assert.equal(t.all('account_audit_logs').length, 0); assert.equal(t.all('business_invites')[0].revoked_at, null);
  assert.equal(t.all('sessions').find(r => r.user_id === 'employee').revoked_at, null);
  assert.ok(t.sqlite.prepare("SELECT id FROM users WHERE id='employee'").get());
});

for (const access of ['restaurant', 'Staff']) await check(`another ${access} granted during removal keeps the target global session`, async t => {
  const raced = { ...t.db, async batch(statements) {
    if (access === 'restaurant') t.member('b', 'employee');
    else t.insert('platform_staff_members', { user_id: 'employee', staff_role: 'support', is_active: 1, created_at: now, updated_at: now });
    return t.db.batch(statements);
  } };
  await saved(t.remove({ DB: raced })); assert.equal(active(t), 0);
  assert.equal(t.all('sessions').find(r => r.user_id === 'employee').revoked_at, null);
});

await check('last-management guard is checked again in the transaction, independently of actor authority', async t => {
  t.sqlite.exec("UPDATE business_users SET role='external',permission_template='consultant' WHERE user_id='owner'; UPDATE business_users SET role='manager',permission_template='general_manager' WHERE user_id='employee'");
  for (const permission_key of ['admin_access', 'manage_people', 'manage_managers']) t.insert('employee_role_permissions', {
    business_id: 'a', user_id: 'owner', permission_key, is_enabled: 1, updated_at: now });
  const actor = { businessRole: 'external', businessPermissionTemplate: 'consultant', businessCapabilities: ['admin_access', 'manage_people', 'manage_managers'] };
  const raced = { ...t.db, async batch(statements) { t.sqlite.exec("UPDATE business_users SET is_active=0 WHERE user_id='manager'"); return t.db.batch(statements); } };
  assert.equal((await t.remove({ ...actor, DB: raced })).status, 409); assert.equal(active(t), 1); assert.equal(t.all('account_audit_logs').length, 0);
  assert.equal((await t.remove(actor)).status, 400); assert.equal(active(t), 1);
});

await check('stale local permissions and an absent session cannot authorize employee removal', async t => {
  assert.equal((await t.remove({ sessionId: undefined })).status, 403);
  t.sqlite.exec("UPDATE business_users SET role='staff',permission_template='staff' WHERE user_id='owner'");
  assert.equal((await t.remove()).status, 403); assert.equal(active(t), 1); assert.equal(t.all('account_audit_logs').length, 0);
});

await check('a disabled global manager cannot satisfy the last-management safeguard', async t => {
  t.sqlite.exec("UPDATE business_users SET role='external',permission_template='consultant' WHERE user_id='owner'; UPDATE business_users SET role='manager',permission_template='general_manager' WHERE user_id='employee'");
  for (const permission_key of ['admin_access', 'manage_people', 'manage_managers']) t.insert('employee_role_permissions', {
    business_id: 'a', user_id: 'owner', permission_key, is_enabled: 1, updated_at: now });
  const actor = { businessRole: 'external', businessPermissionTemplate: 'consultant', businessCapabilities: ['admin_access', 'manage_people', 'manage_managers'] };
  const raced = { ...t.db, async batch(statements) { t.sqlite.exec("UPDATE users SET is_active=0 WHERE id='manager'"); return t.db.batch(statements); } };
  assert.equal((await t.remove({ ...actor, DB: raced })).status, 409); assert.equal(active(t), 1);
  assert.equal((await t.remove(actor)).status, 400); assert.equal(t.all('account_audit_logs').length, 0);
});

await check('commit-time position permissions are guarded as well as individual permissions', async t => {
  t.insert('business_positions', { id: 'owner-position', business_id: 'a', name: 'Position', account_type: 'manager', base_template: 'general_manager',
    created_at: now, updated_at: now });
  t.sqlite.exec("UPDATE business_users SET position_id='owner-position' WHERE user_id='owner'");
  const raced = { ...t.db, async batch(statements) {
    t.insert('business_position_permissions', { business_id: 'a', position_id: 'owner-position', permission_key: 'manage_people', is_enabled: 0, updated_at: now });
    return t.db.batch(statements);
  } };
  assert.equal((await t.remove({ DB: raced })).status, 409); assert.equal(active(t), 1); assert.equal(t.all('account_audit_logs').length, 0);
});

for (const table of ['business_users', 'business_invites', 'sessions', 'devices']) await check(`late ${table} failure rolls back removal, revocations and audit together`, async t => {
  const tables = ['business_users', 'business_invites', 'sessions', 'devices', 'account_audit_logs'];
  const before = JSON.stringify(tables.map(t.all));
  t.sqlite.exec(`CREATE TRIGGER fixture_remove_failure BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'isolated removal failure'); END`);
  assert.equal((await t.remove()).status, 503); assert.equal(JSON.stringify(tables.map(t.all)), before);
  t.sqlite.exec('DROP TRIGGER fixture_remove_failure'); await saved(t.remove()); assert.equal(active(t), 0);
});

await check('lost successful transaction response recovers its receipt without repeat removal or identity loss', async t => {
  const lost = { ...t.db, async batch(statements) { await t.db.batch(statements); throw Error('Isolated lost response'); } };
  await saved(t.remove({ DB: lost })); assert.equal(active(t), 0); assert.equal(t.all('account_audit_logs').length, 1);
  await saved(t.remove()); assert.equal(t.all('account_audit_logs').length, 1);
});

await check('retained inactive records cannot be silently restored by a new or old invitation', async t => {
  await saved(t.remove());
  t.insert('business_trials', { business_id: 'a', owner_user_id: 'owner', status: 'active', trial_started_at: now, trial_ends_at: now, created_at: now, updated_at: now });
  t.insert('business_invites', { id: 'new-invite', business_id: 'a', email: 'employee@example.invalid', email_normalized: 'employee@example.invalid',
    invite_code: 'AFTER-REMOVAL', role: 'manager', permission_template: 'general_manager', created_at: now, expires_at: now + 3600 });
  // A freshly signed-in identity still cannot bypass explicit membership restoration.
  t.sqlite.exec("UPDATE sessions SET revoked_at=NULL WHERE id='employee-session'; UPDATE devices SET revoked_at=NULL WHERE id='employee-device'");
  const before = t.retained();
  const result = await t.load('src/lib/server/businessInvitations.ts').acceptExistingAccountInvitation({
    locals: { DB: t.db, userId: 'employee', sessionId: 'employee-session' },
    request: formRequest({ invite_code: 'AFTER-REMOVAL' }, '/register'), url: new URL('https://criminiops.com/register'), cookies: { set() { assert.fail('must not select a restaurant'); } }
  }, new URLSearchParams({ invite_code: 'AFTER-REMOVAL' }));
  assert.equal(result.status, 409); assert.equal(active(t), 0); assert.equal(t.retained(), before);
});

console.log(`Employee removal behavior: ${passed} actual-schema cases passed.`);
