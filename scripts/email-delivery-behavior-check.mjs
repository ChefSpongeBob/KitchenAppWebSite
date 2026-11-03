import assert from 'node:assert/strict';
import { createTestD1, loadServerModules } from './helpers/test-d1.mjs';

const test = createTestD1();
const { sqlite, db } = test;
const now = Math.floor(Date.now() / 1000);
const load = loadServerModules({ '#lib/server/observability.ts': { logOperationalEvent() {}, logOperationalError() {} } });
const email = load('src/lib/server/email.ts');
const events = load('src/lib/server/operationalEvents.ts');
const env = { RESEND_API_KEY: 'test-only-provider-key', RESEND_FROM_EMAIL: 'Crimini <test@example.invalid>', APP_BASE_URL: 'https://criminiops.com' };
const sent = [];
const originalFetch = globalThis.fetch;
let responseMode = 'accepted';
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(options.method, 'POST');
  assert.equal(options.redirect, 'manual');
  assert.ok(options.signal instanceof AbortSignal);
  const headers = new Headers(options.headers);
  assert.equal(headers.get('authorization'), 'Bearer test-only-provider-key');
  sent.push({ body: JSON.parse(options.body), idempotencyKey: headers.get('idempotency-key') });
  if (responseMode === 'network-error') throw new Error('Simulated network error');
  if (responseMode.startsWith('redirect-')) return new Response(null, {
    status: Number(responseMode.slice('redirect-'.length)), headers: { location: 'https://untrusted.example.invalid' }
  });
  return Response.json(responseMode === 'missing-id' ? {} : { id: `test-provider-id-${sent.length}` });
};
function insert(table, row) {
  const columns = Object.keys(row);
  sqlite.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?')})`).run(...Object.values(row));
}
try {
  for (const businessId of ['a','b']) insert('businesses', { id: businessId, name: businessId, slug: businessId, created_at: now, updated_at: now });
  for (const [id, businessId, role, template, opted, department] of [
    ['owner-a','a','owner','owner',1,'Kitchen'], ['manager-kitchen','a','admin','boh_manager',1,'Kitchen'],
    ['manager-service','a','admin','foh_manager',1,'Service'], ['no-consent','a','owner','owner',0,'Kitchen'],
    ['employee-a','a','staff','staff',1,'Kitchen'], ['other-tenant','b','owner','owner',1,'Kitchen']
  ]) {
    insert('users', { id, email: `${id}@example.invalid`, email_normalized: `${id}@example.invalid`, display_name: '<Same Name>', created_at: now, updated_at: now });
    insert('business_users', { business_id: businessId, user_id: id, role, permission_template: template, created_at: now, updated_at: now });
    insert('user_preferences', { user_id: id, email_updates: opted, email_updates_consented_at: opted ? now : null, updated_at: now });
    insert('user_schedule_departments', { business_id: businessId, user_id: id, department, updated_at: now });
  }
  async function process(type, extra = {}) {
    sent.length = 0;
    await events.recordOperationalEventBestEffort(db, { businessId: 'a', eventType: type, category: type.split('.')[0],
      title: '<Test update>', targetUserId: 'employee-a', now, ...extra });
    return events.processOperationalEvents(db, { env, now });
  }
  assert.equal((await process('onboarding.package.submitted')).delivered, 1);
  assert.deepEqual(sent.map(row => row.body.to).sort(), ['manager-kitchen@example.invalid','owner-a@example.invalid']);
  assert.ok(sent.every(row => !row.body.html.includes('<Test update>') && row.idempotencyKey));
  assert.equal((await process('temperature.high')).skipped, 1);
  assert.equal(sent.length, 0);
  assert.equal((await process('schedule.published')).delivered, 1);
  assert.deepEqual(sent.map(row => row.body.to).sort(), ['employee-a@example.invalid','manager-kitchen@example.invalid','manager-service@example.invalid','owner-a@example.invalid']);
  assert.equal(sent.some(row => row.body.to.includes('other-tenant')), false);
  assert.equal((await process('onboarding.package.approved')).delivered, 1);
  assert.deepEqual(sent.map(row => row.body.to), ['employee-a@example.invalid']);
  sent.length = 0;
  const invite = await email.sendInviteEmail({ env, origin: 'https://ignored.invalid', inviteeEmail: 'employee-a@example.invalid',
    inviteCode: 'TEST-INVITE', expiresAt: now + 3600, businessName: '<Restaurant>', onboardingRequired: true });
  assert.equal(invite.sent, true);
  assert.ok(sent[0].body.html.includes('https://criminiops.com/register?invite=TEST-INVITE'));
  assert.equal(sent[0].body.html.includes('<Restaurant>'), false);
  await email.sendPasswordResetEmail({ env, origin: 'https://ignored.invalid', userEmail: 'employee-a@example.invalid', resetToken: 'test-reset-token' });
  assert.ok(sent[1].body.html.includes('https://criminiops.com/reset-password/test-reset-token'));
  responseMode = 'missing-id';
  assert.equal((await email.sendTransactionalEmail({ env, to: 'employee-a@example.invalid', subject: 'Test', html: '', text: '' })).sent, false);
  const originalError = console.error;
  console.error = () => {};
  try {
    for (const status of [301, 302, 303, 307, 308]) {
      responseMode = `redirect-${status}`;
      const before = sent.length;
      const result = await email.sendTransactionalEmail({ env, to: 'employee-a@example.invalid', subject: 'Test', html: '', text: '' });
      assert.equal(result.sent, false);
      assert.equal(result.reason, 'Email provider returned an unexpected redirect.');
      assert.equal(sent.length, before + 1, 'Provider redirects must never forward credentials');
    }
    responseMode = 'network-error';
    assert.equal((await process('onboarding.package.approved')).retrying, 1);
  } finally { console.error = originalError; }
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM operational_events WHERE delivery_status='pending'").get().n, 1);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  console.log('PASS real email/queue behavior: tenant/department/consent routing, approval target, escaped invite/reset links, idempotency, rejected redirects, missing receipt, retry, and no temperature email');
  console.log('Provider requests were intercepted; no real messages or production writes occurred.');
} finally { globalThis.fetch = originalFetch; test.close(); }
