import assert from 'node:assert/strict';
import { createTestD1, loadServerModules } from './helpers/test-d1.mjs';

const now = Math.floor(Date.now() / 1000);
function fixture() {
  const test = createTestD1(), { sqlite, db } = test;
  const insert = (table, row) => { const keys = Object.keys(row); sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row)); };
  for (const id of ['a', 'b']) insert('businesses', { id, name: id, slug: id, created_at: now, updated_at: now });
  for (const [id, business, role] of [['employee','a','staff'], ['manager','a','manager'], ['owner','a','owner'], ['foreign','b','owner']]) {
    insert('users', { id, email: id+'@example.invalid', email_normalized: id+'@example.invalid', created_at: now, updated_at: now });
    insert('business_users', { business_id: business, user_id: id, role, permission_template: role==='manager'?'general_manager':role, created_at: now, updated_at: now });
  }
  insert('employee_onboarding_packages', { id:'packet', business_id:'a', user_id:'employee', status:'in_progress', sent_at:now, updated_at:now });
  const oldKey='businesses/a/employee-onboarding/employee/old.pdf', oldUrl='/api/documents/media/'+oldKey;
  insert('employee_onboarding_items', { id:'document', package_id:'packet', business_id:'a', user_id:'employee', item_type:'document', form_key:'federal_w4', title:'Federal W-4', file_url:oldUrl, file_name:'old.pdf', created_at:now });
  const objects=new Set([oldKey,'businesses/b/employee-onboarding/foreign/private.pdf']), removed=[];
  const bucket={async put(key){objects.add(key);},async delete(keys){for(const key of Array.isArray(keys)?keys:[keys]){removed.push(key);objects.delete(key);}}};
  const load=loadServerModules({'#lib/server/observability.ts':{logOperationalEvent(){},logOperationalError(){}},
    '#lib/server/operationalEvents.ts':{async recordOperationalEventBestEffort(){}}});
  const admin=load('src/lib/server/admin.ts');
  const locals={DB:db,env:{DB:db,SENSITIVE_DATA_KEY:'isolated-hr-packet-encryption-key-only-value',SENSITIVE_DATA_KEY_VERSION:'fixture'},
    MEDIA_BUCKET:bucket,businessId:'a',userId:'employee',businessRole:'staff',userRole:'user'};
  function request(fields={},upload=true) {
    const form=new FormData();for(const [key,value] of Object.entries({item_id:'document',official_form_confirmed:'1',signed_name:'Example Employee',...fields}))form.set(key,value);
    if(upload)form.set('file',new File(['%PDF-1.7 isolated fixture'], 'new.pdf',{type:'application/pdf'}));
    return new Request('https://criminiops.com/onboarding?/submit_item',{method:'POST',body:form,headers:{origin:'https://criminiops.com'}});
  }
  return {...test,insert,load,admin,locals,bucket,objects,removed,oldKey,oldUrl,request};
}
const failures=[];
async function check(label,run){const t=fixture();try{await run(t);assert.deepEqual(t.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);console.log('PASS '+label);}catch(error){failures.push(label);console.error('FAIL '+label+': '+error.message);}finally{t.close();}}

