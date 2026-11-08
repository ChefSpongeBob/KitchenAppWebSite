import assert from 'node:assert/strict';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

let failures = 0;
async function check(label, work) {
  const test = createTestD1();
  const { sqlite } = test;
  let writes = Promise.resolve();
  const db = { prepare: test.db.prepare, batch(statements) {
    const result = writes.then(() => test.db.batch(statements));
    writes = result.catch(() => {}); return result;
  } };
  const events = [];
  const load = loadServerModules({
    '#lib/server/observability.ts': { logOperationalEvent() {}, logOperationalError() {} },
    '#lib/server/operationalEvents.ts': { async recordOperationalEventBestEffort(database, event) { events.push(event); } }
  });
  const now = Math.floor(Date.now() / 1000);
  const weekStart = '2026-11-02';
  function insert(table, row) {
    const keys = Object.keys(row);
    sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
  }
  try {
    for (const business of ['a', 'b']) {
      insert('businesses', { id: business, slug: business, name: business, created_at: now, updated_at: now });
      for (const department of ['Kitchen', 'Service']) {
        insert('schedule_departments', { id: business + department, business_id: business, name: department, created_at: now, updated_at: now });
        insert('schedule_role_definitions', { id: business + department, business_id: business, department, role_name: 'Team', created_at: now, updated_at: now });
      }
      for (const name of ['owner', 'manager', 'alice', 'bob', 'carol', 'service']) {
        const userId = business + '-' + name;
        const role = name === 'owner' ? 'owner' : name === 'manager' ? 'manager' : 'staff';
        insert('users', { id: userId, email: userId + '@example.invalid', email_normalized: userId + '@example.invalid', display_name: userId, created_at: now, updated_at: now });
        insert('business_users', { business_id: business, user_id: userId, role, permission_template: role === 'manager' ? 'general_manager' : role, created_at: now, updated_at: now });
        if (name !== 'owner') insert('user_schedule_departments', { business_id: business, user_id: userId, department: name === 'service' ? 'Service' : 'Kitchen', updated_at: now });
      }
    }
    const schedules = load('src/lib/server/schedules.ts');
    const locals = (name = 'owner', businessId = 'a', database = db) => ({ DB: database, env: { DB: database },
      businessId, userId: businessId + '-' + name, userRole: ['owner', 'manager'].includes(name) ? 'admin' : 'user',
      businessRole: name === 'owner' ? 'owner' : name === 'manager' ? 'manager' : 'staff',
      businessPermissionTemplate: name === 'owner' ? 'owner' : name === 'manager' ? 'general_manager' : 'staff' });
    const shift = (extra = {}) => ({ id: 'fixture-shift', userId: 'a-alice', department: 'Kitchen', role: 'Team',
      shiftDate: weekStart, startTime: '09:00', endLabel: '17:00', breakMinutes: 30, notes: '', ...extra });
    const request = (rows, version, extra = {}) => formRequest({ week_start: weekStart,
      ...(rows === undefined ? {} : { payload: JSON.stringify(rows) }),
      ...(version === undefined ? {} : { draft_version: version }), ...extra });
    const save = (rows, version, who = locals()) => schedules.saveScheduleWeekDraft(request(rows, version), who);
    const publish = (rows, version, who = locals()) => schedules.publishScheduleWeek(request(rows, version), who);
    await work({ sqlite, db, test, now, weekStart, load, insert, events, schedules, locals, shift, request, save, publish });
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    console.log('PASS ' + label);
  } catch (error) { failures++; console.error('FAIL ' + label + ': ' + error.message); }
  finally { await writes; test.close(); }
}

function gateReads(db, matches) {
  let reads = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  return { ...db, prepare(sql) {
    const original = db.prepare(sql);
    const statement = { bind(...values) { original.bind(...values); return statement; } };
    for (const method of ['first', 'all', 'run']) statement[method] = async (...args) => {
      const value = await original[method](...args);
      if (method === 'first' && matches(sql) && reads < 2) { if (++reads === 2) release(); await barrier; }
      return value;
    };
    return statement;
  } };
}

