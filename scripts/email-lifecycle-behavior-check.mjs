import assert from 'node:assert/strict';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

const test = createTestD1(); const { sqlite, db } = test;
const now = Math.floor(Date.now() / 1000);
const load = loadServerModules({ '#lib/server/observability.ts': { logOperationalEvent() {}, logOperationalError() {} } });
const events = load('src/lib/server/operationalEvents.ts');
const sent = []; const originalFetch = globalThis.fetch; const originalError = console.error;
const env = { DB: db, RESEND_API_KEY: 'isolated-provider-fixture', RESEND_FROM_EMAIL: 'test@example.invalid', APP_BASE_URL: 'https://criminiops.com' };
globalThis.fetch = async (url, options) => { assert.equal(url, 'https://api.resend.com/emails'); sent.push(JSON.parse(options.body)); return Response.json({ id: 'fixture-' + sent.length }); };
console.error = () => {};
function insert(table, row) {
  const keys = Object.keys(row);
  sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
}
const clear = () => { sqlite.exec('DELETE FROM operational_events'); sent.length = 0; };
async function event(type = 'onboarding.package.submitted', extra = {}) {
  return events.recordOperationalEvent(db, { businessId: 'a', eventType: type, category: 'onboarding', targetUserId: 'employee', actorUserId: 'employee', now, ...extra });
}
try {
  for (const id of ['a', 'b']) insert('businesses', { id, name: id, slug: id, created_at: now, updated_at: now });
  for (const [id, business, role, template] of [['owner', 'a', 'owner', 'owner'], ['employee', 'a', 'staff', 'staff'], ['position-user', 'a', 'manager', 'general_manager'], ['other-owner', 'b', 'owner', 'owner']]) {
    insert('users', { id, email: `${id}@example.invalid`, email_normalized: `${id}@example.invalid`, display_name: id, created_at: now, updated_at: now });
    insert('business_users', { business_id: business, user_id: id, role, permission_template: template, created_at: now, updated_at: now });
    insert('user_preferences', { user_id: id, email_updates: 1, email_updates_consented_at: now, updated_at: now });
  }
  insert('business_positions', { id: 'reviewer-position', business_id: 'a', name: 'Review access', account_type: 'external', base_template: 'external', created_at: now, updated_at: now });
  sqlite.exec("UPDATE business_users SET position_id='reviewer-position' WHERE user_id='position-user'");
  await event(); await events.processOperationalEvents(db, { env, now });
  assert.deepEqual(sent.map(mail => mail.to), ['owner@example.invalid'], 'A default manager role cannot override a restricted custom position');
  clear();
  insert('business_position_permissions', { business_id: 'a', position_id: 'reviewer-position', permission_key: 'review_onboarding', is_enabled: 1, updated_at: now });
  await event(); await events.processOperationalEvents(db, { env, now });
  assert.deepEqual(sent.map(mail => mail.to).sort(), ['owner@example.invalid', 'position-user@example.invalid']);
  clear();
  insert('employee_role_permissions', { business_id: 'a', user_id: 'position-user', permission_key: 'review_onboarding', is_enabled: 0, updated_at: now });
  await event(); await events.processOperationalEvents(db, { env, now });
  assert.deepEqual(sent.map(mail => mail.to), ['owner@example.invalid'], 'Individual revocation overrides the custom position grant');
  clear();
  await event('onboarding.package.approved', { expiresAt: now - 1 });
  assert.equal((await events.processOperationalEvents(db, { env, now })).skipped, 1); assert.equal(sent.length, 0);
  assert.equal(await events.cleanupOperationalEvents(db, 'a', 250, now), 1);
  clear();
  const dedupe = { dedupeKey: 'same-packet-event' };
  assert.equal(await event('onboarding.package.approved', dedupe), await event('onboarding.package.approved', dedupe));
  const parallel = await Promise.all([events.processOperationalEvents(db, { env, now }), events.processOperationalEvents(db, { env, now })]);
  assert.equal(parallel.reduce((sum, result) => sum + result.delivered, 0), 1); assert.equal(sent.length, 1);
  clear();
  sqlite.exec("UPDATE user_preferences SET email_updates=0, email_updates_consented_at=NULL WHERE user_id='employee'");
  await event('onboarding.package.approved'); await events.processOperationalEvents(db, { env, now });
  assert.deepEqual(sent.map(mail => mail.to), ['employee@example.invalid'], 'An essential packet message is separate from optional operation-update consent');
  clear();
  await event('schedule.time_off.approved'); await events.processOperationalEvents(db, { env, now });
  assert.equal(sent.length, 0, 'Optional operational mail remains opted out');
  clear();
  const admin = load('src/lib/server/admin.ts');
  const result = await admin.sendEmployeeOnboardingPackage(formRequest({ user_id: 'employee' }), {
    DB: db, env, userId: 'owner', userRole: 'admin', businessId: 'a', businessName: 'a', businessRole: 'owner', businessPermissionTemplate: 'owner'
  }, 'https://criminiops.com', env);
  assert.equal(result.success, true); assert.equal(sent.length, 1);
  assert.equal((await events.processOperationalEvents(db, { env, now: Math.floor(Date.now() / 1000) + 1 })).skipped, 1);
  assert.equal(sent.length, 1, 'A successful direct packet email cannot also be sent by the queue');
  assert.ok(sent[0].html.includes('/onboarding'));
  clear();
  sqlite.exec("UPDATE employee_onboarding_packages SET status='approved' WHERE business_id='a' AND user_id='employee'");
  globalThis.fetch = async () => Response.json({ message: 'Temporary provider outage' }, { status: 503 });
  const fallback = await admin.sendEmployeeOnboardingPackage(formRequest({ user_id: 'employee' }), {
    DB: db, env, userId: 'owner', userRole: 'admin', businessId: 'a', businessName: 'a', businessRole: 'owner', businessPermissionTemplate: 'owner'
  }, 'https://criminiops.com', env);
  assert.equal(fallback.success, true);
  assert.equal(JSON.parse(sqlite.prepare('SELECT payload_json FROM operational_events').get().payload_json).emailSentDirectly, false);
  globalThis.fetch = async (url, options) => { assert.equal(url, 'https://api.resend.com/emails'); sent.push(JSON.parse(options.body)); return Response.json({ id: 'recovered-receipt' }); };
  assert.equal((await events.processOperationalEvents(db, { env, now: Math.floor(Date.now() / 1000) + 1 })).delivered, 1);
  assert.equal(sent.length, 1, 'Failed direct email remains eligible for the existing queue after provider recovery');
  clear();
  let dispatches = 0; const pending = [];
  const hooks = loadServerModules({ 'cloudflare:workers': { env: { DB: db }, waitUntil(promise) { pending.push(promise); } },
    '#lib/server/observability.ts': { logOperationalEvent() {}, logOperationalError() {} },
    '#lib/server/platformDiagnostics.ts': { async recordRequestDiagnostic() {} },
    '#lib/server/operationalEvents.ts': { async processOperationalEvents() { dispatches++; } }
  })('src/hooks.server.ts');
  for (const status of [200, 303, 400, 429, 500]) {
    const url = new URL('https://criminiops.com/register');
    await hooks.handle({ event: { url, request: formRequest({}, '/register'), locals: {}, cookies: { get() {} } },
      resolve: async () => new Response(null, { status }) });
    assert.equal(dispatches, status < 400 ? [200, 303].indexOf(status) + 1 : 2, 'Only successful registration kicks background delivery');
  }
  await Promise.all(pending);
  const id = await event('onboarding.package.approved');
  sqlite.exec("CREATE TRIGGER test_delivery_failure BEFORE UPDATE ON operational_events BEGIN SELECT RAISE(ABORT,'delivery rollback'); END");
  await assert.rejects(events.recordOperationalDeliveryAttempt(db, { eventId: id, businessId: 'a', channel: 'email', status: 'sent', now }), /delivery rollback/);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM operational_event_delivery_attempts').get().n, 0);
  sqlite.exec('DROP TRIGGER test_delivery_failure');
  await events.recordOperationalDeliveryAttempt(db, { eventId: id, businessId: 'b', channel: 'email', status: 'sent', now });
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM operational_event_delivery_attempts').get().n, 0, 'An event from a different business cannot acquire a delivery receipt');
  const failingDb = { ...db, prepare(sql) {
    const statement = db.prepare(sql);
    if (sql.includes('WHERE u.id = ?')) statement.first = async () => { throw Error('Fixture recipient lookup unavailable'); };
    return statement;
  } };
  assert.equal((await events.processOperationalEvents(failingDb, { env, now, maxAttempts: 1 })).failed, 1);
  const failed = sqlite.prepare('SELECT delivery_status, next_attempt_at FROM operational_events WHERE id=?').get(id);
  assert.equal(failed.delivery_status, 'failed'); assert.equal(failed.next_attempt_at, null);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  const email = load('src/lib/server/email.ts');
  const escaped = email.renderCriminiEmail({ title: '<script>title</script>', body: '<img src=x onerror="bad">',
    eyebrow: '<b>Purpose</b>', details: [{ label: '<b>Label</b>', value: 'Value <script>bad</script>' }],
    note: '<b>Note</b>', footer: '<b>Footer</b>', actionLabel: '<b>Open</b>',
    actionUrl: 'https://criminiops.com/register?invite=fixture&value="quoted"' });
  assert.ok(!escaped.includes('<script>') && !escaped.includes('<b>') && !escaped.includes('<img src=x'));
  assert.ok(escaped.includes('&lt;script&gt;title&lt;/script&gt;'));
  assert.ok(escaped.includes('invite=fixture&amp;value=&quot;quoted&quot;'));
  sent.length = 0;
  await email.sendInviteEmail({ env, origin: env.APP_BASE_URL, inviteeEmail: 'employee@example.invalid', inviteCode: 'fixture', expiresAt: now + 3600, businessName: '<Restaurant>' });
  await email.sendSignupConfirmationEmail({ env, origin: env.APP_BASE_URL, ownerEmail: 'owner@example.invalid', ownerName: '<Owner>', ownerTitle: 'Owner', businessName: '<Restaurant>', planTier: 'medium' });
  await email.sendEmployeeOnboardingPackageEmail({ env, origin: env.APP_BASE_URL, employeeEmail: 'employee@example.invalid', employeeName: 'Employee', businessName: 'Restaurant', packageId: 'fixture-packet' });
  await email.sendPasswordResetEmail({ env, origin: env.APP_BASE_URL, userEmail: 'employee@example.invalid', resetToken: 'fixture-reset' });
  await email.sendAccountDeletionRequestEmail({ env, origin: env.APP_BASE_URL, userEmail: 'employee@example.invalid', requestScope: 'user', requestId: 'fixture-deletion' });
  assert.equal(sent.length, 5);
  for (const mail of sent) {
    assert.ok(mail.html.startsWith('<!doctype html>') && mail.html.includes('<html lang="en">'));
    assert.ok(mail.html.includes('name="viewport"') && mail.html.includes('role="presentation"'));
    assert.ok(mail.html.includes('src="https://criminiops.com/crimini-full-logo.jpg"'));
    assert.ok(mail.html.indexOf('<img ') < mail.html.indexOf('<h1 ') && mail.html.indexOf('<h1 ') < mail.html.indexOf('>Support</a>'));
    assert.ok(mail.html.includes('background-color:#ffffff') && mail.html.includes('border-bottom:1px solid #8f826e'));
    assert.ok(mail.html.includes('https://criminiops.com/privacy') && mail.html.includes('Crimini by NNS, LLC'));
    assert.ok(!/border-radius|Georgia|display:grid|<script|<link\b/.test(mail.html));
    assert.ok(!mail.html.includes('<Restaurant>') && !mail.html.includes('<Owner>'));
    assert.ok(mail.text.length > 50 && !mail.text.includes('<table'));
    assert.ok(Buffer.byteLength(mail.html) < 20000);
  }
  assert.ok(sent[0].html.includes('/register?invite=fixture') && sent[0].html.includes('Expires '));
  assert.ok(sent[1].html.includes('Account owner:') && sent[1].html.includes('Medium - $49/mo') && sent[1].html.includes('&lt;Owner&gt;'));
  assert.ok(sent[2].html.includes('/onboarding') && sent[3].html.includes('/reset-password/fixture-reset'));
  console.log('PASS actual email lifecycle: position/individual permissions, essential-vs-optional mail, expiry/cleanup, concurrent claims, stable deduplication and no duplicate packet email');
  console.log('PASS delivery receipt/status rollback, cross-tenant receipt rejection and capped exception retries; provider requests intercepted, no real messages');
  console.log('PASS shared app-styled email header/message/footer across invites, signup, packets, resets and deletion; escaped details/links, plain text, email-safe tables, no rounded marketing cards');
} finally { globalThis.fetch = originalFetch; console.error = originalError; test.close(); }
