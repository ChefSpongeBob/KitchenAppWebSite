import assert from 'node:assert/strict';
import { createTestD1, loadServerModules } from './helpers/test-d1.mjs';

const test = createTestD1();
const { sqlite } = test;
const now = Math.floor(Date.now() / 1000);
const weekStart = '2026-11-02';
const queries = [];

function insert(table, row) {
  const fields = Object.keys(row);
  sqlite.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`)
    .run(...Object.values(row));
}

const tracedDb = {
  prepare(sql) {
    const original = test.db.prepare(sql);
    let bindings = [];
    const statement = {
      bind(...values) { bindings = values; original.bind(...values); return statement; },
      async first(...args) {
        const result = await original.first(...args);
        queries.push({ sql, bindings, rows: result === null ? 0 : 1 });
        return result;
      },
      async all() {
        const result = await original.all();
        queries.push({ sql, bindings, rows: result.results.length });
        return result;
      },
      async run() { assert.fail('Schedule read must not write or repair schema'); }
    };
    return statement;
  },
  async batch() { assert.fail('Schedule read must not submit write batches'); }
};

const load = loadServerModules();
const db = load('src/lib/server/schemaGuard.ts').wrapProductionSchemaGuard(tracedDb, false);
const schedules = load('src/lib/server/schedules.ts');
const dates = Array.from({ length: 7 }, (_, day) => schedules.addDays(weekStart, day));

function user(id) {
  insert('users', { id, email: `${id}@example.invalid`, email_normalized: `${id}@example.invalid`,
    display_name: 'Same display name', created_at: now, updated_at: now });
}

function measure() {
  return { queryCount: queries.length, returnedRows: queries.reduce((sum, query) => sum + query.rows, 0) };
}

function assertUserReadBudget(expectedRows, table) {
  assert.equal(queries.length, 2, 'Personal schedule needs only week metadata and filtered shifts, not the full roster');
  assert.equal(measure().returnedRows, expectedRows + 1, 'Other employees must not be fetched then discarded');
  const shiftQuery = queries.find(query => query.sql.includes(`FROM ${table} s`));
  assert.ok(shiftQuery, `Exercise the actual ${table} query`);
  assert.match(shiftQuery.sql, /AND s\.user_id = \?/);
  assert.equal(shiftQuery.bindings.includes('shared'), true);
  const plan = sqlite.prepare('EXPLAIN QUERY PLAN ' + shiftQuery.sql).all(...shiftQuery.bindings)
    .find(row => /^SEARCH s USING (?:COVERING )?INDEX /.test(row.detail))?.detail;
  assert.ok(plan, 'Shift reads must use an index, not scan the table');
  assert.match(plan, /business_id=\?/);
  assert.match(plan, /user_id=\?/);
  assert.match(plan, /shift_date[>=<]/);
}

try {
  user('shared');
  for (const businessId of ['a', 'b']) {
    insert('businesses', { id: businessId, name: `Isolated ${businessId}`, slug: businessId,
      plan_tier: 'large', created_at: now, updated_at: now });
    const users = ['shared'];
    for (let index = 1; index < 40; index++) { const id = `${businessId}-${index}`; user(id); users.push(id); }
    for (const userId of users) insert('business_users', { business_id: businessId, user_id: userId,
      role: 'staff', permission_template: 'staff', created_at: now, updated_at: now });
    insert('schedule_weeks', { id: `week-${businessId}`, business_id: businessId, week_start: weekStart,
      status: 'published', published_at: now, updated_at: now, draft_initialized: 1, draft_version: 2,
      published_version: 1, has_unpublished_changes: 1 });
    for (const [table, startTime] of [['schedule_shifts', '09:00'], ['schedule_draft_shifts', '10:00']]) {
      for (const userId of users) for (const shiftDate of dates) insert(table, {
        id: `${table}-${businessId}-${userId}-${shiftDate}`, business_id: businessId,
        week_id: `week-${businessId}`, user_id: userId, shift_date: shiftDate, department: 'Kitchen',
        role: 'Cook', start_time: startTime, end_label: '17:00', notes: `Only business ${businessId}`,
        created_at: now, updated_at: now
      });
      insert(table, { id: `${table}-${businessId}-second`, business_id: businessId,
        week_id: `week-${businessId}`, user_id: 'shared', shift_date: weekStart, department: 'Kitchen',
        role: 'Cook', start_time: '18:00', end_label: '21:00', created_at: now, updated_at: now });
    }
    for (const table of ['schedule_week_team', 'schedule_draft_week_team']) {
      for (const userId of users) insert(table, { business_id: businessId, week_id: `week-${businessId}`,
        user_id: userId, created_at: now, updated_at: now });
    }
  }
  sqlite.exec('ANALYZE');
  const changesBeforeReads = sqlite.prepare('SELECT total_changes() n').get().n;

  queries.length = 0;
  const personal = await schedules.loadMyWeekSchedule(db, weekStart, 'shared', 'a');
  assert.equal(personal.shifts.length, 8);
  assert.ok(personal.shifts.every(shift => shift.userId === 'shared' && shift.weekId === 'week-a'));
  assertUserReadBudget(8, 'schedule_shifts');
  const weeklyBudget = measure();

  queries.length = 0;
  const today = await schedules.loadTodayShifts(db, 'shared', weekStart, 'a');
  assert.deepEqual(today.map(shift => shift.startTime), ['09:00', '18:00']);
  assertUserReadBudget(2, 'schedule_shifts');
  assert.match(queries[1].sql, /AND s\.shift_date = \?/);
  const todayBudget = measure();

  queries.length = 0;
  const draft = await schedules.loadMyWeekSchedule(db, weekStart, 'shared', 'a', { publishedOnly: false });
  assert.equal(draft.shifts.length, 8);
  assert.equal(draft.shifts[0].startTime, '10:00');
  assertUserReadBudget(8, 'schedule_draft_shifts');

  queries.length = 0;
  const manager = await schedules.loadScheduleWeek(db, weekStart, { userId: 'shared', businessId: 'a' });
  assert.equal(manager.shifts.length, 281, 'Manager actor ID must not accidentally filter the full builder');
  assert.equal(manager.rosterUserIds.length, 40);
  assert.equal(queries.length, 3);
  assert.ok(manager.shifts.every(shift => shift.weekId === 'week-a'));
  assert.equal(manager.shifts[0].startTime, '10:00');

  const other = await schedules.loadMyWeekSchedule(db, weekStart, 'shared', 'b');
  assert.equal(other.shifts.length, 8);
  assert.ok(other.shifts.every(shift => shift.weekId === 'week-b'));
  assert.equal((await schedules.loadMyWeekSchedule(db, weekStart, 'b-1', 'a')).shifts.length, 0);
  assert.equal((await schedules.loadMyWeekSchedule(db, weekStart, "shared' OR 1=1--", 'a')).shifts.length, 0);
  assert.equal((await schedules.loadMyWeekSchedule(db, weekStart, 'shared', "a' OR 1=1--")).shifts.length, 0);
  assert.equal((await schedules.loadMyWeekSchedule(db, weekStart, '', 'a')).shifts.length, 0);
  assert.equal((await schedules.loadMyWeekSchedule(db, weekStart, 'shared', undefined)).shifts.length, 0);

  queries.length = 0;
  const missingWeek = await schedules.loadMyWeekSchedule(db, '2026-11-09', 'shared', 'a');
  assert.equal(missingWeek.week, null);
  assert.equal(missingWeek.shifts.length, 0);
  assert.equal(queries.length, 1);
  assert.equal(sqlite.prepare('SELECT total_changes() n').get().n, changesBeforeReads);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  console.log('PASS actual schedule reads: employee/day filters use tenant-user indexes, full manager roster and draft/published separation remain intact');
  console.log('PASS shared identity across two tenants, foreign IDs, SQL-shaped values, missing scope/week and read-only persistence');
  console.log(JSON.stringify({ isolated40EmployeeFixture: { weekly: weeklyBudget, today: todayBudget } }));
} finally { test.close(); }