await check('concurrent first saves create one week and return a conflict instead of a SQL error', async ({ db, locals, save, shift, sqlite }) => {
  const racing = gateReads(db, sql => sql.includes('SELECT id, week_start, status, published_at, updated_at,') && sql.includes('FROM schedule_weeks'));
  const results = await Promise.allSettled([save([shift()], 0, locals('owner', 'a', racing)), save([shift({ notes: 'Second editor' })], 0, locals('owner', 'a', racing))]);
  assert.ok(results.every(result => result.status === 'fulfilled'), 'Both first-save requests must return a normal action result');
  const values = results.map(result => result.value);
  assert.equal(values.filter(value => value.success).length, 1); assert.equal(values.filter(value => value.status === 409).length, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_weeks').get().n, 1);
});

await check('repeated and competing publication cannot duplicate unchanged history/events', async ({ db, save, publish, shift, schedules, request, locals, sqlite, events }) => {
  const saved = await save([shift()], 0); assert.equal(saved.success, true);
  assert.equal((await publish(undefined, saved.draftVersion)).success, true);
  assert.equal((await publish(undefined, saved.draftVersion)).success, true);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_publish_history').get().n, 1);
  const changed = await save([shift({ startTime: '10:00' })], saved.draftVersion);
  const outcomes = await Promise.all([schedules.publishScheduleWeek(request(undefined, changed.draftVersion), locals()), schedules.publishScheduleWeek(request(undefined, changed.draftVersion), locals())]);
  assert.ok(outcomes.some(value => value.success));
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_publish_history').get().n, 2);
  assert.equal(events.filter(event => event.eventType === 'schedule.published').length, 2);
});

await check('department-only publish preserves other live shifts and unfinished drafts', async ({ save, publish, shift, locals, sqlite, schedules, db, weekStart }) => {
  const rows = [shift(), shift({ id: 'service-shift', userId: 'a-service', department: 'Service', startTime: '08:00' })];
  assert.equal((await publish(rows, 0)).success, true);
  let week = (await schedules.loadScheduleWeek(db, weekStart, { businessId: 'a' })).week;
  assert.equal((await save(rows.map(row => ({ ...row, startTime: '10:00' })), week.draftVersion)).success, true);
  week = (await schedules.loadScheduleWeek(db, weekStart, { businessId: 'a' })).week;
  const scoped = await publish(undefined, week.draftVersion, locals('manager'));
  assert.equal(scoped.success, true, JSON.stringify(scoped));
  assert.equal(sqlite.prepare("SELECT start_time FROM schedule_shifts WHERE department='Kitchen'").get().start_time, '10:00');
  assert.equal(sqlite.prepare("SELECT start_time FROM schedule_shifts WHERE department='Service'").get().start_time, '08:00');
  assert.equal(sqlite.prepare("SELECT start_time FROM schedule_draft_shifts WHERE department='Service'").get().start_time, '10:00');
  assert.equal(sqlite.prepare('SELECT has_unpublished_changes FROM schedule_weeks').get().has_unpublished_changes, 1);
  assert.equal((await publish(undefined, week.draftVersion, locals('manager'))).success, true);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_publish_history').get().n, 2);
  assert.equal((await publish(undefined, week.draftVersion)).success, true);
  assert.equal(sqlite.prepare('SELECT has_unpublished_changes FROM schedule_weeks').get().has_unpublished_changes, 0);
});

await check('competing requests for an offered shift cannot overwrite the first requester', async ({ db, publish, shift, schedules, locals, events, sqlite }) => {
  assert.equal((await publish([shift()], 0)).success, true);
  assert.equal((await schedules.offerScheduleShift(formRequest({ shift_id: 'fixture-shift' }), locals('alice'))).success, true);
  const racing = gateReads(db, sql => sql.includes('o.offered_by_user_id') && sql.includes('FROM schedule_shift_offers o'));
  const results = await Promise.all(['bob', 'carol'].map(name => schedules.requestScheduleShiftOffer(formRequest({ shift_id: 'fixture-shift' }), locals(name, 'a', racing))));
  assert.equal(results.filter(value => value.success).length, 1);
  assert.equal(results.filter(value => value.status === 409).length, 1);
  const winner = sqlite.prepare('SELECT requested_by_user_id FROM schedule_shift_offers').get().requested_by_user_id;
  assert.ok(['a-bob', 'a-carol'].includes(winner));
  assert.equal(events.filter(event => event.eventType === 'schedule.shift.requested').length, 1);
});

await check('schedule route returns only authorized department shifts, not a UI-only filter', async ({ publish, shift, load, locals, weekStart }) => {
  assert.equal((await publish([shift(), shift({ id: 'service', userId: 'a-service', department: 'Service' })], 0)).success, true);
  const route = load('src/routes/schedule/+page.server.ts');
  for (const who of ['manager', 'alice']) {
    const result = await route.load({ locals: locals(who), url: new URL('https://criminiops.com/schedule?week=' + weekStart) });
    assert.ok(result.days.flatMap(day => day.shifts).every(row => row.department === 'Kitchen'));
  }
});

await check('draft save races, late failures and wrong-tenant assignments preserve committed work', async ({ db, save, shift, locals, sqlite }) => {
  assert.equal((await save([shift()], 0)).success, true);
  const results = await Promise.all([save([shift({ notes: 'First' })], 1), save([shift({ notes: 'Second' })], 1)]);
  assert.equal(results.filter(value => value.success).length, 1); assert.equal(results.filter(value => value.status === 409).length, 1);
  const before = sqlite.prepare('SELECT * FROM schedule_draft_shifts').all();
  assert.equal((await save([shift({ userId: 'b-alice' })], 2)).status, 400);
  sqlite.exec("CREATE TRIGGER fail_draft BEFORE INSERT ON schedule_draft_shifts BEGIN SELECT RAISE(ABORT,'fixture draft rollback'); END");
  await assert.rejects(save([shift({ notes: 'Never committed' })], 2), /fixture draft rollback/);
  assert.deepEqual(sqlite.prepare('SELECT * FROM schedule_draft_shifts').all(), before);
  assert.equal(sqlite.prepare('SELECT draft_write_token FROM schedule_weeks').get().draft_write_token, null);
});

await check('partial first publication excludes unfinished foreign departments and snapshots only live rows', async ({ save, publish, shift, locals, sqlite, schedules, db, weekStart, load }) => {
  const rows = [shift(), shift({ id: 'unfinished-service', userId: 'a-service', department: 'Service', endLabel: 'unfinished' })];
  assert.equal((await save(rows, 0)).success, true);
  const result = await publish(undefined, 1, locals('manager'));
  assert.equal(result.success, true, JSON.stringify(result)); assert.equal(result.hasUnpublishedChanges, true);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_shifts').get().n, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_shift_history').get().n, 1);
  const personal = await load('src/routes/my-schedule/+page.server.ts').load({ locals: locals('service'), url: new URL('https://criminiops.com/my-schedule?week=' + weekStart), depends() {} });
  assert.equal(personal.days.flatMap(day => day.shifts).length, 0);
  const csv = await load('src/routes/reports/schedule.csv/+server.ts').GET({ locals: locals(), url: new URL('https://criminiops.com/reports/schedule.csv?start=2026-11-02&end=2026-11-08') });
  assert.equal((await csv.text()).includes('unfinished'), false);
});

