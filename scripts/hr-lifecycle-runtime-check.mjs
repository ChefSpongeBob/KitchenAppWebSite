import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createTestD1 } from './helpers/test-d1.mjs';

const fixture=createTestD1();
const schema=fixture.sqlite.prepare(`SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
  ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END`).all().map(row=>row.sql);fixture.close();
const require=createRequire(import.meta.url),runtimeTools=createRequire(require.resolve('wrangler/package.json'));
const {build}=runtimeTools('esbuild'),{Miniflare}=runtimeTools('miniflare');
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const {outputFiles}=await build({stdin:{resolveDir:process.cwd(),sourcefile:'hr-lifecycle-runtime.ts',contents:`
  import {submitEmployeeOnboardingItem,submitEmployeeOnboardingPacket,approveEmployeeOnboardingPackage,
    returnEmployeeOnboardingPackage,sendEmployeeOnboardingPackage,installStandardEmployeeOnboardingTemplate,
    deleteEmployeeOnboardingTemplateItem,verifyEmployeeI9} from './src/lib/server/admin.ts';
  let pauseNext=false,waiting=false;
  export default {async fetch(request,bindings) {
    const raw=bindings.DB,url=new URL(request.url),path=url.pathname,now=Math.floor(Date.now()/1000);
    const db={prepare:sql=>raw.prepare(sql),async batch(statements){
      if(pauseNext){pauseNext=false;waiting=true;for(let i=0;waiting&&i<1000;i++)await new Promise(resolve=>setTimeout(resolve,10));if(waiting)throw Error('Isolated commit pause timed out');}
      return raw.batch(statements);
    }};
    const env={...bindings,DB:db,SENSITIVE_DATA_KEY:'isolated-lifecycle-runtime-encryption-key-only-value',SENSITIVE_DATA_KEY_VERSION:'fixture',APP_BASE_URL:'https://criminiops.com'};
    const employee={DB:db,env,MEDIA_BUCKET:bindings.DOC_MEDIA,userId:'employee',businessId:'a',businessRole:'staff',businessPermissionTemplate:'staff',userRole:'user'};
    const owner={...employee,userId:'owner',businessRole:'owner',businessPermissionTemplate:'owner',userRole:'admin',businessName:'a'};
    const post=(fields,files={})=>{const body=new FormData();for(const [key,value]of Object.entries(fields))body.set(key,String(value));for(const [key,value]of Object.entries(files))body.set(key,value);return new Request(request.url,{method:'POST',body});};
    const pdf=name=>new File(['%PDF-1.7 isolated fixture'],name,{type:'application/pdf'});
    const latest=()=>db.prepare("SELECT id,status,version FROM employee_onboarding_packages WHERE business_id='a' AND user_id='employee' ORDER BY version DESC,updated_at DESC,id DESC LIMIT 1").first();
    const fields={signed_name:'Fixture Employee',legal_name:url.searchParams.get('name')||'Updated name',birthday:'1990-03-04',phone:'2025550111',address_line_1:'1 Example Lane',city:'Example',state:'CO',postal_code:'80000',
      emergency_contact_name:'Example Contact',emergency_contact_phone:'2025550122',emergency_contact_relationship:'Friend',worker_classification:'employee',start_date:'2026-11-01',pay_type:'hourly',direct_deposit_authorized:'0',official_form_confirmed:'1'};
    if(path==='/setup') {
      await raw.batch(${JSON.stringify(schema)}.map(sql=>raw.prepare(sql)));const rows=[];
      for(const id of ['a','b'])rows.push(raw.prepare('INSERT INTO businesses(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id,id,now,now));
      for(const [id,business,role]of [['owner','a','owner'],['employee','a','staff'],['other','a','staff'],['foreign','b','owner']]){
        rows.push(raw.prepare('INSERT INTO users(id,email,email_normalized,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id+'@example.invalid',id+'@example.invalid',now,now));
        rows.push(raw.prepare('INSERT INTO business_users(business_id,user_id,role,permission_template,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(business,id,role,role,now,now));
      }
      rows.push(raw.prepare("INSERT INTO employee_profiles(business_id,user_id,real_name,updated_at) VALUES('a','employee','Previous name',?)").bind(now));
      rows.push(raw.prepare("INSERT INTO employee_profiles(business_id,user_id,real_name,updated_at) VALUES('b','foreign','PRIVATE OTHER RESTAURANT',?)").bind(now));
      rows.push(raw.prepare("INSERT INTO employee_onboarding_packages(id,business_id,user_id,status,sent_at,updated_at) VALUES('packet','a','employee','in_progress',?,?)").bind(now,now));
      rows.push(raw.prepare("INSERT INTO employee_onboarding_items(id,package_id,business_id,user_id,item_type,form_key,title,created_at) VALUES('personal','packet','a','employee','form','personal_information','Personal information',?)").bind(now));
      rows.push(raw.prepare("INSERT INTO employee_employment_records(business_id,user_id,employment_status,employment_type,onboarding_package_id,created_at,updated_at) VALUES('a','employee','onboarding','employee','packet',?,?)").bind(now,now));
      await raw.batch(rows);return Response.json({ok:true});
    }
    if(path==='/pause'){pauseNext=true;return Response.json({ok:true});}
    if(path==='/waiting')return Response.json({waiting});
    if(path==='/release'){waiting=false;return Response.json({ok:true});}
    if(path==='/fail-form'){await raw.exec("CREATE TRIGGER fixture_form_failure BEFORE INSERT ON employee_compliance_documents BEGIN SELECT RAISE(ABORT,'isolated form failure');END");return Response.json({ok:true});}
    if(path==='/fail-snapshot'){await raw.exec("CREATE TRIGGER fixture_snapshot_failure BEFORE INSERT ON employee_onboarding_sensitive_snapshots BEGIN SELECT RAISE(ABORT,'isolated snapshot failure');END");return Response.json({ok:true});}
    if(path==='/clear'){await raw.exec('DROP TRIGGER IF EXISTS fixture_form_failure;DROP TRIGGER IF EXISTS fixture_snapshot_failure;');return Response.json({ok:true});}
    if(path==='/add-template'){
      const key='businesses/a/employee-onboarding/template-a/handbook.pdf';await bindings.DOC_MEDIA.put(key,'%PDF-1.7 isolated source');
      await raw.prepare("INSERT INTO employee_onboarding_template_items(id,business_id,item_type,title,source_file_url,source_file_name,created_at,updated_at) VALUES('handbook','a','acknowledgement','Handbook',?,'handbook.pdf',?,?)").bind('/api/documents/media/'+key,now,now).run();return Response.json({ok:true});
    }
    if(path==='/save-all'){
      const packet=await latest();const items=(await db.prepare('SELECT id,item_type FROM employee_onboarding_items WHERE business_id=? AND package_id=? AND user_id=?').bind('a',packet.id,'employee').all()).results;
      for(const item of items){const result=await submitEmployeeOnboardingItem(post({...fields,item_id:item.id},item.item_type==='document'?{file:pdf('completed.pdf')}:{}),employee,env);if(!result.success)return Response.json({status:result.status,error:result.data?.error});}
      const submitted=await submitEmployeeOnboardingPacket(post({package_id:packet.id}),employee);if(!submitted.success)return Response.json({status:submitted.status,error:submitted.data?.error});
      const verified=await verifyEmployeeI9(post({package_id:packet.id,document_selection:'list_a',employee_first_day:'2026-11-01',examined_at:'2026-11-02',verifier_name:'Example Verifier',verifier_title:'Manager',attested:'1'},{completed_i9:pdf('i9-completed.pdf')}),owner);
      return Response.json({status:verified.status||200,success:verified.success||false});
    }
    if(['/form','/submit','/approve','/return','/send','/install','/delete'].includes(path)){
      const packet=await latest();let result;
      if(path==='/form')result=await submitEmployeeOnboardingItem(post({...fields,item_id:'personal'}),employee,env);
      if(path==='/submit')result=await submitEmployeeOnboardingPacket(post({package_id:packet.id}),employee);
      if(path==='/approve')result=await approveEmployeeOnboardingPackage(post({package_id:packet.id}),owner);
      if(path==='/return')result=await returnEmployeeOnboardingPackage(post({package_id:packet.id,manager_note:'Please correct the form.'}),owner);
      if(path==='/send')result=await sendEmployeeOnboardingPackage(post({user_id:url.searchParams.get('target')||'employee'}),owner,'https://criminiops.com',env);
      if(path==='/install')result=await installStandardEmployeeOnboardingTemplate(post({}),owner);
      if(path==='/delete')result=await deleteEmployeeOnboardingTemplateItem(post({id:'handbook'}),owner);
      return Response.json({status:result.status||200,success:result.success||false,error:result.data?.error});
    }
    const packet=await latest();
    return Response.json({packet,packages:(await raw.prepare("SELECT id,version,status,supersedes_package_id,locked_at FROM employee_onboarding_packages WHERE business_id='a' AND user_id='employee' ORDER BY version").all()).results,
      profile:await raw.prepare("SELECT real_name FROM employee_profiles WHERE business_id='a' AND user_id='employee'").first(),
      otherProfile:await raw.prepare("SELECT real_name FROM employee_profiles WHERE business_id='b' AND user_id='foreign'").first(),
      vaults:(await raw.prepare("SELECT encrypted_payload,status FROM employee_sensitive_record_vault WHERE business_id='a' AND user_id='employee'").all()).results,
      snapshots:(await raw.prepare("SELECT package_id,encrypted_payload FROM employee_onboarding_sensitive_snapshots WHERE business_id='a' AND user_id='employee'").all()).results,
      items:(await raw.prepare("SELECT status,form_key FROM employee_onboarding_items WHERE business_id='a' AND package_id=? AND user_id='employee'").bind(packet.id).all()).results,
      templates:(await raw.prepare("SELECT form_key FROM employee_onboarding_template_items WHERE business_id='a'").all()).results,
      otherPackets:(await raw.prepare("SELECT COUNT(*) n FROM employee_onboarding_packages WHERE user_id='other'").first()).n,
      objects:(await bindings.DOC_MEDIA.list({limit:100})).objects.map(row=>row.key),
      audits:(await raw.prepare('SELECT action,metadata_json FROM account_audit_logs ORDER BY rowid').all()).results,
      foreignKeys:(await raw.prepare('PRAGMA foreign_key_check').all()).results});
  }};`},bundle:true,format:'esm',platform:'neutral',conditions:['workerd','node','production'],mainFields:['module','main'],target:'es2022',write:false,external:['cloudflare:workers'],
  plugins:[{name:'fixture-env',setup(build){build.onResolve({filter:/^\$app\/env$/},()=>({path:'env',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const dev=false;export const browser=false;export const building=false;'}));}}]});
const runtime=new Miniflare({host:'127.0.0.1',port:0,cf:false,telemetry:{enabled:false},workers:[{
  config:{name:'hr-lifecycle-runtime',compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,
    env:{DB:{type:'d1',id:'isolated-hr-lifecycle'},DOC_MEDIA:{type:'r2',name:'isolated-hr-lifecycle'}},
    manifest:{mainModule:'index.js',modules:{'index.js':{type:'esm',contents:outputFiles[0].text}}}},
  dev:{outboundService:{type:'fetcher',handler:()=>{throw Error('Lifecycle tests must not send external requests');}}}
}]});
async function request(path){const response=await runtime.dispatchFetch('https://fixture.example.invalid'+path,{method:'POST'});assert.equal(response.status,200,await response.clone().text());return response.json();}
async function paused(path,during){await request('/pause');const pending=request(path);pending.catch(()=>{});let waiting=false;for(let i=0;i<100&&!waiting;i++){waiting=(await request('/waiting')).waiting;if(!waiting)await new Promise(resolve=>setTimeout(resolve,10));}assert.equal(waiting,true);try{await during();}finally{await request('/release');}return pending;}
try{
  await request('/setup');await request('/fail-form');assert.equal((await request('/form')).status,503);
  const failed=await request('/inspect');assert.equal(failed.profile.real_name,'Previous name');assert.equal(failed.vaults.length,0);assert.equal(failed.audits.length,0);assert.equal(failed.items[0].status,'pending');await request('/clear');
  assert.equal((await paused('/form?name=Older',async()=>{assert.equal((await request('/form?name=Winner')).success,true);})).status,409);
  assert.equal((await request('/inspect')).profile.real_name,'Winner');
  assert.equal((await paused('/submit',async()=>{assert.equal((await request('/form?name=Newest')).success,true);})).status,409);
  assert.equal((await request('/submit')).success,true);
  assert.equal((await paused('/return',async()=>{assert.equal((await request('/approve')).success,true);})).status,409);
  const accepted=await request('/inspect');assert.equal(accepted.packet.status,'approved');assert.equal(accepted.snapshots.length,1);assert.ok(accepted.packages[0].locked_at);
  assert.equal((await paused('/send',async()=>{assert.equal((await request('/send')).success,true);})).status,409);
  const replacement=await request('/inspect');assert.equal(replacement.packages.length,2);assert.equal(replacement.packet.version,2);assert.equal(replacement.packages[1].supersedes_package_id,'packet');assert.deepEqual(replacement.snapshots,accepted.snapshots);
  await request('/add-template');assert.equal((await paused('/send?target=other',async()=>{assert.equal((await request('/delete')).success,true);})).status,409);
  const deleted=await request('/inspect');assert.equal(deleted.otherPackets,0);assert.equal(deleted.objects.length,0);
  assert.equal((await paused('/install',async()=>{assert.equal((await request('/install')).success,true);})).status,409);
  const installed=await request('/inspect');assert.equal(installed.templates.length,5);assert.equal(new Set(installed.templates.map(row=>row.form_key)).size,5);
  assert.equal((await request('/save-all')).success,true);await request('/fail-snapshot');
  const before=await request('/inspect');assert.equal((await request('/approve')).status,503);
  const rolledBack=await request('/inspect');assert.deepEqual(rolledBack,before);await request('/clear');
  assert.equal((await request('/approve')).success,true);const complete=await request('/inspect');
  assert.equal(complete.packet.status,'approved');assert.equal(complete.snapshots.length,4);assert.ok(complete.items.every(item=>item.status==='approved'));assert.deepEqual(complete.snapshots.filter(row=>row.package_id==='packet'),accepted.snapshots);
  const encrypted=complete.vaults.filter(record=>record.encrypted_payload);
  assert.equal(encrypted.length,3);assert.ok(encrypted.every(record=>record.status==='accepted'&&!record.encrypted_payload.includes('Newest')));
  assert.ok(complete.vaults.filter(record=>!record.encrypted_payload).every(record=>record.status==='empty'));
  assert.equal(complete.otherProfile.real_name,'PRIVATE OTHER RESTAURANT');assert.deepEqual(complete.foreignKeys,[]);
  assert.equal((await request('/form')).status,400);assert.equal((await request('/return')).status,400);
  console.log('PASS actual Workers/D1/R2: full five-form packet, encrypted profile, official PDF uploads, physical I-9, immutable accepted/replacement versions, source deletion, installation and save/review races, atomic failure rollback and tenant preservation');
}finally{await runtime.dispose();}
