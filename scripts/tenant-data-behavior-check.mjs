import assert from 'node:assert/strict';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

const test = createTestD1();
const { sqlite, db } = test;
const now = Math.floor(Date.now() / 1000);
const events = [];
const load = loadServerModules({ '#lib/server/operationalEvents.ts': {
  async recordOperationalEventBestEffort(_db, event) { events.push(event); }
} });
function insert(table, row) {
  const fields = Object.keys(row);
  sqlite.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`)
    .run(...Object.values(row));
}
const availability = Array.from({ length: 7 }, (_, weekday) => ({ weekday, isAvailable: true, startTime: '08:00', endTime: '18:00' }));
const ids = business => Array.from({ length: 120 }, (_, index) => `${business}-${index}`);
try {
  assert.throws(() => db.prepare('SELECT 1').bind(...Array(101).fill(0)), /D1 bound-parameter limit/);
  for (const business of ['a', 'b']) {
    insert('businesses', { id: business, name: business, slug: business, created_at: now, updated_at: now });
    insert('schedule_departments', { id: `dept-${business}`, business_id: business, name: 'Kitchen', created_at: now, updated_at: now });
    insert('schedule_role_definitions', { id: `role-${business}`, business_id: business, department: 'Kitchen', role_name: 'Cook', created_at: now, updated_at: now });
    insert('list_sections', { id: `list-${business}`, business_id: business, domain: 'inventory', slug: 'daily', title: 'Daily', created_at: now, updated_at: now });
    insert('checklist_sections', { id: `check-${business}`, business_id: business, slug: 'closing', title: 'Closing', created_at: now, updated_at: now });
    insert('recipes', { id: business === 'a' ? 1 : 2, business_id: business, title: `Recipe ${business}`, category: 'Kitchen', ingredients: 'Rice', instructions: 'Cook' });
    for (const [index, id] of ids(business).entries()) {
      insert('users', { id, email: `${id}@example.invalid`, email_normalized: `${id}@example.invalid`, display_name: id, created_at: now, updated_at: now });
      insert('business_users', { business_id: business, user_id: id, role: 'staff', created_at: now, updated_at: now });
      insert('user_schedule_departments', { business_id: business, user_id: id, department: 'Kitchen', updated_at: now });
      insert('user_schedule_availability', { business_id: business, user_id: id, weekday: 0, is_available: 1, start_time: '', end_time: '', updated_at: now });
      insert('user_schedule_role_settings', { business_id: business, user_id: id, restrict_to_selected: 1, updated_at: now });
      insert('user_schedule_roles', { business_id: business, user_id: id, role_definition_id: `role-${business}`, updated_at: now });
      insert('user_schedule_availability_requests', { id, business_id: business, user_id: id, availability_json: JSON.stringify(availability), created_at: now + index, updated_at: now + index });
      insert('user_schedule_time_off_requests', { id, business_id: business, user_id: id, start_date: '2026-11-09', end_date: '2026-11-09', created_at: now, updated_at: now });
      insert('list_items', { id, business_id: business, section_id: `list-${business}`, content: `Item ${index}`, amount: 0, created_at: now, updated_at: now });
      insert('item_attachments', { id, business_id: business, source_type: 'list_item', source_item_id: id,
        target_type: 'recipe', target_id: business === 'a' ? '1' : '2', created_at: now });
      insert('creator_category_registry', { id, business_id: business, editor_type: 'document', category: `Category ${index}`, created_at: now });
      insert('documents', { id, business_id: business, slug: `doc-${index}`, title: `Document ${business}`, section: 'docs', category: `Category ${index}`, content: 'Body omitted from library payload', created_at: now, updated_at: now });
    }
  }
  const schedules = load('src/lib/server/schedules.ts');
  const before = test.queryCount;
  assert.equal((await schedules.loadScheduleDepartmentApprovalsByUser(db, ids('a'), 'a')).size, 120);
  assert.equal((await schedules.loadScheduleAvailabilityByUser(db, ids('a'), 'a')).size, 120);
  assert.equal((await schedules.loadScheduleRoleAccessByUser(db, 'a', ids('a'))).size, 120);
  assert.equal(await schedules.countPendingScheduleRequests(db, 'a', ids('a')), 240);
  assert.equal((await schedules.loadPendingScheduleAvailabilityRequests(db, 'a', ids('a'))).length, 100);
  assert.equal((await schedules.loadPendingScheduleTimeOffRequests(db, 'a', ids('a'))).length, 100);
  assert.equal(test.queryCount - before, 8, 'Bulk roster operations stay constant-query, not one query per person');
  assert.equal(await schedules.countPendingScheduleRequests(db, 'a', ids('b')), 0);
  assert.equal((await schedules.loadScheduleAvailabilityByUser(db, [], 'a')).size, 0);
  const attachments = load('src/lib/server/itemAttachments.ts');
  const attached = await attachments.loadItemAttachmentsForItems(db, 'a', 'list_item', [...ids('a'), ...ids('b')]);
  assert.equal(attached.size, 120);
  assert.ok([...attached.values()].flat().every(row => row.title === 'Recipe a'));
  const documents = await load('src/routes/docs/+page.server.ts').load({ locals: { DB: db, businessId: 'a' } });
  assert.equal(documents.docs.length, 120);
  assert.ok(documents.docs.every(doc => doc.title === 'Document a' && !('content' in doc)));
  const admin = load('src/lib/server/admin.ts');
  assert.equal((await admin.loadAdminUsers(db, 'a')).length, 120);
  insert('list_items', { id: 'mismatched-list-child', business_id: 'b', section_id: 'list-a', content: 'PRIVATE B', created_at: now, updated_at: now });
  insert('checklist_items', { id: 'mismatched-check-child', business_id: 'b', section_id: 'check-a', content: 'PRIVATE B', created_at: now, updated_at: now });
  assert.equal(JSON.stringify(await admin.loadAdminSections(db, 'a')).includes('PRIVATE B'), false);
  assert.equal(JSON.stringify(await admin.loadAdminChecklists(db, 'a')).includes('PRIVATE B'), false);
  console.log('PASS >100-person/item/category reads obey D1 bindings, preserve complete results and tenant parent-child scope without N+1 queries');

  const features = load('src/lib/server/appFeatures.ts');
  const definitions = load('src/lib/features/appFeatures.ts');
  const changes = () => sqlite.prepare('SELECT total_changes() n').get().n;
  const readChanges = changes();
  const readQueries = test.queryCount;
  assert.deepEqual(await features.loadAppFeatureModes(db, 'a'), definitions.defaultAppFeatureModes);
  assert.equal(changes(), readChanges, 'Reading feature defaults must not issue seed writes');
  assert.equal(test.queryCount - readQueries, 1);
  await features.saveAppFeatureModes(db, { todo: 'off' }, null, 'b');
  const previous = await features.loadAppFeatureModes(db, 'a');
  sqlite.exec("CREATE TRIGGER test_feature_failure BEFORE INSERT ON app_feature_flags_business WHEN NEW.business_id='a' AND NEW.feature_key='whiteboard' BEGIN SELECT RAISE(ABORT,'feature failure'); END");
  await assert.rejects(features.saveAppFeatureModes(db, { todo: 'off', whiteboard: 'off' }, null, 'a'), /feature failure/);
  assert.deepEqual(await features.loadAppFeatureModes(db, 'a'), previous);
  sqlite.exec('DROP TRIGGER test_feature_failure');
  await features.saveAppFeatureModes(db, { todo: 'off', whiteboard: 'admin' }, null, 'a');
  assert.equal((await features.loadAppFeatureModes(db, 'a')).whiteboard, 'admin');
  assert.equal((await features.loadAppFeatureModes(db, 'b')).whiteboard, 'all');
  const business = load('src/lib/server/business.ts');
  const unavailable = { prepare() { return { bind() { return this; }, async all() { throw Error('permission lookup unavailable'); } }; } };
  await assert.rejects(business.loadBusinessCapabilityOverrides(unavailable, 'a', 'a-0'), /permission lookup unavailable/);
  console.log('PASS one-query/no-write feature defaults, atomic saves, immediate tenant-local reload and fail-closed individual-permission lookup');

  const list = load('src/lib/server/preplist.ts').createListPage('inventory', 'daily', 'Daily', {
    subtitle: '', valueLabel: 'Amount', submitLabel: 'Submit', resetLabel: 'Reset', adminSummaryLabel: 'Submitted', defaults: []
  });
  const locals = { DB: db, businessId: 'a', userId: 'a-0' };
  const submit = entries => list.actions.submit_prep_counts({ request: formRequest(entries), locals });
  const fields = Object.fromEntries(ids('a').map(id => [`amount_${id}`, '3']));
  const original = sqlite.prepare("SELECT amount FROM list_items WHERE business_id='a' ORDER BY id").all();
  const invalid = await submit({ ...fields, 'amount_a-119': 'invalid' });
  assert.equal(invalid.status, 400);
  assert.deepEqual(sqlite.prepare("SELECT amount FROM list_items WHERE business_id='a' ORDER BY id").all(), original);
  sqlite.exec("CREATE TRIGGER test_submission_failure BEFORE INSERT ON list_submission_items WHEN NEW.item_id='a-119' BEGIN SELECT RAISE(ABORT,'snapshot failure'); END");
  await assert.rejects(submit(fields), /snapshot failure/);
  assert.deepEqual(sqlite.prepare("SELECT amount FROM list_items WHERE business_id='a' ORDER BY id").all(), original);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM list_submission_batches').get().n, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM list_submission_items').get().n, 0);
  assert.equal(events.length, 0);
  sqlite.exec('DROP TRIGGER test_submission_failure');
  assert.equal((await submit({ ...fields, amount_b_0: '999' })).success, true);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM list_items WHERE business_id='a' AND amount=3").get().n, 120);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM list_items WHERE business_id='b' AND amount!=0").get().n, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM list_submission_batches').get().n, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM list_submission_items').get().n, 120);
  assert.equal(events.length, 1);
  // Also exercise the actual prep route's text quantities, rather than treating prep as numeric inventory.
  sqlite.exec("UPDATE list_sections SET domain='preplists' WHERE business_id='a'");
  const prep = load('src/routes/lists/preplists/[section]/+page.server.ts');
  const prepFields = Object.fromEntries(ids('a').map(id => [`amount_${id}`, '2 hotel pans']));
  sqlite.exec("CREATE TRIGGER test_prep_failure BEFORE INSERT ON list_submission_items WHEN NEW.item_id='a-119' BEGIN SELECT RAISE(ABORT,'prep rollback'); END");
  await assert.rejects(prep.actions.submit_prep_counts({ request: formRequest(prepFields), locals, params: { section: 'daily' } }), /prep rollback/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM list_items WHERE business_id='a' AND amount_text='2 hotel pans'").get().n, 0);
  sqlite.exec('DROP TRIGGER test_prep_failure');
  assert.equal((await prep.actions.submit_prep_counts({ request: formRequest(prepFields), locals, params: { section: 'daily' } })).success, true);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM list_items WHERE business_id='a' AND amount_text='2 hotel pans'").get().n, 120);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM list_submission_batches').get().n, 2);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM list_submission_items').get().n, 240);
  await attachments.deleteAttachmentsForSourceItems(db, 'a', 'list_item', [...ids('a'), ...ids('b')]);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM item_attachments WHERE business_id='a'").get().n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM item_attachments WHERE business_id='b'").get().n, 120);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  console.log('PASS whole-list validation and value/history rollback, 120-item atomic submission, post-commit event only and scoped attachment deletion');
} finally { test.close(); }