await check('scoped publication and its history roll back atomically on late failure', async ({ publish, save, shift, locals, sqlite, events }) => {
  assert.equal((await publish([shift()], 0)).success, true);
  assert.equal((await save([shift({ startTime: '11:00' })], 1)).success, true);
  const before = sqlite.prepare('SELECT * FROM schedule_shifts').all();
  const metadata = sqlite.prepare('SELECT * FROM schedule_weeks').all();
  sqlite.exec("CREATE TRIGGER fail_history BEFORE INSERT ON schedule_publish_history BEGIN SELECT RAISE(ABORT,'fixture publication rollback'); END");
  await assert.rejects(publish(undefined, 2, locals('manager')), /fixture publication rollback/);
  assert.deepEqual(sqlite.prepare('SELECT * FROM schedule_shifts').all(), before);
  assert.deepEqual(sqlite.prepare('SELECT * FROM schedule_weeks').all(), metadata);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_publish_history').get().n, 1);
  assert.equal(events.filter(event => event.eventType === 'schedule.published').length, 1);
});

await check('duplicate rows/days stay in the chosen week and disabled autofill does not create future weeks', async ({ save, publish, shift, sqlite, schedules, db, locals, weekStart }) => {
  const first = shift();
  assert.equal((await publish([first, { ...first, id: 'duplicate' }, shift({ id: 'second-day', shiftDate: '2026-11-03' })], 0)).success, true);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_shifts').get().n, 2);
  assert.equal((await save([shift({ shiftDate: '2026-11-09' })], 1)).status, 400);
  assert.equal((await schedules.loadScheduleWeek(db, '2026-11-09', { businessId: 'a' })).week, null);
  assert.equal((await schedules.copyPreviousScheduleWeek(formRequest({ week_start: '2026-11-09', draft_version: 0 }), locals())).success, true);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_weeks').get().n, 2);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM schedule_draft_shifts WHERE shift_date >= '2026-11-09'").get().n, 2);
  assert.equal((await schedules.loadScheduleWeek(db, '2026-11-16', { businessId: 'a' })).week, null);
});

