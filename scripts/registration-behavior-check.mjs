import assert from 'node:assert/strict';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

const now = Math.floor(Date.now() / 1000);
const email = 'new-account@example.invalid';
const password = 'Isolated-registration-password7!';
function fixture({ owner = false, packet = true, inviteOverrides = {}, afterHash } = {}) {
  const test = createTestD1(), { sqlite, db } = test;
  const insert = (table, row) => {
    const keys = Object.keys(row);
    sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
  };
  for (const id of ['a', 'b']) {
    insert('users', { id: 'owner-' + id, email: 'owner-' + id + '@example.invalid', email_normalized: 'owner-' + id + '@example.invalid', created_at: now, updated_at: now });
    insert('businesses', { id, name: 'Restaurant ' + id, slug: id, status: 'active', created_at: now, updated_at: now });
    insert('business_users', { business_id: id, user_id: 'owner-' + id, role: 'owner', permission_template: 'owner', created_at: now, updated_at: now });
    insert('business_trials', { business_id: id, owner_user_id: 'owner-' + id, status: 'active', trial_started_at: now, trial_ends_at: now, created_at: now, updated_at: now });
    insert('schedule_departments', { id: 'department-' + id, business_id: id, name: 'Kitchen', created_at: now, updated_at: now });
  }
  insert('business_invites', { id: 'invite', business_id: 'a', email, email_normalized: email, invite_code: 'ISOLATED-REGISTRATION',
    role: 'staff', permission_template: 'staff', employment_type: 'employee', onboarding_required: packet ? 1 : 0,
    department: 'Kitchen', primary_schedule_department: 'Kitchen', schedule_departments_json: '["Kitchen"]',
    created_at: now, expires_at: now + 3600, ...inviteOverrides });
  const sent = [], events = [], objects = new Set();
  const auth = loadServerModules()('src/lib/server/auth.ts');
  const load = loadServerModules({
    '#lib/server/auth.ts': { ...auth, async hashPassword(...args) { const result = await auth.hashPassword(...args); await afterHash?.({ sqlite, db }); return result; } },
    '#lib/server/observability.ts': { logOperationalEvent() {}, logOperationalError() {} },
    '#lib/server/email.ts': { isEmailConfigured: () => true, async sendSignupConfirmationEmail(args) { sent.push(args); return { sent: true }; } },
    '#lib/server/operationalEvents.ts': { async recordOperationalEventBestEffort(...args) { events.push(args); } }
  });
  const env = { DB: db, APP_BASE_URL: 'https://criminiops.com', PUBLIC_SIGNUP_ENABLED: 'false', OWNER_SIGNUP_ALLOWLIST: email,
    PASSWORD_PEPPER: 'isolated-registration-pepper-only-value', SENSITIVE_DATA_KEY: 'isolated-registration-sensitive-encryption-key', SENSITIVE_DATA_KEY_VERSION: 'fixture' };
  const cookies = new Map([['unrelated', 'retained']]);
  const fields = { email, confirm_email: email, password, confirm_password: password, display_name: 'Example Person',
    real_name: 'Example Legal Name', birthday: '1990-03-04', user_phone: '2025550101', user_address_line_1: '1 Example Street',
    user_city: 'Example', user_state: 'CO', user_postal_code: '80000', email_updates: '0', sms_updates: '0',
    ...(owner ? { business_name: 'New Restaurant', owner_title: 'Owner', legal_name: 'Example Restaurant LLC', contact_email: 'restaurant@example.invalid',
      address_line_1: '2 Business Street', address_city: 'Example', address_state: 'CO', address_country: 'US', address_postal_code: '80000',
      plan_tier: 'medium', purchase_mode: 'buy_now', liability_agreement_accepted: '1', store_billing_preference: 'google_play',
      schedule_setup: JSON.stringify([{ name: 'Dining', roles: ['Server'] }]) } : { invite_code: 'ISOLATED-REGISTRATION' }) };
  const bucket = { async put(key) { objects.add(key); }, async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key); } };
  function event(values = fields, uploads = false) {
    const path = owner ? '/register' : '/register?invite=ISOLATED-REGISTRATION';
    let request = formRequest(values, path);
    if (uploads) {
      const form = new FormData(); for (const [key, value] of Object.entries(values)) form.set(key, value);
      form.set('business_documents', new File(['%PDF-1.7 fixture document'], 'handbook.pdf', { type: 'application/pdf' }));
      form.set('business_menu', new File(['%PDF-1.7 fixture menu'], 'menu.pdf', { type: 'application/pdf' }));
      form.set('business_logo', new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])], 'logo.png', { type: 'image/png' }));
      request = new Request('https://criminiops.com' + path, { method: 'POST', body: form });
    }
    return { locals: { DB: db, env, MEDIA_BUCKET: bucket }, request, url: new URL('https://criminiops.com' + path),
      cookies: { get: key => cookies.get(key), set: (key, value) => cookies.set(key, value), delete: key => cookies.delete(key) } };
  }
  const register = load('src/routes/register/+page.server.ts');
  const act = (values, uploads) => register.actions.default(event(values, uploads));
  function unchanged() {
    assert.equal(sqlite.prepare('SELECT id FROM users WHERE email_normalized=?').get(email), undefined);
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM businesses').get().n, 2);
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM business_users').get().n, 2);
    for (const table of ['user_preferences', 'employee_profiles', 'employee_employment_records', 'employee_onboarding_packages',
      'employee_sensitive_record_vault', 'employee_compliance_documents', 'devices', 'sessions', 'communication_consent_events',
      'legal_agreements', 'store_billing_placeholders', 'business_positions', 'documents', 'creator_category_registry']) {
      assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 0, table);
    }
    assert.equal(sqlite.prepare("SELECT used_at FROM business_invites WHERE id='invite'").get().used_at, null);
    assert.deepEqual([...cookies], [['unrelated', 'retained']]); assert.equal(sent.length, 0); assert.equal(events.length, 0); assert.equal(objects.size, 0);
  }
  return { ...test, get queryCount() { return test.queryCount; }, insert, load, env, cookies, fields, act, event, register, auth, sent, events, objects, bucket, unchanged };
}
const failures = [];
async function check(label, run, options) {
  const test = fixture(options);
  try { await run(test); assert.deepEqual(test.sqlite.prepare('PRAGMA foreign_key_check').all(), []); console.log('PASS ' + label); }
  catch (error) { failures.push(label); console.error('FAIL ' + label + ': ' + error.message); }
  finally { test.close(); }
}

