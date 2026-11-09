import assert from 'node:assert/strict';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

const test = createTestD1();
const { sqlite } = test;
const now = Math.floor(Date.now() / 1000);
const emitted = [];
const load = loadServerModules({
  '#lib/server/observability.ts': { logOperationalEvent() {}, logOperationalError() {} },
  '#lib/server/operationalEvents.ts': { async recordOperationalEventBestEffort(_db, event) { emitted.push(event); return null; } }
});
const db = load('src/lib/server/schemaGuard.ts').wrapProductionSchemaGuard(test.db, false);
function insert(table, row) {
  const fields = Object.keys(row);
  sqlite.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...Object.values(row));
}
for (const id of ['a', 'b']) {
  insert('businesses', { id, name: `Test ${id}`, slug: `test-${id}`, plan_tier: 'large', created_at: now, updated_at: now });
  insert('users', { id: `owner-${id}`, email: `owner-${id}@example.invalid`, email_normalized: `owner-${id}@example.invalid`, display_name: 'Same owner name', created_at: now, updated_at: now });
  insert('business_users', { business_id: id, user_id: `owner-${id}`, role: 'owner', permission_template: 'owner', created_at: now, updated_at: now });
  insert('schedule_departments', { id: `dept-${id}`, name: 'Kitchen', business_id: id, created_at: now, updated_at: now });
  insert('schedule_role_definitions', { id: `role-${id}`, department: 'Kitchen', role_name: 'Cook', business_id: id, created_at: now, updated_at: now });
  insert('user_schedule_departments', { business_id: id, user_id: `owner-${id}`, department: 'Kitchen', updated_at: now });
}
const schedules = load('src/lib/server/schedules.ts');
const locals = { DB: db, userId: 'owner-a', businessId: 'a', businessRole: 'owner', businessPermissionTemplate: 'owner' };
const weekStart = '2026-10-26';
const shift = { id: 'test-shift-a', shiftDate: weekStart, userId: 'owner-a', department: 'Kitchen', role: 'Cook', startTime: '09:00', endLabel: '17:00', notes: '', breakMinutes: 30 };
const request = (rows, version, extra = {}) => formRequest({ week_start: weekStart, payload: JSON.stringify(rows), ...(version === undefined ? {} : { draft_version: version }), ...extra });
try {
  const saved = await schedules.saveScheduleWeekDraft(request([shift], 0), locals);
  assert.equal(saved.success, true, JSON.stringify(saved));
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_draft_shifts').get().n, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_shifts').get().n, 0);
  const freshLoad = loadServerModules();
  const reloaded = await freshLoad('src/lib/server/schedules.ts').loadScheduleWeek(db, weekStart, { businessId: 'a' });
  assert.ok(JSON.stringify(reloaded).includes('test-shift-a'));
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM schedule_weeks WHERE business_id='a'").get().n, 1);
  const rejected = await schedules.saveScheduleWeekDraft(request([shift], 0), locals);
  assert.equal(rejected.status, 409);
  const foreign = await schedules.saveScheduleWeekDraft(request([{ ...shift, userId: 'owner-b' }], saved.draftVersion), locals);
  assert.equal(foreign.status, 400);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM schedule_weeks WHERE business_id='b'").get().n, 0);
  const published = await schedules.publishScheduleWeek(request([shift], saved.draftVersion), locals);
  assert.equal(published.success, true, JSON.stringify(published));
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_shifts').get().n, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_publish_history').get().n, 1);
  const version = sqlite.prepare("SELECT draft_version FROM schedule_weeks WHERE business_id='a'").get().draft_version;
  assert.equal((await schedules.saveScheduleWeekDraft(request([{ ...shift, startTime: '10:00' }], version), locals)).success, true);
  assert.equal(sqlite.prepare('SELECT start_time FROM schedule_shifts').get().start_time, '09:00');
  assert.equal(sqlite.prepare('SELECT start_time FROM schedule_draft_shifts').get().start_time, '10:00');
  assert.equal((await schedules.publishScheduleWeek(formRequest({ week_start: weekStart, draft_version: version }), locals)).status, 409);
  const other = await schedules.loadScheduleWeek(db, weekStart, { businessId: 'b', publishedOnly: true });
  assert.equal(JSON.stringify(other).includes('test-shift-a'), false);
  const staffWrite = await schedules.saveScheduleWeekDraft(request([shift]), { ...locals, businessRole: 'staff', businessPermissionTemplate: 'staff' });
  assert.equal(staffWrite.status, 403);
  assert.equal(emitted.filter(e => e.eventType === 'schedule.published').length, 1);
  const direct = await schedules.publishScheduleWeek(request([{ ...shift, id: 'test-shift-b', userId: 'owner-b' }], 0),
    { ...locals, userId: 'owner-b', businessId: 'b' });
  assert.equal(direct.success, true, JSON.stringify(direct));
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM schedule_weeks WHERE business_id='b'").get().n, 1);
  sqlite.exec("CREATE TRIGGER test_publish_rollback BEFORE INSERT ON schedule_publish_history BEGIN SELECT RAISE(ABORT,'publish test rollback'); END;");
  await assert.rejects(schedules.publishScheduleWeek(formRequest({ week_start: weekStart }), locals), /publish test rollback/);
  sqlite.exec('DROP TRIGGER test_publish_rollback');
  assert.equal(sqlite.prepare("SELECT start_time FROM schedule_shifts WHERE business_id='a'").get().start_time, '09:00');
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM schedule_publish_history WHERE business_id='a'").get().n, 1);
  console.log('PASS actual autosave/publish SQL: reload persistence, optimistic conflicts, draft/live separation, no duplicate week, tenant/role rejection');

  const admin = load('src/lib/server/admin.ts');
  const adminLocals = { ...locals, userRole: 'admin' };
  const name = 'Closing (Kitchen)';
  assert.equal((await admin.createChecklistCategory(formRequest({ title: name }), adminLocals)).success, true);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM checklist_sections WHERE business_id='a'").get().n, 1);
  assert.equal((await admin.createChecklistCategory(formRequest({ title: name }), { ...adminLocals, businessId: 'b', userId: 'owner-b' })).success, true);
  assert.equal((await admin.createChecklistCategory(formRequest({ title: name }), adminLocals)).status, 400);
  const otherChecklist = sqlite.prepare("SELECT id FROM checklist_sections WHERE business_id='b'").get();
  assert.equal((await admin.addChecklistItem(formRequest({ section_id: otherChecklist.id, content: 'Not my tenant' }), adminLocals)).status, 404);
  assert.equal((await admin.createListSection(formRequest({ domain: 'preplists', title: 'Daily prep (Kitchen)' }), adminLocals)).success, true);
  const prep = sqlite.prepare("SELECT id FROM list_sections WHERE business_id='a' AND domain='preplists'").get();
  assert.equal((await admin.addListItem(formRequest({ section_id: prep.id, content: 'Rice', details: 'Wash before cooking', par_count: 4 }), adminLocals)).success, true);
  assert.equal((await admin.addListItem(formRequest({ section_id: prep.id, content: 'Wrong tenant', par_count: 1 }), { ...adminLocals, businessId: 'b', userId: 'owner-b' })).status, 404);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM list_items').get().n, 1);
  console.log('PASS real creator actions: one checklist only, parentheses accepted, tenant-local duplicate names, and cross-tenant item attachment denied');

  const reports = load('src/lib/server/reports.ts');
  for (const id of ['a','b']) insert('waste_logs', { id: `waste-${id}`, business_id: id, product: id === 'a' ? '=SUM(1,1)' : 'PRIVATE OTHER TENANT PRODUCT', amount: 4, unit: 'lb', reason: 'discarded', notes: 'quoted, "text"', submitted_by_user_id: `owner-${id}`, created_at: now });
  const params = { start: '2026-01-01', end: '2027-12-31' };
  assert.equal((await reports.loadWasteReport(db, 'a', params)).rows.length, 1);
  assert.equal((await reports.loadWasteReport(db, 'a', { ...params, createdAt: now + 1 })).rows.length, 0);
  assert.equal((await reports.loadWasteReport(db, "a' OR 1=1--", params)).rows.length, 0);
  const csvRoute = load('src/routes/reports/waste.csv/+server.ts');
  const csv = await csvRoute.GET({ locals, url: new URL('https://criminiops.com/reports/waste.csv?start=2026-01-01&end=2027-12-31') });
  const body = await csv.text();
  assert.ok(body.includes("'=SUM(1,1)"));
  assert.ok(body.includes('"quoted, ""text"""'));
  assert.equal(body.includes('PRIVATE OTHER TENANT PRODUCT'), false);
  assert.match(csv.headers.get('content-disposition'), /2026-01-01-to-2027-12-31/);
  const scheduleCsv = await load('src/routes/reports/schedule.csv/+server.ts').GET({ locals, url: new URL('https://criminiops.com/reports/schedule.csv?start=2026-01-01&end=2027-12-31') });
  const scheduleBody = await scheduleCsv.text();
  assert.ok(scheduleBody.includes('09:00'));
  assert.equal(scheduleBody.includes('10:00'), false, 'Export must use published history, not unfinished draft');
  await assert.rejects(csvRoute.GET({ locals: { ...locals, businessRole: 'staff', businessPermissionTemplate: 'staff' }, url: new URL('https://criminiops.com/reports/waste.csv') }), { location: '/app' });
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  console.log('PASS actual report and CSV actions: selected tenant/date/submission, formula safety, quoting, filename, and staff denial');

  const register = loadServerModules({
    '#lib/server/observability.ts': { logOperationalEvent() {}, logOperationalError() {} },
    '#lib/server/operationalEvents.ts': { async recordOperationalEventBestEffort() { return null; } },
    '#lib/server/trial.ts': { getRequestIpAddress: () => '192.0.2.1', getBusinessTrialAccess: async () => ({ mode: 'active', allowApp: true }) }
  })('src/routes/register/+page.server.ts');
  const email = 'invited@example.invalid';
  insert('business_invites', { id: 'invite-a', business_id: 'a', email, email_normalized: email,
    invite_code: 'TEST-INVITE-A', role: 'staff', permission_template: 'staff', invited_by: 'owner-a', created_at: now,
    expires_at: now + 3600, onboarding_required: 1, employment_type: 'employee', department: 'Kitchen',
    primary_schedule_department: 'Kitchen', schedule_departments_json: '["Kitchen"]' });
  const values = { email, confirm_email: email, password: 'Only-in-memory-password7!', confirm_password: 'Only-in-memory-password7!',
    real_name: 'Invited Person', display_name: 'Invited Person', birthday: '1990-03-04', user_phone: '2025550110',
    user_address_line_1: '1 Example Lane', user_city: 'Example', user_state: 'CO', user_postal_code: '80000',
    email_updates: '0', sms_updates: '0', emergency_contact_name: 'Contact', emergency_contact_phone: '2025550111',
    emergency_contact_relationship: 'Friend' };
  const registerEvent = fields => ({ locals: { DB: db, env: { DB: db, PASSWORD_PEPPER: 'workflow-test-only-pepper',
      SENSITIVE_DATA_KEY: 'workflow-test-only-sensitive-key', SENSITIVE_DATA_KEY_VERSION: 'test', APP_BASE_URL: 'https://criminiops.com' } },
    request: formRequest(fields, '/register?invite=TEST-INVITE-A'), url: new URL('https://criminiops.com/register?invite=TEST-INVITE-A'),
    cookies: { get() { return undefined; }, set() {}, delete() {} } });
  const invalid = await register.actions.default(registerEvent({ ...values, password: 'short', confirm_password: 'short' }));
  assert.equal(invalid.status, 400);
  assert.equal(invalid.data.values.realName, values.real_name);
  assert.equal(invalid.data.values.userAddressLine1, values.user_address_line_1);
  assert.equal('password' in invalid.data.values, false);
  assert.equal(sqlite.prepare('SELECT used_at FROM business_invites WHERE id=?').get('invite-a').used_at, null);
  await assert.rejects(async () => {
    const result = await register.actions.default(registerEvent(values));
    throw Error(`Registration did not redirect: ${result?.status}: ${result?.data?.error}`);
  }, { location: '/register/welcome?onboarding=1' });
  const invited = sqlite.prepare('SELECT id FROM users WHERE email=?').get(email);
  assert.ok(invited);
  const profile = sqlite.prepare('SELECT * FROM employee_profiles WHERE business_id=? AND user_id=?').get('a', invited.id);
  assert.equal(profile.real_name, values.real_name);
  assert.equal(profile.birthday, values.birthday);
  assert.equal(profile.address_line_1, values.user_address_line_1);
  assert.equal(profile.phone, values.user_phone);
  assert.equal(sqlite.prepare('SELECT * FROM employee_profiles WHERE business_id=? AND user_id=?').get('b', invited.id), undefined);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM business_users WHERE user_id=? AND business_id=?').get(invited.id,'a').n, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM business_users WHERE user_id=? AND business_id=?').get(invited.id,'b').n, 0);
  assert.ok(sqlite.prepare('SELECT used_at FROM business_invites WHERE id=?').get('invite-a').used_at);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM employee_onboarding_packages WHERE business_id=? AND user_id=?').get('a',invited.id).n, 1);
  const hydratedForms = sqlite.prepare("SELECT form_key,status FROM employee_onboarding_items WHERE business_id='a' AND form_key IN ('personal_information','emergency_contact')").all();
  assert.equal(hydratedForms.length, 2);
  assert.ok(hydratedForms.every(item => item.status === 'submitted'));
  const beforeRetry = sqlite.prepare('SELECT COUNT(*) n FROM users').get().n;
  assert.equal((await register.actions.default(registerEvent(values))).status, 400);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM users').get().n, beforeRetry);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  console.log('PASS real invite registration: retained fields on validation, profile hydration, one tenant/membership/packet, one-use invite and retry safety');
} finally { test.close(); }

await import('./schedule-workflow-behavior-check.mjs');
await import('./schedule-navigation-check.mjs');
await import('./schedule-runtime-check.mjs');
await import('./content-workflow-behavior-check.mjs');
await import('./content-runtime-check.mjs');
await import('./kitchen-tools-behavior-check.mjs');
await import('./report-behavior-check.mjs');