await check('availability submission/review preserves tenant/department scope and all seven days', async ({ schedules, locals, sqlite }) => {
  const availability = Array.from({ length: 7 }, (_, weekday) => ({ weekday, isAvailable: weekday !== 0, startTime: '09:00', endTime: '17:00' }));
  assert.equal((await schedules.saveUserScheduleAvailability(formRequest({ availability: JSON.stringify(availability) }), locals('alice'))).success, true);
  const request = sqlite.prepare('SELECT id FROM user_schedule_availability_requests').get();
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM user_schedule_availability').get().n, 0);
  assert.equal((await schedules.approveScheduleAvailabilityRequest(formRequest({ request_id: request.id }), locals('owner', 'b'))).status, 404);
  assert.equal((await schedules.approveScheduleAvailabilityRequest(formRequest({ request_id: request.id }), locals('manager'))).success, true);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM user_schedule_availability').get().n, 7);
  assert.equal((await schedules.approveScheduleAvailabilityRequest(formRequest({ request_id: request.id }), locals('manager'))).status, 404);
});

await check('availability changed during review must not apply the unseen old payload', async ({ schedules, locals, db, sqlite }) => {
  const availability = Array.from({ length: 7 }, (_, weekday) => ({ weekday, isAvailable: true, startTime: '09:00', endTime: '17:00' }));
  await schedules.saveUserScheduleAvailability(formRequest({ availability: JSON.stringify(availability) }), locals('alice'));
  const request = sqlite.prepare('SELECT id FROM user_schedule_availability_requests').get();
  const revised = JSON.stringify(availability.map(row => ({ ...row, startTime: '11:00' })));
  const racing = { ...db, batch(statements) { sqlite.prepare('UPDATE user_schedule_availability_requests SET availability_json=? WHERE id=?').run(revised, request.id); return db.batch(statements); } };
  const result = await schedules.approveScheduleAvailabilityRequest(formRequest({ request_id: request.id }), locals('manager', 'a', racing));
  assert.equal(result.status, 409);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM user_schedule_availability').get().n, 0);
  assert.equal(sqlite.prepare('SELECT status FROM user_schedule_availability_requests').get().status, 'pending');
});