await check('late invited packet failure leaves no account or consumed invitation, and the same email can retry', async t => {
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON employee_sensitive_record_vault BEGIN SELECT RAISE(ABORT,'isolated late packet failure'); END");
  const result = await t.act(); t.unchanged(); assert.equal(result.status, 503);
  t.sqlite.exec('DROP TRIGGER fixture_failure');
  await assert.rejects(t.act(), { location: '/register/welcome?onboarding=1' });
});
await check('late session failure cannot strand an invited account, packet or cookies', async t => {
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON sessions BEGIN SELECT RAISE(ABORT,'isolated session failure'); END");
  const result = await t.act(); t.unchanged(); assert.equal(result.status, 503);
});
await check('purchaser billing failure rolls back restaurant, profile, legal acceptance, session and uploaded files', async t => {
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON store_billing_placeholders BEGIN SELECT RAISE(ABORT,'isolated billing setup failure'); END");
  const result = await t.act(undefined, true); t.unchanged(); assert.equal(result.status, 503);
}, { owner: true });
await check('an invite revoked during hashing cannot create an account or membership', async t => {
  assert.equal((await t.act()).status, 409); t.unchanged();
}, { afterHash: ({ sqlite }) => sqlite.exec("UPDATE business_invites SET revoked_at=1 WHERE id='invite'") });
await check('a restaurant losing paid access during hashing cannot accept a new account', async t => {
  assert.equal((await t.act()).status, 409); t.unchanged();
}, { afterHash: ({ sqlite }) => sqlite.exec("UPDATE business_trials SET status='expired' WHERE business_id='a'") });
await check('a verified store plan revoked during hashing cannot create an invited account against cached active billing', async t => {
  t.insert('business_store_entitlements',{id:'verified-plan',business_id:'a',owner_user_id:'owner-a',store:'google_play',
    product_id:'isolated.plan',entitlement_key:'plan.fixture',plan_tier:'growth',status:'active',verified_at:now-10,
    expires_at:now+3600,created_at:now,updated_at:now});
  assert.equal((await t.act()).status,409);t.unchanged();
}, {afterHash:({sqlite})=>sqlite.exec("UPDATE business_store_entitlements SET status='refunded' WHERE id='verified-plan'")});
await check('missing HR encryption fails before committing an invited employee account', async t => {
  delete t.env.SENSITIVE_DATA_KEY;
  assert.equal((await t.act()).status, 503); t.unchanged();
});
await check('unscoped legacy invitations are rejected without guessing an inviter restaurant', async t => {
  t.sqlite.exec("DELETE FROM business_invites WHERE id='invite'");
  t.insert('user_invites', { id: 'legacy', email, email_normalized: email, invite_code: 'ISOLATED-REGISTRATION', invited_by: 'owner-a', created_at: now, expires_at: now + 3600 });
  const result = await t.act(); assert.equal(result.status, 400); assert.match(result.data.error, /fresh|new|invalid/i);
  assert.equal(t.sqlite.prepare('SELECT id FROM users WHERE email_normalized=?').get(email), undefined);
  assert.equal(t.sqlite.prepare("SELECT used_at FROM user_invites WHERE id='legacy'").get().used_at, null);
  const state = await t.register.load({ locals: t.event().locals, url: t.event().url }); assert.equal(state.inviteEmail, null);
});
await check('new invited identity has its own credentials, tenant profile, encrypted completed information and one session', async t => {
  await assert.rejects(t.act(), { location: '/register/welcome?onboarding=1' });
  const user = t.sqlite.prepare('SELECT * FROM users WHERE email_normalized=?').get(email);
  assert.equal((await t.auth.verifyPassword(password, user.password_hash, t.env)).valid, true);
  assert.equal((await t.auth.verifyPassword(password + 'wrong', user.password_hash, t.env)).valid, false);
  assert.equal(t.sqlite.prepare('SELECT role FROM business_users WHERE user_id=?').get(user.id).role, 'staff');
  const profile = t.sqlite.prepare('SELECT * FROM employee_profiles WHERE user_id=?').get(user.id);
  assert.equal(profile.business_id, 'a'); assert.equal(profile.real_name, t.fields.real_name); assert.equal(profile.phone, t.fields.user_phone);
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM business_users WHERE business_id='b' AND user_id=?").get(user.id).n, 0);
  const onboarding = await t.load('src/lib/server/admin.ts').loadEmployeeOnboarding(t.db, user.id, 'a', { env: t.env, actorUserId: user.id });
  const personal = onboarding.items.find(item => item.form_key === 'personal_information');
  assert.equal(personal.status, 'submitted'); assert.equal(JSON.parse(personal.form_payload).legal_name, t.fields.real_name);
  assert.equal(onboarding.items.find(item => item.form_key === 'emergency_contact').status, 'pending');
  assert.equal(JSON.stringify(t.sqlite.prepare('SELECT form_payload FROM employee_onboarding_items').all()).includes(t.fields.real_name), false);
  const vault = t.sqlite.prepare("SELECT encrypted_payload FROM employee_sensitive_record_vault WHERE record_scope='personal' AND record_type='profile'").get();
  assert.ok(vault.encrypted_payload); assert.equal(vault.encrypted_payload.includes(t.fields.real_name), false);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id=?').get(user.id).n, 1);
  assert.equal(t.events.length, 1); assert.equal(t.sent.length, 0);
  const count = t.sqlite.prepare('SELECT COUNT(*) n FROM users').get().n;
  assert.equal((await t.act()).status, 400); assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM users').get().n, count);
});
await check('purchaser data, uploads, legal terms and billing agree without granting unpaid app access', async t => {
  await assert.rejects(t.act(undefined, true), { location: '/billing?purchase=pending' });
  const user = t.sqlite.prepare('SELECT * FROM users WHERE email_normalized=?').get(email);
  const business = t.sqlite.prepare("SELECT * FROM businesses WHERE id NOT IN ('a','b')").get();
  assert.equal(business.name, t.fields.business_name); assert.equal(business.contact_email, t.fields.contact_email);
  assert.equal(business.address_line_1, t.fields.address_line_1); assert.equal(business.plan_tier, 'growth'); assert.equal(business.status, 'pending_payment');
  const profile = t.sqlite.prepare('SELECT * FROM employee_profiles WHERE user_id=?').get(user.id);
  assert.equal(profile.business_id, business.id); assert.equal(profile.address_line_1, t.fields.user_address_line_1);
  assert.equal(t.sqlite.prepare('SELECT job_title FROM employee_employment_records WHERE user_id=?').get(user.id).job_title, 'Owner');
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM business_positions WHERE business_id=?').get(business.id).n, 3);
  assert.equal(t.sqlite.prepare('SELECT department FROM user_schedule_departments WHERE user_id=?').get(user.id).department, 'Dining');
  assert.equal(t.sqlite.prepare('SELECT role_name FROM schedule_role_definitions WHERE business_id=?').get(business.id).role_name, 'Server');
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM documents WHERE business_id=?').get(business.id).n, 2); assert.equal(t.objects.size, 3);
  assert.equal(t.sqlite.prepare('SELECT preferred_store FROM store_billing_placeholders WHERE business_id=?').get(business.id).preferred_store, 'google_play');
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM legal_agreements WHERE business_id=? AND user_id=?').get(business.id, user.id).n, 1);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM communication_consent_events WHERE business_id=? AND user_id=?').get(business.id, user.id).n, 2);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_onboarding_packages WHERE user_id=?').get(user.id).n, 0);
  assert.equal((await t.load('src/lib/server/trial.ts').getBusinessTrialAccess(t.db, business.id)).allowApp, false);
  assert.equal(t.sent.length, 1); assert.equal(t.sent[0].businessName, business.name); assert.equal(t.sent[0].ownerEmail, email);
}, { owner: true });
await check('a lost successful transaction response is recovered without deleting committed purchaser files', async t => {
  const batch = t.db.batch; let lost = false;
  t.db.batch = async statements => { const result = await batch(statements); if (!lost && statements.length > 10) { lost = true; throw Error('isolated lost commit response'); } return result; };
  await assert.rejects(t.act(undefined, true), { location: '/billing?purchase=pending' });
  assert.equal(lost, true); assert.equal(t.objects.size, 3); assert.equal(t.sent.length, 1);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n, 1);
}, { owner: true });
await check('email delivery failure after commit cannot undo registration or report account creation as failed', async t => {
  t.load('src/lib/server/email.ts').sendSignupConfirmationEmail = async () => { throw Error('isolated provider outage'); };
  await assert.rejects(t.act(), { location: '/billing?purchase=pending' });
  assert.ok(t.sqlite.prepare('SELECT id FROM users WHERE email_normalized=?').get(email)); assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n, 1);
}, { owner: true });
await check('personal-information encryption audit failure rolls the entire registration back', async t => {
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON employee_sensitive_record_audit BEGIN SELECT RAISE(ABORT,'isolated encrypted audit failure'); END");
  assert.equal((await t.act()).status, 503); t.unchanged();
});
await check('an invitation changing role or department during hashing cannot apply its old snapshot', async t => {
  assert.equal((await t.act()).status, 409); t.unchanged();
}, { afterHash: ({ sqlite }) => sqlite.exec("UPDATE business_invites SET role='owner',permission_template='owner',department='Changed' WHERE id='invite'") });
await check('an invitation expiring during hashing cannot create any account', async t => {
  assert.equal((await t.act()).status, 409); t.unchanged();
}, { afterHash: ({ sqlite }) => sqlite.exec("UPDATE business_invites SET expires_at=1 WHERE id='invite'") });
await check('invalid passwords, email, dates and missing consent retain safe fields without any registration writes', async t => {
  for (const values of [
    { password: 'short', confirm_password: 'short' }, { email: 'invalid', confirm_email: 'invalid' },
    { birthday: '1990-02-31' }, { email_updates: '' }
  ]) {
    const result = await t.act({ ...t.fields, ...values }); assert.equal(result.status, 400);
    assert.equal(result.data.values.realName, t.fields.real_name); assert.equal(result.data.activeSlideId, 'security');
    assert.equal('password' in result.data.values, false); t.unchanged();
  }
});
await check('closed signup and disabled trial cannot create a purchaser tenant', async t => {
  t.env.OWNER_SIGNUP_ALLOWLIST = '';
  assert.equal((await t.act()).status, 403); t.unchanged();
  assert.equal((await t.act({ ...t.fields, purchase_mode: 'trial' })).status, 403); t.unchanged();
}, { owner: true });
await check('an upload stored before its failure response is still tracked and safely cleaned', async t => {
  const put = t.bucket.put; let count = 0;
  t.bucket.put = async key => { await put(key); if (++count === 2) throw Error('isolated lost R2 upload response'); };
  assert.equal((await t.act(undefined, true)).status, 503); t.unchanged();
}, { owner: true });
await check('the maximum department/role setup stays tenant-scoped and uses a bounded query count', async t => {
  const departments = Array.from({ length: 24 }, (_, i) => ({ name: 'Department ' + i,
    roles: Array.from({ length: 40 }, (_, j) => 'Role ' + j) }));
  const before = t.queryCount;
  await assert.rejects(t.act({ ...t.fields, schedule_setup: JSON.stringify(departments) }), { location: '/billing?purchase=pending' });
  assert.ok(t.queryCount - before <= 45, 'bulk schedule setup must not add a query per role');
  const business = t.sqlite.prepare("SELECT id FROM businesses WHERE id NOT IN ('a','b')").get().id;
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM schedule_departments WHERE business_id=?').get(business).n, 24);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM schedule_role_definitions WHERE business_id=?').get(business).n, 960);
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM schedule_role_definitions WHERE business_id IN ('a','b')").get().n, 0);
}, { owner: true });
await check('foreign or inactive invited positions cannot create a membership', async t => {
  t.insert('business_positions', { id: 'foreign-position', business_id: 'b', name: 'Team', account_type: 'staff', base_template: 'staff', created_at: now, updated_at: now });
  t.insert('business_positions', { id: 'inactive-position', business_id: 'a', name: 'Inactive', account_type: 'staff', base_template: 'staff', is_active: 0, created_at: now, updated_at: now });
  for (const position of ['foreign-position', 'inactive-position']) {
    t.sqlite.prepare("UPDATE business_invites SET position_id=? WHERE id='invite'").run(position);
    assert.equal((await t.act()).status, 409);
    assert.equal(t.sqlite.prepare('SELECT id FROM users WHERE email_normalized=?').get(email), undefined);
    assert.equal(t.sqlite.prepare("SELECT used_at FROM business_invites WHERE id='invite'").get().used_at, null);
  }
});
for (const [label, inviteOverrides, expected] of [
  ['owner optional packet', { role: 'owner', permission_template: 'owner', onboarding_required: 0 }, 0],
  ['owner selected packet', { role: 'owner', permission_template: 'owner', onboarding_required: 1 }, 1],
  ['contractor exemption', { role: 'external', permission_template: 'external', employment_type: 'contractor', onboarding_required: 1 }, 0],
  ['manager packet', { role: 'manager', permission_template: 'general_manager', onboarding_required: 1 }, 1]
]) {
  await check(label + ' preserves the invitation-defined account role and packet decision', async t => {
    await assert.rejects(t.act(), { location: '/register/welcome?onboarding=' + expected });
    assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_onboarding_packages').get().n, expected);
    assert.equal(t.sqlite.prepare("SELECT role FROM business_users WHERE user_id NOT IN ('owner-a','owner-b')").get().role, inviteOverrides.role);
  }, { inviteOverrides });
}
if (failures.length) { console.error(failures.length + ' registration checks failed'); process.exitCode = 1; }
