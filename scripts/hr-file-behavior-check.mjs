import assert from 'node:assert/strict';
import { createTestD1, loadServerModules } from './helpers/test-d1.mjs';

const now = Math.floor(Date.now() / 1000);
const templateKey = 'businesses/a/employee-onboarding/template-a/old.pdf';
const i9Key = 'businesses/a/employee-onboarding/employee/i9-old.pdf';
const foreignKey = 'businesses/b/employee-onboarding/foreign/private.pdf';
const urlFor = key => '/api/documents/media/' + key;
const pdf = name => new File(['%PDF-1.7 isolated fixture'], name, { type: 'application/pdf' });
function fixture({ retainCopies = 0 } = {}) {
  const test = createTestD1(), { sqlite, db } = test;
  const insert = (table, row) => {
    const keys = Object.keys(row);
    sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
  };
  for (const id of ['a', 'b']) insert('businesses', { id, name: id, slug: id, status: 'active', created_at: now, updated_at: now });
  for (const [id, business, role] of [['owner','a','owner'], ['manager','a','manager'], ['employee','a','staff'], ['foreign','b','owner']]) {
    insert('users', { id, email: id + '@example.invalid', email_normalized: id + '@example.invalid', created_at: now, updated_at: now });
    insert('business_users', { business_id: business, user_id: id, role, permission_template: role === 'manager' ? 'general_manager' : role, created_at: now, updated_at: now });
  }
  insert('employee_onboarding_template_items', { id: 'template', business_id: 'a', item_type: 'acknowledgement', title: 'Handbook', source_file_url: urlFor(templateKey), source_file_name: 'old.pdf', created_at: now, updated_at: now, created_by: 'owner' });
  insert('employee_onboarding_packages', { id: 'packet', business_id: 'a', user_id: 'employee', status: 'submitted', sent_at: now, submitted_at: now, updated_at: now });
  insert('employee_onboarding_items', { id: 'i9', package_id: 'packet', business_id: 'a', user_id: 'employee', item_type: 'document', form_key: 'federal_i9', title: 'Federal I-9', status: 'submitted', submitted_at: now, created_at: now });
  insert('employee_i9_verifications', { id: 'verification', business_id: 'a', user_id: 'employee', package_id: 'packet', status: 'pending', completed_i9_file_url: urlFor(i9Key), completed_i9_file_name: 'i9-old.pdf', created_at: now, updated_at: now });
  insert('business_hr_settings', { business_id: 'a', retain_i9_document_copies: retainCopies, everify_participant: 0, updated_at: now });
  const objects = new Set([templateKey, i9Key, foreignKey]), deleted = [];
  const bucket = { async put(key) { objects.add(key); }, async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) { objects.delete(key); deleted.push(key); } } };
  const load = loadServerModules({ '#lib/server/observability.ts': { logOperationalEvent() {}, logOperationalError() {} },
    '#lib/server/operationalEvents.ts': { async recordOperationalEventBestEffort() {} } });
  const admin = load('src/lib/server/admin.ts');
  const locals = { DB: db, env: { DB: db }, MEDIA_BUCKET: bucket, userId: 'owner', businessId: 'a', businessRole: 'owner', businessPermissionTemplate: 'owner', userRole: 'admin' };
  function request(fields, files = {}) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
    for (const [key, values] of Object.entries(files)) for (const file of Array.isArray(values) ? values : [values]) form.append(key, file);
    return new Request('https://criminiops.com/admin/onboarding', { method: 'POST', body: form });
  }
  const template = (fields = {}, upload = true) => request({ id: 'template', item_type: 'acknowledgement', form_key: '', title: 'Updated handbook', description: '', sort_order: 0, is_active: 1,
    existing_source_file_url: urlFor(templateKey), existing_source_file_name: 'old.pdf', ...fields }, upload ? { source_file: pdf('new.pdf') } : {});
  const verify = (fields = {}, copies = [], upload = true) => request({ package_id: 'packet', document_selection: 'list_a', employee_first_day: '2026-11-01', examined_at: '2026-11-02', verifier_name: 'Example Verifier', verifier_title: 'Manager', attested: '1', ...fields },
    { ...(upload ? { completed_i9: pdf('completed.pdf') } : {}), ...(copies.length ? { document_copies: copies } : {}) });
  return { ...test, get queryCount() { return test.queryCount; }, insert, load, admin, locals, objects, deleted, bucket, request, template, verify };
}
const failures = [];
async function check(label, run, options) {
  const t = fixture(options);
  try { await run(t); assert.deepEqual(t.sqlite.prepare('PRAGMA foreign_key_check').all(), []); console.log('PASS ' + label); }
  catch (error) { failures.push(label); console.error('FAIL ' + label + ': ' + error.message); }
  finally { t.close(); }
}
await check('failed template replacement preserves the previous row/file and removes its uncommitted upload', async t => {
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE UPDATE ON employee_onboarding_template_items BEGIN SELECT RAISE(ABORT,'isolated template save failure'); END");
  const result = await t.admin.updateEmployeeOnboardingTemplateItem(t.template(), t.locals);
  assert.equal(result.status, 503); assert.equal(t.sqlite.prepare("SELECT source_file_url FROM employee_onboarding_template_items WHERE id='template'").get().source_file_url, urlFor(templateKey));
  assert.ok(t.objects.has(templateKey)); assert.equal(t.objects.size, 3);
});
await check('hidden existing-file fields cannot delete another restaurant file', async t => {
  assert.equal((await t.admin.updateEmployeeOnboardingTemplateItem(t.template({ existing_source_file_url: urlFor(foreignKey) }), t.locals)).success, true);
  assert.ok(t.objects.has(foreignKey));
});
await check('deleting a template retains its source file in an already-issued packet', async t => {
  t.insert('employee_onboarding_items', { id: 'handbook', package_id: 'packet', business_id: 'a', user_id: 'employee', item_type: 'acknowledgement', title: 'Handbook', source_file_url: urlFor(templateKey), created_at: now });
  assert.equal((await t.admin.deleteEmployeeOnboardingTemplateItem(t.request({ id: 'template' }), t.locals)).success, true);
  assert.ok(t.objects.has(templateKey));
});
await check('I-9 copy-policy validation happens before uploading or deleting the completed form', async t => {
  assert.equal((await t.admin.verifyEmployeeI9(t.verify(), t.locals)).status, 400);
  assert.ok(t.objects.has(i9Key)); assert.equal(t.objects.size, 3); assert.equal(t.deleted.length, 0);
}, { retainCopies: 1 });
await check('a late I-9 copy insert failure rolls verification, audit and all files back together', async t => {
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON employee_i9_document_copies BEGIN SELECT RAISE(ABORT,'isolated document copy failure'); END");
  assert.equal((await t.admin.verifyEmployeeI9(t.verify({}, [pdf('copy.pdf')]), t.locals)).status, 503);
  const row = t.sqlite.prepare("SELECT status,completed_i9_file_url FROM employee_i9_verifications WHERE id='verification'").get();
  assert.equal(row.status, 'pending'); assert.equal(row.completed_i9_file_url, urlFor(i9Key)); assert.ok(t.objects.has(i9Key)); assert.equal(t.objects.size, 3);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_sensitive_record_audit').get().n, 0);
}, { retainCopies: 1 });
await check('all I-9 copies are validated before any verification or file write', async t => {
  const invalid = new File(['<script>not a document</script>'], 'copy.html', { type: 'text/html' });
  assert.equal((await t.admin.verifyEmployeeI9(t.verify({}, [pdf('valid.pdf'), invalid]), t.locals)).status, 400);
  assert.equal(t.sqlite.prepare("SELECT status FROM employee_i9_verifications WHERE id='verification'").get().status, 'pending');
  assert.equal(t.objects.size, 3); assert.equal(t.deleted.length, 0);
}, { retainCopies: 1 });
await check('packet acceptance during an I-9 upload prevents any verifier overwrite', async t => {
  const put = t.bucket.put;
  t.bucket.put = async key => { await put(key); t.sqlite.exec("UPDATE employee_onboarding_packages SET status='approved',locked_at=1 WHERE id='packet'"); };
  assert.equal((await t.admin.verifyEmployeeI9(t.verify(), t.locals)).status, 409);
  assert.equal(t.sqlite.prepare("SELECT status FROM employee_i9_verifications WHERE id='verification'").get().status, 'pending'); assert.equal(t.objects.size, 3);
});
await check('a failed template creation leaves no form, audit or uploaded object', async t => {
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON employee_onboarding_template_items BEGIN SELECT RAISE(ABORT,'isolated create failure'); END");
  assert.equal((await t.admin.createEmployeeOnboardingTemplateItem(t.template(), t.locals)).status, 503);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_onboarding_template_items').get().n, 1);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n, 0); assert.equal(t.objects.size, 3);
});
await check('missing or foreign template IDs never upload or delete a file', async t => {
  t.sqlite.exec("UPDATE employee_onboarding_template_items SET business_id='b'");
  assert.equal((await t.admin.updateEmployeeOnboardingTemplateItem(t.template(), t.locals)).status, 404);
  assert.equal((await t.admin.deleteEmployeeOnboardingTemplateItem(t.request({ id: 'template' }), t.locals)).status, 404);
  assert.equal(t.objects.size, 3); assert.equal(t.deleted.length, 0);
});
await check('hidden source URLs cannot attach a foreign file or replace saved file metadata', async t => {
  assert.equal((await t.admin.createEmployeeOnboardingTemplateItem(t.template({ source_file_url: urlFor(foreignKey) }, false), t.locals)).status, 400);
  assert.equal((await t.admin.updateEmployeeOnboardingTemplateItem(t.template({ source_file_url: urlFor(foreignKey), existing_source_file_name: 'forged.pdf' }, false), t.locals)).success, true);
  const row = t.sqlite.prepare("SELECT source_file_url,source_file_name FROM employee_onboarding_template_items WHERE id='template'").get();
  assert.equal(row.source_file_url, urlFor(templateKey)); assert.equal(row.source_file_name, 'old.pdf');
});
await check('same-second competing template replacements retain only the winner and historical references', async t => {
  t.insert('employee_onboarding_items', { id: 'handbook', package_id: 'packet', business_id: 'a', user_id: 'employee', item_type: 'acknowledgement', title: 'Handbook', source_file_url: urlFor(templateKey), created_at: now });
  const put = t.bucket.put; let first = true;
  t.bucket.put = async key => { await put(key); if (first) { first = false;
    assert.equal((await t.admin.updateEmployeeOnboardingTemplateItem(t.template({ title: 'Winning handbook' }), t.locals)).success, true);
  } };
  assert.equal((await t.admin.updateEmployeeOnboardingTemplateItem(t.template(), t.locals)).status, 409);
  assert.equal(t.sqlite.prepare("SELECT title FROM employee_onboarding_template_items WHERE id='template'").get().title, 'Winning handbook');
  assert.ok(t.objects.has(templateKey)); assert.ok(t.objects.has(foreignKey)); assert.equal(t.objects.size, 4);
});
await check('a concurrent duplicate standard form is rejected at template commit', async t => {
  const put = t.bucket.put;
  t.bucket.put = async key => { await put(key); t.insert('employee_onboarding_template_items', { id: 'concurrent', business_id: 'a', item_type: 'document', form_key: 'federal_w4', title: 'Federal W-4', created_at: now, updated_at: now }); };
  assert.equal((await t.admin.createEmployeeOnboardingTemplateItem(t.template({ item_type: 'document', form_key: 'federal_w4' }), t.locals)).status, 409);
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM employee_onboarding_template_items WHERE form_key='federal_w4'").get().n, 1); assert.equal(t.objects.size, 3);
});
await check('template delete failure preserves the row, source object and audit state', async t => {
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE DELETE ON employee_onboarding_template_items BEGIN SELECT RAISE(ABORT,'isolated delete failure'); END");
  assert.equal((await t.admin.deleteEmployeeOnboardingTemplateItem(t.request({ id: 'template' }), t.locals)).status, 503);
  assert.ok(t.sqlite.prepare("SELECT 1 FROM employee_onboarding_template_items WHERE id='template'").get());
  assert.ok(t.objects.has(templateKey)); assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n, 0);
});
await check('template deletion detects a same-second competing edit', async t => {
  const batch = t.db.batch;
  t.db.batch = async statements => { t.sqlite.exec("UPDATE employee_onboarding_template_items SET title='Competing title' WHERE id='template'"); return batch(statements); };
  assert.equal((await t.admin.deleteEmployeeOnboardingTemplateItem(t.request({ id: 'template' }), t.locals)).status, 409); assert.ok(t.objects.has(templateKey));
});
for (const operation of ['template', 'i9']) {
  await check(operation + ' rejects spoofed owner locals for a foreign or inactive identity', async t => {
    t.locals.userId = 'foreign';
    assert.equal((await (operation === 'template' ? t.admin.updateEmployeeOnboardingTemplateItem(t.template(), t.locals) : t.admin.verifyEmployeeI9(t.verify(), t.locals))).status, 403);
    t.locals.userId = 'owner'; t.sqlite.exec("UPDATE users SET is_active=0 WHERE id='owner'");
    assert.equal((await (operation === 'template' ? t.admin.updateEmployeeOnboardingTemplateItem(t.template(), t.locals) : t.admin.verifyEmployeeI9(t.verify(), t.locals))).status, 403);
    assert.equal(t.objects.size, 3); assert.equal(t.deleted.length, 0);
  });
  await check(operation + ' rejects revoked membership during file upload', async t => {
    const put = t.bucket.put;
    t.bucket.put = async key => { await put(key); t.sqlite.exec("UPDATE business_users SET is_active=0 WHERE user_id='owner'"); };
    assert.equal((await (operation === 'template' ? t.admin.updateEmployeeOnboardingTemplateItem(t.template(), t.locals) : t.admin.verifyEmployeeI9(t.verify(), t.locals))).status, 409);
    assert.equal(t.objects.size, 3); assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n, 0);
  });
  await check(operation + ' cleans an R2 put whose response fails after storing the new object', async t => {
    const put = t.bucket.put;
    t.bucket.put = async key => { await put(key); throw Error('isolated lost put response'); };
    assert.equal((await (operation === 'template' ? t.admin.updateEmployeeOnboardingTemplateItem(t.template(), t.locals) : t.admin.verifyEmployeeI9(t.verify(), t.locals))).status, 503);
    assert.equal(t.objects.size, 3); assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n, 0);
  });
  await check(operation + ' recovers a lost successful D1 batch response without deleting committed files', async t => {
    const batch = t.db.batch;
    t.db.batch = async statements => { await batch(statements); throw Error('isolated lost commit response'); };
    assert.equal((await (operation === 'template' ? t.admin.updateEmployeeOnboardingTemplateItem(t.template(), t.locals) : t.admin.verifyEmployeeI9(t.verify(), t.locals))).success, true);
    assert.equal(t.objects.size, 3); assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n, 1);
  });
  await check(operation + ' cleanup failure never misreports a committed save', async t => {
    t.bucket.delete = async () => { throw Error('isolated cleanup outage'); };
    assert.equal((await (operation === 'template' ? t.admin.updateEmployeeOnboardingTemplateItem(t.template(), t.locals) : t.admin.verifyEmployeeI9(t.verify(), t.locals))).success, true);
    assert.equal(t.objects.size, 4); assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n, 1);
  });
}
await check('I-9 explicit sensitive denial beats an obsolete grant and forged capabilities', async t => {
  t.locals.userId = 'manager'; t.locals.businessCapabilities = ['review_onboarding', 'view_sensitive_employee_data'];
  for (const [permission_key,is_enabled] of [['view_sensitive_employee_data',0],['hr_sensitive_access',1]]) t.insert('employee_role_permissions', { business_id:'a', user_id:'manager', permission_key,is_enabled,updated_at:now });
  assert.equal((await t.admin.verifyEmployeeI9(t.verify(), t.locals)).status, 403); assert.equal(t.objects.size, 3);
});
await check('I-9 accepts an explicitly authorized manager and saves all copies and both audits together', async t => {
  t.locals.userId = 'manager'; t.locals.businessRole = 'manager'; t.locals.businessPermissionTemplate = 'general_manager';
  t.insert('employee_role_permissions', { business_id:'a',user_id:'manager',permission_key:'view_sensitive_employee_data',is_enabled:1,updated_at:now });
  const before = t.queryCount;
  assert.equal((await t.admin.verifyEmployeeI9(t.verify({}, [pdf('copy-a.pdf'),pdf('copy-b.pdf')]), t.locals)).success, true);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_i9_document_copies').get().n, 2);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_sensitive_record_audit').get().n, 1);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n, 1);
  assert.ok(t.queryCount-before <= 12, 'I-9 read/write query budget');
  assert.equal(t.objects.size, 5); assert.ok(t.objects.has(foreignKey));
}, { retainCopies: 1 });
await check('I-9 rejects policy changes made during upload', async t => {
  const put=t.bucket.put; t.bucket.put=async key=>{await put(key);t.sqlite.exec('UPDATE business_hr_settings SET retain_i9_document_copies=1');};
  assert.equal((await t.admin.verifyEmployeeI9(t.verify(),t.locals)).status,409); assert.equal(t.objects.size,3);
});
await check('I-9 rejects permissions removed during upload', async t => {
  t.locals.userId='manager'; t.insert('employee_role_permissions',{business_id:'a',user_id:'manager',permission_key:'view_sensitive_employee_data',is_enabled:1,updated_at:now});
  const put=t.bucket.put; t.bucket.put=async key=>{await put(key);t.sqlite.exec("UPDATE employee_role_permissions SET is_enabled=0 WHERE user_id='manager'");};
  assert.equal((await t.admin.verifyEmployeeI9(t.verify(),t.locals)).status,409); assert.equal(t.objects.size,3);
});
await check('I-9 concurrent first verifications cannot overwrite the winner or orphan either upload', async t => {
  t.sqlite.exec('DELETE FROM employee_i9_verifications');
  const put=t.bucket.put; let first=true;
  t.bucket.put=async key=>{await put(key);if(first){first=false;assert.equal((await t.admin.verifyEmployeeI9(t.verify({verifier_name:'Winning verifier'}),t.locals)).success,true);}};
  assert.equal((await t.admin.verifyEmployeeI9(t.verify(),t.locals)).status,409);
  assert.equal(t.sqlite.prepare('SELECT verifier_name FROM employee_i9_verifications').get().verifier_name,'Winning verifier');
  assert.equal(t.objects.size,4); assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n,1);
});
await check('I-9 sensitive-audit failure rolls back verification and copies', async t => {
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON employee_sensitive_record_audit BEGIN SELECT RAISE(ABORT,'isolated sensitive audit failure'); END");
  assert.equal((await t.admin.verifyEmployeeI9(t.verify({},[pdf('copy.pdf')]),t.locals)).status,503);
  assert.equal(t.sqlite.prepare('SELECT status FROM employee_i9_verifications').get().status,'pending');
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_i9_document_copies').get().n,0); assert.equal(t.objects.size,3);
}, {retainCopies:1});
await check('I-9 rejects HTML renamed as PDF, invalid calendar dates and excess copies before writing', async t => {
  const invalid=t.request({package_id:'packet',document_selection:'list_a',employee_first_day:'2026-11-01',examined_at:'2026-11-02',verifier_name:'Verifier',verifier_title:'Manager',attested:1}, {completed_i9:new File(['<script>bad</script>'],'fake.pdf',{type:'text/html'})});
  assert.equal((await t.admin.verifyEmployeeI9(invalid,t.locals)).status,400);
  assert.equal((await t.admin.verifyEmployeeI9(t.verify({employee_first_day:'2026-02-30'}),t.locals)).status,400);
  assert.equal((await t.admin.verifyEmployeeI9(t.verify({},Array.from({length:7},()=>pdf('copy.pdf'))),t.locals)).status,400);
  assert.equal(t.objects.size,3); assert.equal(t.deleted.length,0);
});
await check('I-9 E-Verify photo-match requires copies without changing the saved retention policy', async t => {
  t.sqlite.exec('UPDATE business_hr_settings SET everify_participant=1');
  assert.equal((await t.admin.verifyEmployeeI9(t.verify({photo_matching_document_present:1}),t.locals)).status,400);
  assert.equal((await t.admin.verifyEmployeeI9(t.verify({photo_matching_document_present:1},[pdf('copy.pdf')]),t.locals)).success,true);
  assert.equal(t.sqlite.prepare('SELECT retain_i9_document_copies FROM business_hr_settings').get().retain_i9_document_copies,0);
});
await check('I-9 replacements preserve files referenced by accepted historical packets', async t => {
  t.insert('employee_onboarding_packages',{id:'historical',business_id:'a',user_id:'employee',status:'approved',sent_at:now-1,updated_at:now-1});
  t.insert('employee_onboarding_items',{id:'historical-i9',package_id:'historical',business_id:'a',user_id:'employee',item_type:'document',form_key:'federal_i9',title:'Federal I-9',status:'approved',file_url:urlFor(i9Key),created_at:now-1});
  assert.equal((await t.admin.verifyEmployeeI9(t.verify(),t.locals)).success,true); assert.ok(t.objects.has(i9Key)); assert.equal(t.objects.size,4);
});
await check('I-9 packet identity must match its submitted I-9 item and verification', async t => {
  t.sqlite.exec("UPDATE employee_onboarding_items SET user_id='foreign' WHERE id='i9'");
  assert.equal((await t.admin.verifyEmployeeI9(t.verify(),t.locals)).status,400);
  t.sqlite.exec("UPDATE employee_onboarding_items SET user_id='employee';UPDATE employee_i9_verifications SET user_id='foreign'");
  assert.equal((await t.admin.verifyEmployeeI9(t.verify(),t.locals)).status,409); assert.equal(t.objects.size,3);
});
if (failures.length) { console.error(failures.length + ' HR file checks failed'); process.exitCode = 1; }