await check('time-off approval is department-bound and cannot be replayed into a contradictory decision', async ({ schedules, locals, sqlite, weekStart, publish, shift, events }) => {
  assert.equal((await schedules.createUserScheduleTimeOffRequest(formRequest({ start_date: weekStart, end_date: weekStart }), locals('alice'))).success, true);
  const request = sqlite.prepare('SELECT id FROM user_schedule_time_off_requests').get();
  assert.equal((await schedules.approveScheduleTimeOffRequest(formRequest({ request_id: request.id }), locals('owner', 'b'))).status, 404);
  assert.equal((await schedules.approveScheduleTimeOffRequest(formRequest({ request_id: request.id }), locals('manager'))).success, true);
  assert.ok([404, 409].includes((await schedules.declineScheduleTimeOffRequest(formRequest({ request_id: request.id }), locals('manager'))).status));
  assert.equal((await publish([shift()], 0)).status, 400);
  assert.equal(events.filter(event => event.eventType === 'schedule.time_off.approved').length, 1);
  assert.equal(events.filter(event => event.eventType === 'schedule.time_off.declined').length, 0);
});

await check('open-shift competing approvals assign once and update draft and live together', async ({ schedules, publish, shift, locals, db, sqlite, weekStart }) => {
  assert.equal((await publish([shift()], 0)).success, true);
  assert.equal((await schedules.createScheduleOpenShift(formRequest({ week_start: weekStart, shift_date: '2026-11-03', department: 'Kitchen', role: 'Team', start_time: '09:00', end_label: '17:00', draft_version: 1 }), locals('manager'))).success, true);
  assert.equal((await publish(undefined, 2, locals('manager'))).success, true);
  const open = sqlite.prepare('SELECT id FROM schedule_open_shifts').get();
  for (const name of ['bob', 'carol']) assert.equal((await schedules.requestScheduleOpenShift(formRequest({ open_shift_id: open.id }), locals(name))).success, true);
  const requests = sqlite.prepare('SELECT id FROM schedule_open_shift_requests').all();
  const results = await Promise.all(requests.map(row => schedules.approveScheduleOpenShiftRequest(formRequest({ request_id: row.id }), locals('manager'))));
  assert.equal(results.filter(value => value.success).length, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_shifts').get().n, 2);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_draft_shifts').get().n, 2);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_open_shifts').get().n, 0);
  const latest = sqlite.prepare('SELECT id FROM schedule_publish_history ORDER BY version_number DESC LIMIT 1').get();
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_shift_history WHERE publish_history_id=?').get(latest.id).n, 2,
    'The latest published export must include the approved assignment');
});

await check('used roles cannot be deleted; owner scheduling and revoked scheduling capability remain correct', async ({ schedules, publish, shift, locals, sqlite }) => {
  assert.equal((await publish([shift({ userId: 'a-owner' })], 0)).success, true);
  assert.equal((await schedules.deleteScheduleRoleDefinition(formRequest({ role_id: 'aKitchen' }), locals())).status, 400);
  assert.equal((await schedules.deleteScheduleRoleDefinition(formRequest({ role_id: 'bKitchen' }), locals())).status, 404);
  const denied = await publish(undefined, 1, { ...locals('manager'), businessCapabilities: [] });
  assert.equal(denied.status, 403);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_shifts').get().n, 1);
});

await check('partial publication can remove a department last shift without emptying another department', async ({ publish, save, shift, locals, sqlite }) => {
  const service = shift({ id: 'service', userId: 'a-service', department: 'Service' });
  assert.equal((await publish([shift(), service], 0)).success, true);
  assert.equal((await save([service], 1)).success, true);
  const result = await publish(undefined, 2, locals('manager'));
  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_shifts').get().n, 1);
  assert.equal(sqlite.prepare('SELECT department FROM schedule_shifts').get().department, 'Service');
});

await check('partial publication still rejects overlap with another department published shift', async ({ insert, now, publish, save, shift, locals }) => {
  insert('user_schedule_departments', { business_id: 'a', user_id: 'a-alice', department: 'Service', updated_at: now });
  const service = shift({ id: 'service-alice', department: 'Service', startTime: '08:00', endLabel: '12:00' });
  assert.equal((await publish([service], 0)).success, true);
  assert.equal((await save([service, shift({ startTime: '10:00' })], 1)).success, true);
  assert.equal((await publish(undefined, 2, locals('manager'))).status, 400);
});

