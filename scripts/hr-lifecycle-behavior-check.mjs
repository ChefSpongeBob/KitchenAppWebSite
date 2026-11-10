import assert from 'node:assert/strict';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

const now=Math.floor(Date.now()/1000), failures=[];
function fixture() {
  const test=createTestD1(),{db,sqlite}=test;
  const insert=(table,row)=>{const keys=Object.keys(row);sqlite.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?')})`).run(...Object.values(row));};
  for(const id of ['a','b'])insert('businesses',{id,name:id,slug:id,status:'active',created_at:now,updated_at:now});
  for(const [id,business,role] of [['owner','a','owner'],['manager','a','manager'],['employee','a','staff'],['foreign','b','owner']]) {
    insert('users',{id,email:id+'@example.invalid',email_normalized:id+'@example.invalid',created_at:now,updated_at:now});
    insert('business_users',{business_id:business,user_id:id,role,permission_template:role==='manager'?'general_manager':role,created_at:now,updated_at:now});
  }
  insert('employee_profiles',{business_id:'a',user_id:'employee',real_name:'Previous name',emergency_contact_name:'Previous contact',updated_at:now});
  insert('business_positions',{id:'staff-position',business_id:'a',name:'Team Member',account_type:'staff',base_template:'staff',created_at:now,updated_at:now});
  insert('employee_onboarding_packages',{id:'packet',business_id:'a',user_id:'employee',status:'in_progress',sent_at:now,updated_at:now});
  insert('employee_onboarding_items',{id:'personal',package_id:'packet',business_id:'a',user_id:'employee',item_type:'form',form_key:'personal_information',title:'Personal information',created_at:now});
  insert('employee_employment_records',{business_id:'a',user_id:'employee',employment_status:'onboarding',employment_type:'employee',onboarding_package_id:'packet',created_at:now,updated_at:now});
  const events=[],emails=[],objects=new Set(['businesses/a/employee-onboarding/template-a/handbook.pdf']);
  const load=loadServerModules({'#lib/server/observability.ts':{logOperationalError(){},logOperationalEvent(){}},
    '#lib/server/operationalEvents.ts':{async recordOperationalEventBestEffort(db,event){events.push(event);}},
    '#lib/server/email.ts':{isEmailConfigured(){return true;},async sendEmployeeOnboardingPackageEmail(value){emails.push(value);return{sent:true};},async sendInviteEmail(){return{sent:true};}}});
  const env={DB:db,SENSITIVE_DATA_KEY:'isolated-lifecycle-encryption-only-key-value',SENSITIVE_DATA_KEY_VERSION:'fixture',APP_BASE_URL:'https://criminiops.com'};
  const employee={DB:db,env,userId:'employee',businessId:'a',businessRole:'staff',businessPermissionTemplate:'staff',userRole:'user'};
  const owner={...employee,userId:'owner',businessRole:'owner',businessPermissionTemplate:'owner',userRole:'admin',businessName:'a',MEDIA_BUCKET:{async put(key){objects.add(key);},async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])objects.delete(key);}}};
  const admin=load('src/lib/server/admin.ts');
  const form=(fields={})=>formRequest({item_id:'personal',signed_name:'Fixture Employee',legal_name:'Updated name',birthday:'1990-03-04',phone:'2025550111',address_line_1:'1 Example Lane',city:'Example',state:'CO',postal_code:'80000',...fields},'/onboarding');
  const packet=(fields={})=>formRequest({package_id:'packet',...fields},'/onboarding');
  const send=()=>admin.sendEmployeeOnboardingPackage(formRequest({user_id:'employee'},'/admin/onboarding'),owner,'https://criminiops.com',env);
  const clear=()=>sqlite.exec("DELETE FROM employee_onboarding_items;DELETE FROM employee_onboarding_packages;UPDATE employee_employment_records SET onboarding_package_id=NULL");
  const ready=()=>sqlite.exec("UPDATE employee_onboarding_items SET item_type='acknowledgement',form_key='',status='submitted',signed_name='Fixture Employee';UPDATE employee_onboarding_packages SET status='submitted',submitted_at=1");
  return{...test, get queryCount(){return test.queryCount;},insert,load,admin,env,employee,owner,form,packet,send,clear,ready,events,emails,objects};
}
async function check(label,run){const t=fixture();try{await run(t);assert.deepEqual(t.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);console.log('PASS '+label);}catch(error){failures.push(label);console.error('FAIL '+label+': '+error.message);}finally{t.close();}}
await check('structured-form failure rolls profile, encrypted vault, compliance, item and audits back together',async t=>{
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON employee_compliance_documents BEGIN SELECT RAISE(ABORT,'isolated compliance failure');END");
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.form(),t.employee,t.env)).status,503);
  assert.equal(t.sqlite.prepare('SELECT real_name FROM employee_profiles').get().real_name,'Previous name');
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_sensitive_record_vault').get().n,0);assert.equal(t.sqlite.prepare('SELECT status FROM employee_onboarding_items').get().status,'pending');
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n,0);
});
await check('missing encryption never writes a personal profile before returning failure',async t=>{
  const result=await t.admin.submitEmployeeOnboardingItem(t.form(),{...t.employee,env:{DB:t.db}},{DB:t.db});assert.equal(result.status,503);
  assert.equal(t.sqlite.prepare('SELECT real_name FROM employee_profiles').get().real_name,'Previous name');
});
await check('packet submit and its audit cannot partially commit',async t=>{
  t.ready();t.sqlite.exec("UPDATE employee_onboarding_packages SET status='in_progress';CREATE TRIGGER fixture_failure BEFORE INSERT ON account_audit_logs BEGIN SELECT RAISE(ABORT,'isolated audit failure');END");
  assert.equal((await t.admin.submitEmployeeOnboardingPacket(t.packet(),t.employee)).status,503);
  assert.equal(t.sqlite.prepare('SELECT status FROM employee_onboarding_packages').get().status,'in_progress');assert.equal(t.events.length,0);
});
await check('packet acceptance and its audit cannot partially commit',async t=>{
  t.ready();t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON account_audit_logs BEGIN SELECT RAISE(ABORT,'isolated audit failure');END");
  assert.equal((await t.admin.approveEmployeeOnboardingPackage(t.packet(),t.owner)).status,503);
  assert.equal(t.sqlite.prepare('SELECT status FROM employee_onboarding_packages').get().status,'submitted');assert.equal(t.sqlite.prepare('SELECT status FROM employee_onboarding_items').get().status,'submitted');assert.equal(t.events.length,0);
});
await check('standard packet installation is atomic on a late default insert failure',async t=>{
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON employee_onboarding_template_items WHEN NEW.form_key='federal_w4' BEGIN SELECT RAISE(ABORT,'isolated default failure');END");
  assert.equal((await t.admin.installStandardEmployeeOnboardingTemplate(t.packet(),t.owner)).status,503);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_onboarding_template_items').get().n,0);
});
await check('two concurrent sends create one packet version, one audit and one notification',async t=>{
  t.clear();const batch=t.db.batch;let release,started;const held=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);let first=true;
  t.db.batch=async statements=>{if(first){first=false;started();await held;}return batch(statements);};
  const older=t.send();await ready;assert.equal((await t.send()).success,true);release();assert.equal((await older).status,409);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_onboarding_packages').get().n,1);assert.equal(t.emails.length,1);assert.equal(t.events.length,1);
});
await check('an in-flight packet sender cannot commit a deleted source template',async t=>{
  t.clear();const key='businesses/a/employee-onboarding/template-a/handbook.pdf',url='/api/documents/media/'+key;
  t.insert('employee_onboarding_template_items',{id:'handbook',business_id:'a',item_type:'acknowledgement',title:'Handbook',source_file_url:url,source_file_name:'handbook.pdf',created_at:now,updated_at:now});
  const batch=t.db.batch;let first=true;
  t.db.batch=async statements=>{if(first){first=false;assert.equal((await t.admin.deleteEmployeeOnboardingTemplateItem(formRequest({id:'handbook'}),t.owner)).success,true);}return batch(statements);};
  assert.equal((await t.send()).status,409);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_onboarding_packages').get().n,0);assert.equal(t.emails.length,0);assert.equal(t.objects.has(key),false);
});
await check('a saved contractor classification cannot be bypassed by the packet-send field',async t=>{
  t.clear();t.sqlite.exec("UPDATE employee_employment_records SET employment_type='contractor'");assert.equal((await t.send()).status,400);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_onboarding_packages').get().n,0);
});
await check('restricted readers cannot trigger personal-profile hydration writes',async t=>{
  t.sqlite.exec("UPDATE employee_profiles SET real_name='Stored name',phone='2025550111',birthday='1990-03-04',address_line_1='1 Lane',city='Example',state='CO',postal_code='80000'");
  await t.admin.loadEmployeeOnboarding(t.db,'employee','a',{env:t.env,actorUserId:'foreign',actorBusinessRole:'owner'});
  assert.equal(t.sqlite.prepare('SELECT status FROM employee_onboarding_items').get().status,'pending');assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_sensitive_record_vault').get().n,0);
});
await check('accepted packets are never hydrated or rewritten from later profile data',async t=>{
  t.sqlite.exec("UPDATE employee_profiles SET phone='2025550111',birthday='1990-03-04',address_line_1='1 Lane',city='Example',state='CO',postal_code='80000';UPDATE employee_onboarding_packages SET status='approved',locked_at=1");
  await t.admin.loadEmployeeOnboarding(t.db,'employee','a',{env:t.env,actorUserId:'employee'});
  assert.equal(t.sqlite.prepare('SELECT status FROM employee_onboarding_items').get().status,'pending');assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_sensitive_record_vault').get().n,0);
});
await check('acceptance cannot approve a sensitive structured form without an encrypted record',async t=>{
  t.sqlite.exec("UPDATE employee_onboarding_items SET status='submitted';UPDATE employee_onboarding_packages SET status='submitted'");
  assert.equal((await t.admin.approveEmployeeOnboardingPackage(t.packet(),t.owner)).status,400);assert.equal(t.sqlite.prepare('SELECT status FROM employee_onboarding_packages').get().status,'submitted');
});
await check('invite creation never leaves an unaudited invitation or sends mail after a failed save',async t=>{
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON account_audit_logs WHEN NEW.action='invite_created' BEGIN SELECT RAISE(ABORT,'isolated invite audit failure');END");
  const result=await t.admin.createUserInvite(formRequest({email:'new@example.invalid',position_id:'staff-position'}),t.owner,'https://criminiops.com',t.env);
  assert.equal(result.status,503);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM business_invites').get().n,0);
});
await check('invite revocation never partially commits when its audit fails',async t=>{
  t.insert('business_invites',{id:'invite',business_id:'a',email:'new@example.invalid',email_normalized:'new@example.invalid',invite_code:'ISOLATED-INVITE',role:'staff',permission_template:'staff',invited_by:'owner',created_at:now,expires_at:now+3600});
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON account_audit_logs WHEN NEW.action='invite_revoked' BEGIN SELECT RAISE(ABORT,'isolated revoke audit failure');END");
  assert.equal((await t.admin.revokeUserInvite(formRequest({invite_id:'invite'}),t.owner)).status,503);
  assert.equal(t.sqlite.prepare("SELECT revoked_at FROM business_invites WHERE id='invite'").get().revoked_at,null);
});
await check('invite creation rejects forged owner metadata for an ordinary employee',async t=>{
  assert.equal((await t.admin.createUserInvite(formRequest({email:'new@example.invalid',position_id:'staff-position'}),{...t.owner,userId:'employee'},'https://criminiops.com',t.env)).status,403);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM business_invites').get().n,0);
});
await check('HR copy-policy save and audit roll back together',async t=>{
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON account_audit_logs WHEN NEW.action='business_i9_policy_updated' BEGIN SELECT RAISE(ABORT,'isolated policy audit failure');END");
  assert.equal((await t.admin.saveBusinessHrSettings(formRequest({retain_i9_document_copies:1}),t.owner)).status,503);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM business_hr_settings').get().n,0);
});
async function holdFirstBatch(t,operation,during) {
  const batch=t.db.batch;let release,started;const held=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);let first=true;
  t.db.batch=async statements=>{if(first){first=false;started();await held;}return batch(statements);};
  const pending=operation();pending.catch(()=>{});await ready;
  try{await during();}finally{release();}
  return pending;
}
await check('two standard-form installers cannot create duplicate form keys',async t=>{
  const install=()=>t.admin.installStandardEmployeeOnboardingTemplate(t.packet(),t.owner);
  assert.equal((await holdFirstBatch(t,install,async()=>{assert.equal((await install()).success,true);})).status,409);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_onboarding_template_items').get().n,5);
  assert.equal(t.sqlite.prepare('SELECT COUNT(DISTINCT form_key) n FROM employee_onboarding_template_items').get().n,5);
});
await check('structured forms encrypt data and keep profile and compliance metadata consistent',async t=>{
  const before=t.queryCount;assert.equal((await t.admin.submitEmployeeOnboardingItem(t.form(),t.employee,t.env)).success,true);
  const item=t.sqlite.prepare('SELECT * FROM employee_onboarding_items').get(),vault=t.sqlite.prepare('SELECT * FROM employee_sensitive_record_vault').get();
  assert.equal(item.status,'submitted');assert.ok(!item.form_payload.includes('1 Example Lane'));assert.ok(!vault.encrypted_payload.includes('Updated name'));
  assert.equal(t.sqlite.prepare('SELECT real_name FROM employee_profiles').get().real_name,'Updated name');assert.equal(t.sqlite.prepare('SELECT status FROM employee_compliance_documents').get().status,'submitted');
  const state=await t.admin.loadEmployeeOnboarding(t.db,'employee','a',{env:t.env,actorUserId:'employee'});
  assert.equal(JSON.parse(state.items[0].form_payload).legal_name,'Updated name');assert.ok(t.queryCount-before<=24,'bounded form save and authorized read');
});
await check('competing same-second form saves cannot silently overwrite the winner',async t=>{
  const save=name=>t.admin.submitEmployeeOnboardingItem(t.form({legal_name:name}),t.employee,t.env);
  assert.equal((await holdFirstBatch(t,()=>save('Older'),async()=>{assert.equal((await save('Winner')).success,true);})).status,409);
  assert.equal(t.sqlite.prepare('SELECT real_name FROM employee_profiles').get().real_name,'Winner');
  const state=await t.admin.loadEmployeeOnboarding(t.db,'employee','a',{env:t.env,actorUserId:'employee'});assert.equal(JSON.parse(state.items[0].form_payload).legal_name,'Winner');
});
await check('personal and emergency form saves do not erase each other profile columns',async t=>{
  t.insert('employee_onboarding_items',{id:'emergency',package_id:'packet',business_id:'a',user_id:'employee',item_type:'form',form_key:'emergency_contact',title:'Emergency contact',created_at:now});
  const emergency=()=>t.admin.submitEmployeeOnboardingItem(t.form({item_id:'emergency',emergency_contact_name:'New contact',emergency_contact_phone:'2025550122',emergency_contact_relationship:'Friend'}),t.employee,t.env);
  const result=await holdFirstBatch(t,emergency,async()=>{assert.equal((await t.admin.submitEmployeeOnboardingItem(t.form(),t.employee,t.env)).success,true);});
  if(result.status===409)assert.equal((await emergency()).success,true);else assert.equal(result.success,true);
  const profile=t.sqlite.prepare('SELECT * FROM employee_profiles').get();assert.equal(profile.real_name,'Updated name');assert.equal(profile.emergency_contact_name,'New contact');
});
await check('payroll saves keep bank references encrypted without editing ordinary profile fields',async t=>{
  t.sqlite.exec("UPDATE employee_onboarding_items SET form_key='payroll_setup',title='Payroll setup'");
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.form({worker_classification:'employee',start_date:'2026-11-01',pay_type:'hourly',direct_deposit_authorized:1,bank_name:'Fixture bank',routing_last_four:'1234',account_last_four:'5678'}),t.employee,t.env)).success,true);
  const state=await t.admin.loadEmployeeOnboarding(t.db,'employee','a',{env:t.env,actorUserId:'employee'});
  assert.equal(JSON.parse(state.items[0].form_payload).bank_name,'Fixture bank');assert.equal(t.sqlite.prepare('SELECT real_name FROM employee_profiles').get().real_name,'Previous name');
});
await check('acknowledgement requires explicit confirmation and typed name without HR payload writes',async t=>{
  t.sqlite.exec("UPDATE employee_onboarding_items SET item_type='acknowledgement',form_key=''");
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.form(),t.employee,t.env)).status,400);
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.form({acknowledged:1,signed_name:''}),t.employee,t.env)).status,400);
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.form({acknowledged:1}),t.employee,t.env)).success,true);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_sensitive_record_vault').get().n,0);
});
await check('returned packets can be corrected, resubmitted and accepted exactly once',async t=>{
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.form(),t.employee,t.env)).success,true);
  assert.equal((await t.admin.submitEmployeeOnboardingPacket(t.packet(),t.employee)).success,true);
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.form(),t.employee,t.env)).status,400);
  assert.equal((await t.admin.returnEmployeeOnboardingPackage(t.packet({manager_note:'Please correct your address.'}),t.owner)).success,true);
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.form({address_line_1:'2 Corrected Lane'}),t.employee,t.env)).success,true);
  assert.equal((await t.admin.submitEmployeeOnboardingPacket(t.packet(),t.employee)).success,true);
  assert.equal((await t.admin.approveEmployeeOnboardingPackage(t.packet(),t.owner)).success,true);
  assert.equal((await t.admin.approveEmployeeOnboardingPackage(t.packet(),t.owner)).status,400);
  assert.equal((await t.admin.returnEmployeeOnboardingPackage(t.packet({manager_note:'Cannot reopen'}),t.owner)).status,400);
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.form(),t.employee,t.env)).status,400);
  const packet=t.sqlite.prepare('SELECT * FROM employee_onboarding_packages').get();assert.equal(packet.status,'approved');assert.ok(packet.locked_at);
  assert.equal(t.sqlite.prepare('SELECT status FROM employee_compliance_documents').get().status,'approved');assert.equal(t.sqlite.prepare('SELECT employment_status FROM employee_employment_records').get().employment_status,'active');
  const audit=t.sqlite.prepare("SELECT metadata_json FROM account_audit_logs WHERE action='employee_onboarding_packet_returned'").get();assert.ok(!audit.metadata_json.includes('Please correct'));
});
await check('acceptance preserves an immutable encrypted version when a replacement packet changes the profile',async t=>{
  await t.admin.submitEmployeeOnboardingItem(t.form(),t.employee,t.env);await t.admin.submitEmployeeOnboardingPacket(t.packet(),t.employee);assert.equal((await t.admin.approveEmployeeOnboardingPackage(t.packet(),t.owner)).success,true);
  const snapshot=t.sqlite.prepare('SELECT * FROM employee_onboarding_sensitive_snapshots').get();
  assert.equal((await t.send()).success,true);const next=t.sqlite.prepare('SELECT id,version,supersedes_package_id FROM employee_onboarding_packages WHERE id<>?').get('packet');
  assert.equal(next.version,2);assert.equal(next.supersedes_package_id,'packet');
  const item=t.sqlite.prepare("SELECT id FROM employee_onboarding_items WHERE package_id=? AND form_key='personal_information'").get(next.id);
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.form({item_id:item.id,legal_name:'Later name'}),t.employee,t.env)).success,true);
  assert.deepEqual(t.sqlite.prepare('SELECT * FROM employee_onboarding_sensitive_snapshots').get(),snapshot);
  const decoded=await t.load('src/lib/server/sensitive.ts').decryptSensitiveJsonPayload(t.env,snapshot,{businessId:'a',userId:'employee',recordScope:'personal',recordType:'profile'});assert.equal(decoded.legal_name,'Updated name');
  assert.equal(t.sqlite.prepare("SELECT status FROM employee_onboarding_packages WHERE id='packet'").get().status,'approved');
});
await check('late snapshot failure rolls all acceptance writes and audits back',async t=>{
  await t.admin.submitEmployeeOnboardingItem(t.form(),t.employee,t.env);await t.admin.submitEmployeeOnboardingPacket(t.packet(),t.employee);
  const before=t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n;
  t.sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON employee_onboarding_sensitive_snapshots BEGIN SELECT RAISE(ABORT,'isolated snapshot failure');END");
  assert.equal((await t.admin.approveEmployeeOnboardingPackage(t.packet(),t.owner)).status,503);
  assert.equal(t.sqlite.prepare('SELECT status FROM employee_onboarding_packages').get().status,'submitted');assert.equal(t.sqlite.prepare('SELECT status FROM employee_onboarding_items').get().status,'submitted');
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n,before);assert.equal(t.sqlite.prepare('SELECT status FROM employee_sensitive_record_vault').get().status,'active');
});
await check('an accepted legacy packet without its snapshot never falls back to a newer vault',async t=>{
  await t.admin.submitEmployeeOnboardingItem(t.form(),t.employee,t.env);t.sqlite.exec("UPDATE employee_onboarding_packages SET status='approved',locked_at=1");
  const state=await t.admin.loadEmployeeOnboarding(t.db,'employee','a',{env:t.env,actorUserId:'employee'});assert.ok(!state.items[0].form_payload.includes('Updated name'));assert.equal(state.items[0].sensitive_redacted,true);
});
await check('hydration failure is read-safe and leaves profile-backed forms pending',async t=>{
  t.sqlite.exec("UPDATE employee_profiles SET phone='2025550111',birthday='1990-03-04',address_line_1='1 Lane',city='Example',state='CO',postal_code='80000';CREATE TRIGGER fixture_failure BEFORE INSERT ON employee_compliance_documents BEGIN SELECT RAISE(ABORT,'isolated hydration failure');END");
  const state=await t.admin.loadEmployeeOnboarding(t.db,'employee','a',{env:t.env,actorUserId:'employee'});assert.equal(state.items[0].status,'pending');assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_sensitive_record_vault').get().n,0);
});
for(const kind of ['submit','approve','return']) {
  await check(kind+' rejects access removed immediately before commit',async t=>{
    t.ready();if(kind==='submit')t.sqlite.exec("UPDATE employee_onboarding_packages SET status='in_progress'");
    const batch=t.db.batch;t.db.batch=async statements=>{t.sqlite.prepare('UPDATE business_users SET is_active=0 WHERE user_id=?').run(kind==='submit'?'employee':'owner');return batch(statements);};
    const result=kind==='submit'?await t.admin.submitEmployeeOnboardingPacket(t.packet(),t.employee):kind==='approve'?await t.admin.approveEmployeeOnboardingPackage(t.packet(),t.owner):await t.admin.returnEmployeeOnboardingPackage(t.packet({manager_note:'Correction'}),t.owner);
    assert.equal(result.status,409);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n,0);assert.equal(t.events.length,0);
  });
  await check(kind+' recovers a lost successful commit response without duplicate events',async t=>{
    t.ready();if(kind==='submit')t.sqlite.exec("UPDATE employee_onboarding_packages SET status='in_progress'");
    const batch=t.db.batch;t.db.batch=async statements=>{await batch(statements);throw Error('isolated lost response');};
    const result=kind==='submit'?await t.admin.submitEmployeeOnboardingPacket(t.packet(),t.employee):kind==='approve'?await t.admin.approveEmployeeOnboardingPackage(t.packet(),t.owner):await t.admin.returnEmployeeOnboardingPackage(t.packet({manager_note:'Correction'}),t.owner);
    assert.equal(result.success,true);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM account_audit_logs').get().n,1);assert.equal(t.events.length,1);
  });
}
await check('competing acceptance and return cannot both succeed or unlock an accepted packet',async t=>{
  t.ready();const result=await holdFirstBatch(t,()=>t.admin.returnEmployeeOnboardingPackage(t.packet({manager_note:'Correction'}),t.owner),async()=>{assert.equal((await t.admin.approveEmployeeOnboardingPackage(t.packet(),t.owner)).success,true);});
  assert.equal(result.status,409);assert.equal(t.sqlite.prepare('SELECT status FROM employee_onboarding_packages').get().status,'approved');assert.equal(t.events.length,1);
});
await check('final submit checks every item again at commit instead of relying on stale counts',async t=>{
  t.ready();t.sqlite.exec("UPDATE employee_onboarding_packages SET status='in_progress'");const batch=t.db.batch;
  t.db.batch=async statements=>{t.sqlite.exec("UPDATE employee_onboarding_items SET status='needs_changes'");return batch(statements);};
  assert.equal((await t.admin.submitEmployeeOnboardingPacket(t.packet(),t.employee)).status,409);assert.equal(t.sqlite.prepare('SELECT status FROM employee_onboarding_packages').get().status,'in_progress');
});
await check('old packet IDs cannot overwrite a newer version or become the latest through updated_at',async t=>{
  t.insert('employee_onboarding_packages',{id:'newer',business_id:'a',user_id:'employee',status:'sent',version:2,sent_at:now,updated_at:now-1});
  assert.equal((await t.admin.submitEmployeeOnboardingItem(t.form(),t.employee,t.env)).status,409);
  t.ready();assert.equal((await t.admin.approveEmployeeOnboardingPackage(t.packet(),t.owner)).status,409);
  const state=await t.admin.loadEmployeeOnboarding(t.db,'employee','a',{env:t.env,actorUserId:'employee'});assert.equal(state.package.id,'newer');
});
await check('HR review denies foreign IDs and an explicitly restricted manager despite forged owner metadata',async t=>{
  t.ready();assert.equal((await t.admin.approveEmployeeOnboardingPackage(t.packet(),{...t.owner,businessId:'b',userId:'foreign'})).status,404);
  for(const [permission_key,is_enabled] of [['view_sensitive_employee_data',0],['hr_sensitive_access',1]])t.insert('employee_role_permissions',{business_id:'a',user_id:'manager',permission_key,is_enabled,updated_at:now});
  assert.equal((await t.admin.approveEmployeeOnboardingPackage(t.packet(),{...t.owner,userId:'manager'})).status,403);
});
await check('owner packets remain optional and are created only on the explicit send action',async t=>{
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM employee_onboarding_packages WHERE user_id='owner'").get().n,0);
  assert.equal((await t.admin.loadEmployeeOnboarding(t.db,'owner','a',{env:t.env,actorUserId:'owner'})).package,null);
  assert.equal((await t.admin.sendEmployeeOnboardingPackage(formRequest({user_id:'owner'}),t.owner,'https://criminiops.com',t.env)).success,true);
  assert.equal(t.sqlite.prepare("SELECT employment_type FROM employee_employment_records WHERE user_id='owner'").get().employment_type,'owner');
  const dashboard=await t.admin.loadEmployeeOnboardingDashboard(t.db,'a');assert.ok(dashboard.some(row=>row.user_id==='owner'&&row.package_status==='sent'));
});
await check('I-9 presence requires physical verification before final acceptance',async t=>{
  t.ready();t.insert('employee_onboarding_items',{id:'i9',package_id:'packet',business_id:'a',user_id:'employee',item_type:'document',form_key:'federal_i9',title:'Federal I-9',status:'submitted',created_at:now});
  assert.equal((await t.admin.approveEmployeeOnboardingPackage(t.packet(),t.owner)).status,400);
});
await check('saved invitation departments and position are rechecked at commit',async t=>{
  const batch=t.db.batch; t.db.batch=async statements=>{t.sqlite.exec("UPDATE business_positions SET base_template='general_manager',account_type='manager' WHERE id='staff-position'");return batch(statements);};
  assert.equal((await t.admin.createUserInvite(formRequest({email:'new@example.invalid',position_id:'staff-position'}),t.owner,'https://criminiops.com',t.env)).status,409);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM business_invites').get().n,0);
});
await check('invitation revoke rejects acceptance that wins the race',async t=>{
  t.insert('business_invites',{id:'invite',business_id:'a',email:'new@example.invalid',email_normalized:'new@example.invalid',invite_code:'ISOLATED-INVITE',role:'staff',permission_template:'staff',invited_by:'owner',created_at:now});
  const batch=t.db.batch;t.db.batch=async statements=>{t.sqlite.exec("UPDATE business_invites SET used_at=1,used_by_user_id='employee'");return batch(statements);};
  assert.equal((await t.admin.revokeUserInvite(formRequest({invite_id:'invite'}),t.owner)).status,409);assert.equal(t.sqlite.prepare('SELECT revoked_at FROM business_invites').get().revoked_at,null);
});
await check('default packet sending has bounded D1 work and no per-item network calls',async t=>{
  t.clear();const before=t.queryCount;assert.equal((await t.send()).success,true);assert.ok(t.queryCount-before<=35,'default packet send query budget');assert.equal(t.emails.length,1);assert.equal(t.events.length,1);
});
await check('manager packet overview counts only current versions without losing retained history',async t=>{
  t.insert('employee_onboarding_packages',{id:'archived',business_id:'a',user_id:'employee',status:'approved',sent_at:now-1,updated_at:now+1000,version:1});
  t.sqlite.exec("UPDATE employee_onboarding_packages SET version=2 WHERE id='packet'");
  t.insert('employee_onboarding_items',{id:'old-item',package_id:'archived',business_id:'a',user_id:'employee',item_type:'document',title:'Archived',status:'approved',created_at:now-1});
  const rows=await t.admin.loadEmployeeOnboardingDashboard(t.db,'a');const row=rows.find(row=>row.user_id==='employee');assert.equal(row.package_id,'packet');assert.equal(row.total_items,1);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM employee_onboarding_packages').get().n,2);
});
for(const template of ['hr_manager','hr_consultant','consultant','contractor']) {
  await check(template+' respects its actual review and sensitive-access defaults',async t=>{
    t.ready();t.sqlite.prepare("UPDATE business_users SET role='external',permission_template=? WHERE user_id='manager'").run(template);
    const result=await t.admin.approveEmployeeOnboardingPackage(t.packet(),{...t.owner,userId:'manager'});
    if(template==='hr_manager'||template==='hr_consultant')assert.equal(result.success,true);else assert.equal(result.status,403);
  });
}
await check('denied HR readers receive no correction notes or private source metadata from current or historical packets',async t=>{
  t.sqlite.exec("UPDATE employee_onboarding_items SET manager_note='PRIVATE ITEM NOTE',source_file_url='/api/documents/media/PRIVATE SOURCE',source_file_name='PRIVATE ID.pdf';UPDATE employee_onboarding_packages SET manager_note='PRIVATE PACKET NOTE'");
  t.insert('employee_onboarding_packages',{id:'historical',business_id:'a',user_id:'employee',status:'approved',manager_note:'PRIVATE HISTORY NOTE',sent_at:now-1,updated_at:now-1});
  const state=await t.admin.loadEmployeeOnboarding(t.db,'employee','a',{env:t.env,actorUserId:'foreign',actorBusinessRole:'owner'});
  assert.ok(!JSON.stringify(state).includes('PRIVATE'));assert.equal(state.items[0].source_file_url,'');assert.equal(state.items[0].source_file_name,'');
});
if(failures.length){console.error(failures.length+' lifecycle checks failed');process.exitCode=1;}