await check('unauthorized sensitive loader never returns a legacy plaintext payload, filename or signature',async t=>{
  t.insert('employee_role_permissions',{business_id:'a',user_id:'manager',permission_key:'view_sensitive_employee_data',is_enabled:0,updated_at:now});
  t.sqlite.prepare("UPDATE employee_onboarding_items SET form_payload=?,signed_name='Private signature' WHERE id='document'").run(JSON.stringify({routing_number:'PRIVATE-LEGACY-BANK',tax_identity:'PRIVATE-LEGACY-TAX'}));
  const state=await t.admin.loadEmployeeOnboarding(t.db,'employee','a',{env:t.locals.env,actorUserId:'manager',actorBusinessRole:'manager',actorPermissionTemplate:'general_manager'});
  assert.equal(JSON.stringify(state).includes('PRIVATE-LEGACY'),false);assert.equal(state.items[0].file_url,'');assert.equal(state.items[0].signed_name,'');
});
await check('active owners and employees retain their authorized sensitive access',async t=>{
  const sensitive=t.load('src/lib/server/sensitive.ts');
  assert.equal(await sensitive.canAccessEmployeeSensitiveData(t.db,'a','owner','staff','employee','staff',[]),true);
  assert.equal(await sensitive.canAccessEmployeeSensitiveData(t.db,'a','employee','staff','employee','staff',[]),true);
  const state=await t.admin.loadEmployeeOnboarding(t.db,'employee','a',{env:t.locals.env,actorUserId:'employee'});
  assert.equal(state.items[0].file_url,t.oldUrl);
});
await check('missing encryption never falls back to a plaintext form, even for an authorized reader',async t=>{
  t.sqlite.exec("UPDATE employee_onboarding_items SET item_type='form',form_key='payroll_setup',form_payload='{\"bank_name\":\"PRIVATE-LEGACY-BANK\"}' WHERE id='document'");
  const state=await t.admin.loadEmployeeOnboarding(t.db,'employee','a',{actorUserId:'owner'});
  assert.equal(JSON.stringify(state.items).includes('PRIVATE-LEGACY'),false);assert.equal(state.items[0].sensitive_redacted,true);
});
await check('custom packet uploads and acknowledgements are also redacted for a denied reader',async t=>{
  t.insert('employee_role_permissions',{business_id:'a',user_id:'manager',permission_key:'view_sensitive_employee_data',is_enabled:0,updated_at:now});
  t.sqlite.exec("UPDATE employee_onboarding_items SET form_key='',signed_name='Private signature',form_payload='{\"private\":\"PRIVATE-CUSTOM\"}' WHERE id='document'");
  const state=await t.admin.loadEmployeeOnboarding(t.db,'employee','a',{env:t.locals.env,actorUserId:'manager'});
  assert.equal(state.items[0].file_url,'');assert.equal(state.items[0].file_name,'');assert.equal(state.items[0].signed_name,'');assert.equal(JSON.stringify(state.items).includes('PRIVATE-CUSTOM'),false);
});
await check('explicit individual sensitive denial overrides an obsolete HR grant',async t=>{
  for(const [key,value] of [['hr_sensitive_access',1],['view_sensitive_employee_data',0]])t.insert('employee_role_permissions',{business_id:'a',user_id:'manager',permission_key:key,is_enabled:value,updated_at:now});
  assert.equal(await t.load('src/lib/server/sensitive.ts').canAccessEmployeeSensitiveData(t.db,'a','manager','manager','employee','general_manager',[]),false);
});
await check('foreign or revoked actors cannot use claimed owner metadata or self identity to read HR',async t=>{
  const sensitive=t.load('src/lib/server/sensitive.ts');
  assert.equal(await sensitive.canAccessEmployeeSensitiveData(t.db,'a','foreign','owner','employee','owner'),false);
  t.sqlite.exec("UPDATE business_users SET is_active=0 WHERE user_id='employee'");
  assert.equal(await sensitive.canAccessEmployeeSensitiveData(t.db,'a','employee','staff','employee','staff'),false);
});
await check('disabled identities and revoked grants fail closed immediately',async t=>{
  const sensitive=t.load('src/lib/server/sensitive.ts');
  t.sqlite.exec("UPDATE users SET is_active=0 WHERE id='owner'");
  assert.equal(await sensitive.canAccessEmployeeSensitiveData(t.db,'a','owner','owner','employee','owner'),false);
  t.sqlite.exec("UPDATE business_users SET role='staff',permission_template='staff' WHERE user_id='manager'");
  assert.equal(await sensitive.canAccessEmployeeSensitiveData(t.db,'a','manager','owner','employee','owner',['view_sensitive_employee_data']),false);
});
await check('document validation happens before any upload or previous-file deletion',async t=>{
  const result=await t.admin.submitEmployeeOnboardingItem(t.request({official_form_confirmed:'0'}),t.locals,t.locals.env);
  assert.equal(result.status,400);assert.equal(t.objects.size,2);assert.ok(t.objects.has(t.oldKey));assert.equal(t.removed.length,0);
});
await check('late D1 failure preserves the previous file and removes only the uncommitted upload',async t=>{
  t.sqlite.exec("CREATE TRIGGER fixture_document_failure BEFORE INSERT ON employee_compliance_documents BEGIN SELECT RAISE(ABORT,'isolated HR commit failure'); END");
  const result=await t.admin.submitEmployeeOnboardingItem(t.request(),t.locals,t.locals.env);
  assert.equal(result.status,503);assert.equal(t.sqlite.prepare("SELECT file_url FROM employee_onboarding_items WHERE id='document'").get().file_url,t.oldUrl);
  assert.ok(t.objects.has(t.oldKey));assert.equal(t.objects.size,2);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n,0);
});
await check('packet entering review during upload cannot be overwritten or reset',async t=>{
  const put=t.bucket.put;t.bucket.put=async key=>{await put(key);t.sqlite.exec("UPDATE employee_onboarding_packages SET status='submitted' WHERE id='packet'");};
  const result=await t.admin.submitEmployeeOnboardingItem(t.request(),t.locals,t.locals.env);
  assert.equal(result.status,409);assert.equal(t.sqlite.prepare("SELECT status FROM employee_onboarding_packages WHERE id='packet'").get().status,'submitted');
  assert.equal(t.sqlite.prepare("SELECT file_url FROM employee_onboarding_items WHERE id='document'").get().file_url,t.oldUrl);assert.equal(t.objects.size,2);
});
await check('concurrent document replacements keep the winning upload and reject the older write',async t=>{
  const put=t.bucket.put;let release,started;const paused=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);let first=true;
  t.bucket.put=async key=>{await put(key);if(first){first=false;started();await paused;}};
  const older=t.admin.submitEmployeeOnboardingItem(t.request(),t.locals,t.locals.env);await ready;
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.request(),t.locals,t.locals.env)).success,true);
  const winner=t.sqlite.prepare("SELECT file_url FROM employee_onboarding_items WHERE id='document'").get().file_url;release();
  assert.equal((await older).status,409);assert.equal(t.sqlite.prepare("SELECT file_url FROM employee_onboarding_items WHERE id='document'").get().file_url,winner);
  assert.ok(t.objects.has(winner.replace('/api/documents/media/','')));assert.equal(t.objects.size,2);
});
await check('successful replacement preserves a previous file still referenced by another packet',async t=>{
  t.insert('employee_onboarding_packages',{id:'old-packet',business_id:'a',user_id:'employee',status:'approved',sent_at:now-1,updated_at:now-1});
  t.insert('employee_onboarding_items',{id:'retained',package_id:'old-packet',business_id:'a',user_id:'employee',item_type:'document',title:'Retained file',file_url:t.oldUrl,created_at:now-1,status:'approved'});
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.request(),t.locals,t.locals.env)).success,true);assert.ok(t.objects.has(t.oldKey));
});
await check('cleanup failure after a committed replacement cannot report the saved record as failed',async t=>{
  t.bucket.delete=async()=>{throw Error('isolated R2 cleanup outage');};
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.request(),t.locals,t.locals.env)).success,true);
  assert.notEqual(t.sqlite.prepare("SELECT file_url FROM employee_onboarding_items WHERE id='document'").get().file_url,t.oldUrl);
});
await check('foreign item IDs cannot upload or delete objects',async t=>{
  const result=await t.admin.submitEmployeeOnboardingItem(t.request(),{...t.locals,businessId:'b',userId:'foreign'},t.locals.env);
  assert.equal(result.status,404);assert.equal(t.objects.size,2);assert.equal(t.removed.length,0);
});
await check('a successful document save has matching compliance metadata and a non-sensitive audit',async t=>{
  const before=t.queryCount;
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.request(),t.locals,t.locals.env)).success,true);
  const item=t.sqlite.prepare("SELECT * FROM employee_onboarding_items WHERE id='document'").get();
  const compliance=t.sqlite.prepare("SELECT * FROM employee_compliance_documents WHERE onboarding_item_id='document'").get();
  assert.equal(item.status,'submitted');assert.equal(compliance.status,item.status);assert.equal(compliance.file_url,item.file_url);assert.equal(compliance.signed_name,item.signed_name);
  assert.equal(t.objects.has(t.oldKey),false);assert.equal(t.objects.size,2);
  const audits=t.sqlite.prepare('SELECT * FROM account_audit_logs').all();assert.equal(audits.length,1);
  assert.equal(audits[0].action,'employee_onboarding_item_submitted');assert.equal(audits[0].metadata_json.includes('Example Employee'),false);
  assert.ok(t.queryCount-before<=12,'document save must have a bounded query budget');
});
await check('membership revoked during upload prevents all dependent writes',async t=>{
  const put=t.bucket.put;t.bucket.put=async key=>{await put(key);t.sqlite.exec("UPDATE business_users SET is_active=0 WHERE user_id='employee'");};
  const result=await t.admin.submitEmployeeOnboardingItem(t.request(),t.locals,t.locals.env);
  assert.equal(result.status,409);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n,0);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_compliance_documents').get().n,0);assert.equal(t.objects.size,2);
});
await check('a locked compliance document cannot be replaced',async t=>{
  t.insert('employee_compliance_documents',{id:'locked',business_id:'a',user_id:'employee',onboarding_item_id:'document',document_type:'tax_withholding',status:'approved',file_url:t.oldUrl,locked_at:now,created_at:now,updated_at:now});
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.request(),t.locals,t.locals.env)).status,409);
  assert.equal(t.sqlite.prepare("SELECT status FROM employee_compliance_documents WHERE id='locked'").get().status,'approved');assert.equal(t.objects.size,2);
});
await check('R2 upload failures preserve the existing record and report a retryable failure',async t=>{
  t.bucket.put=async()=>{throw Error('isolated storage outage');};
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.request(),t.locals,t.locals.env)).status,503);
  assert.equal(t.sqlite.prepare("SELECT file_url FROM employee_onboarding_items WHERE id='document'").get().file_url,t.oldUrl);assert.equal(t.removed.length,0);
});
await check('official forms cannot disguise a non-PDF MIME type with a PDF filename',async t=>{
  const request=t.request(),form=await request.formData();form.set('file',new File(['image'],'fake.pdf',{type:'image/png'}));
  assert.equal((await t.admin.submitEmployeeOnboardingItem(new Request(request.url,{method:'POST',body:form}),t.locals,t.locals.env)).status,400);
  assert.equal(t.objects.size,2);assert.equal(t.removed.length,0);
});
if(failures.length){console.error(failures.length+' HR packet checks failed');process.exitCode=1;}