await check('overnight overlap is rejected across days while adjacent nonoverlapping shifts remain valid', async ({ publish, shift }) => {
  assert.equal((await publish([shift({ startTime: '22:00', endLabel: '02:00' }), shift({ id: 'early-next-day', shiftDate: '2026-11-03', startTime: '01:00', endLabel: '08:00' })], 0)).status, 400);
  assert.equal((await publish([shift({ startTime: '22:00', endLabel: '02:00' }), shift({ id: 'later-next-day', shiftDate: '2026-11-03', startTime: '03:00', endLabel: '08:00' })], 1)).success, true);
});

await check('multi-department employees keep one roster row and do not leave false unpublished changes', async ({ insert, now, save, publish, shift, locals, sqlite }) => {
  insert('user_schedule_departments', { business_id: 'a', user_id: 'a-alice', department: 'Service', updated_at: now });
  assert.equal((await save([shift()], 0)).success, true);
  const result = await publish(undefined, 1, locals('manager'));
  assert.equal(result.success, true); assert.equal(result.hasUnpublishedChanges, false);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM schedule_week_team WHERE user_id='a-alice'").get().n, 1);
});

await check('business registry validates and persists tenant-only time zones without changing old form submissions', async ({ load, locals, sqlite, db }) => {
  const action = load('src/routes/admin/business-registry/+page.server.ts').actions.save_registry;
  assert.equal((await action({ request: formRequest({ time_zone: 'America/Los_Angeles' }), locals: locals() })).success, true);
  assert.equal(sqlite.prepare("SELECT time_zone FROM businesses WHERE id='a'").get().time_zone, 'America/Los_Angeles');
  assert.equal(sqlite.prepare("SELECT time_zone FROM businesses WHERE id='b'").get().time_zone, 'UTC');
  assert.equal((await action({ request: formRequest({ time_zone: "UTC'; DROP TABLE businesses--" }), locals: locals() })).status, 400);
  assert.equal((await action({ request: formRequest({ legal_name: 'Unchanged zone' }), locals: locals() })).success, true);
  assert.equal(sqlite.prepare("SELECT time_zone FROM businesses WHERE id='a'").get().time_zone, 'America/Los_Angeles');
  const context = await load('src/lib/server/business.ts').getUserBusinessContext(db, 'a-owner', 'a');
  assert.equal(context.businessTimeZone, 'America/Los_Angeles');
});

await check('business-local Today and current week stay consistent around UTC midnight and DST', async ({ schedules, publish, shift, locals, db, load, weekStart, test }) => {
  const zones = load('src/lib/timeZones.ts');
  for (const instant of ['2026-03-08T09:59:00Z', '2026-03-08T10:01:00Z']) {
    assert.equal(zones.getBusinessDate('America/Los_Angeles', new Date(instant)), '2026-03-08');
    assert.equal(zones.getBusinessWeekStart('America/Los_Angeles', new Date(instant)), '2026-03-02');
  }
  assert.equal(zones.getBusinessDate('Pacific/Honolulu', new Date('2026-11-09T02:00:00Z')), '2026-11-08');
  assert.equal(zones.getBusinessDate('Asia/Tokyo', new Date('2026-11-09T02:00:00Z')), '2026-11-09');
  assert.equal((await publish([shift({ shiftDate: '2026-11-08' })], 0)).success, true);
  const NativeDate = Date;
  class FixedDate extends NativeDate {
    constructor(...args) { super(...(args.length ? args : ['2026-11-09T02:00:00Z'])); }
    static now() { return new NativeDate('2026-11-09T02:00:00Z').getTime(); }
  }
  try {
    globalThis.Date = FixedDate;
    const scoped = { ...locals('alice'), businessTimeZone: 'America/Los_Angeles' };
    const before = test.queryCount;
    const today = await schedules.loadTodayShifts(db, 'a-alice', undefined, 'a', { timeZone: scoped.businessTimeZone });
    assert.equal(today.length, 1); assert.equal(today[0].shiftDate, '2026-11-08');
    assert.equal(test.queryCount - before, 2, 'Reuse membership time zone, not a new polling query');
    for (const route of ['schedule', 'my-schedule', 'admin/schedule']) {
      const result = await load('src/routes/' + route + '/+page.server.ts').load({
        locals: route.startsWith('admin') ? { ...locals(), businessTimeZone: scoped.businessTimeZone } : scoped,
        url: new URL('https://criminiops.com/' + route), depends() {}
      });
      assert.equal(result.weekStart, weekStart);
    }
  } finally { globalThis.Date = NativeDate; }
});

await check('templates remain tenant-bound and apply only to the selected week', async ({ schedules, save, shift, locals, weekStart, sqlite }) => {
  assert.equal((await save([shift()], 0)).success, true);
  assert.equal((await schedules.saveScheduleTemplateFromWeek(formRequest({ week_start: weekStart, template_name: 'Weekly fixture' }), locals())).success, true);
  const template = sqlite.prepare('SELECT id FROM schedule_templates').get();
  assert.equal((await schedules.applyScheduleTemplateToWeek(formRequest({ week_start: '2026-11-09', template_id: template.id }), locals('owner', 'b'))).status, 404);
  assert.equal((await schedules.applyScheduleTemplateToWeek(formRequest({ week_start: '2026-11-09', template_id: template.id, draft_version: 0 }), locals())).success, true);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM schedule_draft_shifts WHERE shift_date='2026-11-09'").get().n, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_weeks').get().n, 2);
});

await check('labor saves reject dates outside their week and nonfinite numbers without partial writes', async ({ schedules, locals, weekStart, sqlite }) => {
  const action = rows => schedules.saveScheduleLaborTargets(formRequest({ week_start: weekStart, labor_targets: JSON.stringify(rows) }), locals());
  assert.equal((await action([{ dayDate: '2026-11-09', projectedSales: 100 }])).status, 400);
  assert.equal((await action([{ dayDate: weekStart, projectedSales: 'Infinity' }])).status, 400);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_labor_targets').get().n, 0);
  sqlite.exec("CREATE TRIGGER fail_labor BEFORE INSERT ON schedule_labor_targets WHEN NEW.day_date='2026-11-03' BEGIN SELECT RAISE(ABORT,'fixture labor rollback'); END");
  await assert.rejects(action([{ dayDate: weekStart, projectedSales: 100 }, { dayDate: '2026-11-03', projectedSales: 200 }]), /fixture labor rollback/);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_labor_targets').get().n, 0);
});

await check('malformed shift dates and impossible availability times cannot become saved operational records', async ({ schedules, locals, save, shift, sqlite }) => {
  assert.equal((await save([shift({ shiftDate: '2026-11-03-not-a-date' })], 0)).status, 400);
  const availability = Array.from({ length: 7 }, (_, weekday) => ({ weekday, isAvailable: true, startTime: '98:00', endTime: '99:00' }));
  assert.equal((await schedules.saveUserScheduleAvailability(formRequest({ availability: JSON.stringify(availability) }), locals('alice'))).status, 400);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM user_schedule_availability_requests').get().n, 0);
});

await check('approved shift offers update employee views and their published export snapshot together', async ({ schedules, publish, shift, locals, sqlite }) => {
  assert.equal((await publish([shift()], 0)).success, true);
  assert.equal((await schedules.offerScheduleShift(formRequest({ shift_id: 'fixture-shift' }), locals('alice'))).success, true);
  assert.equal((await schedules.requestScheduleShiftOffer(formRequest({ shift_id: 'fixture-shift' }), locals('bob'))).success, true);
  assert.equal((await schedules.approveScheduleShiftOffer(formRequest({ shift_id: 'fixture-shift' }), locals('manager'))).success, true);
  assert.equal(sqlite.prepare('SELECT user_id FROM schedule_shifts').get().user_id, 'a-bob');
  assert.equal(sqlite.prepare('SELECT user_id FROM schedule_draft_shifts').get().user_id, 'a-bob');
  const latest = sqlite.prepare('SELECT id FROM schedule_publish_history ORDER BY version_number DESC LIMIT 1').get();
  assert.equal(sqlite.prepare('SELECT user_id FROM schedule_shift_history WHERE publish_history_id=?').get(latest.id).user_id, 'a-bob');
});

await check('100-employee weekly publication uses bounded bulk SQL and preserves every shift/history row', async ({ schedules, publish, shift, insert, now, weekStart, sqlite, test }) => {
  const rows = [];
  for (let employee = 0; employee < 100; employee++) {
    const userId = 'large-fixture-' + employee;
    insert('users', { id: userId, email: userId + '@example.invalid', email_normalized: userId + '@example.invalid', created_at: now, updated_at: now });
    insert('business_users', { business_id: 'a', user_id: userId, role: 'staff', permission_template: 'staff', created_at: now, updated_at: now });
    insert('user_schedule_departments', { business_id: 'a', user_id: userId, department: 'Kitchen', updated_at: now });
    for (let day = 0; day < 7; day++) rows.push(shift({ id: userId + '-' + day, userId, shiftDate: schedules.addDays(weekStart, day) }));
  }
  const before = test.queryCount;
  const result = await publish(rows, 0);
  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_shifts').get().n, 700);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM schedule_shift_history').get().n, 700);
  const statements = test.queryCount - before;
  assert.ok(statements < 100, 'Publication must not issue per-shift SQL: ' + statements);
  console.log(JSON.stringify({ isolated100EmployeePublication: { shifts: 700, sqlStatements: statements } }));
});

await check('shift-transfer approval cannot double-book its recipient', async ({ schedules, publish, shift, locals, sqlite }) => {
  assert.equal((await publish([shift(), shift({ id: 'bob-existing', userId: 'a-bob', startTime: '10:00' })], 0)).success, true);
  await schedules.offerScheduleShift(formRequest({ shift_id: 'fixture-shift' }), locals('alice'));
  await schedules.requestScheduleShiftOffer(formRequest({ shift_id: 'fixture-shift' }), locals('bob'));
  assert.equal((await schedules.approveScheduleShiftOffer(formRequest({ shift_id: 'fixture-shift' }), locals('manager'))).status, 400);
  assert.equal(sqlite.prepare("SELECT user_id FROM schedule_shifts WHERE id='fixture-shift'").get().user_id, 'a-alice');
});

await check('a conflict appearing after the approval read is rejected at the transaction boundary', async ({ schedules, publish, shift, locals, sqlite, db, now, insert }) => {
  assert.equal((await publish([shift()], 0)).success, true);
  await schedules.offerScheduleShift(formRequest({ shift_id: 'fixture-shift' }), locals('alice'));
  await schedules.requestScheduleShiftOffer(formRequest({ shift_id: 'fixture-shift' }), locals('bob'));
  const week = sqlite.prepare('SELECT id FROM schedule_weeks').get();
  const racing = { ...db, batch(statements) {
    insert('schedule_shifts', { id: 'concurrent-conflict', business_id: 'a', week_id: week.id, user_id: 'a-bob', shift_date: '2026-11-02',
      department: 'Kitchen', role: 'Team', start_time: '10:00', end_label: '18:00', created_at: now, updated_at: now });
    return db.batch(statements);
  } };
  assert.equal((await schedules.approveScheduleShiftOffer(formRequest({ shift_id: 'fixture-shift' }), locals('manager', 'a', racing))).status, 409);
  assert.equal(sqlite.prepare("SELECT user_id FROM schedule_shifts WHERE id='fixture-shift'").get().user_id, 'a-alice');
});

if (failures) { console.error(`${failures} scheduling behavior checks failed.`); process.exitCode = 1; }
