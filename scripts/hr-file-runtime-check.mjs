import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createTestD1 } from './helpers/test-d1.mjs';

const fixture = createTestD1();
const schema = fixture.sqlite.prepare(`SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
  ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END`).all().map(row => row.sql);
fixture.close();
const require = createRequire(import.meta.url), runtimeTools = createRequire(require.resolve('wrangler/package.json'));
const { build } = runtimeTools('esbuild'), { Miniflare } = runtimeTools('miniflare');
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const templateKey = 'businesses/a/employee-onboarding/template-a/old.pdf';
const i9Key = 'businesses/a/employee-onboarding/employee/i9-old.pdf';
const foreignKey = 'businesses/b/employee-onboarding/foreign/private.pdf';
const { outputFiles } = await build({
  stdin: { resolveDir: process.cwd(), sourcefile: 'hr-file-runtime.ts', contents: `
    import {updateEmployeeOnboardingTemplateItem,deleteEmployeeOnboardingTemplateItem,verifyEmployeeI9} from './src/lib/server/admin.ts';
    import {GET as media} from './src/routes/api/documents/media/[...key]/+server.ts';
    let pauseNext=false,waiting=false;
    export default {async fetch(request,bindings) {
      const db=bindings.DB,now=Math.floor(Date.now()/1000),url=new URL(request.url),path=url.pathname;
      const templateKey=${JSON.stringify(templateKey)},i9Key=${JSON.stringify(i9Key)},foreignKey=${JSON.stringify(foreignKey)};
      const fileUrl=key=>'/api/documents/media/'+key;
      if(path==='/setup') {
        await db.batch(${JSON.stringify(schema)}.map(sql=>db.prepare(sql)));
        const statements=[];
        for(const id of ['a','b']) statements.push(db.prepare('INSERT INTO businesses(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id,id,now,now));
        for(const [id,business,role] of [['owner','a','owner'],['employee','a','staff'],['manager','a','manager'],['foreign','b','owner']]) {
          statements.push(db.prepare('INSERT INTO users(id,email,email_normalized,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id+'@example.invalid',id+'@example.invalid',now,now));
          statements.push(db.prepare('INSERT INTO business_users(business_id,user_id,role,permission_template,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(business,id,role,role==='manager'?'general_manager':role,now,now));
        }
        statements.push(db.prepare("INSERT INTO employee_onboarding_template_items(id,business_id,item_type,title,source_file_url,source_file_name,created_at,updated_at,created_by) VALUES('template','a','acknowledgement','Handbook',?,'old.pdf',?,?,'owner')").bind(fileUrl(templateKey),now,now));
        statements.push(db.prepare("INSERT INTO employee_onboarding_packages(id,business_id,user_id,status,sent_at,submitted_at,updated_at) VALUES('packet','a','employee','submitted',?,?,?)").bind(now,now,now));
        statements.push(db.prepare("INSERT INTO employee_onboarding_items(id,package_id,business_id,user_id,item_type,form_key,title,status,source_file_url,created_at) VALUES('i9','packet','a','employee','document','federal_i9','Federal I-9','submitted',?,?)").bind(fileUrl(templateKey),now));
        statements.push(db.prepare("INSERT INTO employee_i9_verifications(id,business_id,user_id,package_id,status,completed_i9_file_url,completed_i9_file_name,created_at,updated_at) VALUES('verification','a','employee','packet','pending',?,'i9-old.pdf',?,?)").bind(fileUrl(i9Key),now,now));
        statements.push(db.prepare("INSERT INTO business_hr_settings(business_id,retain_i9_document_copies,updated_at) VALUES('a',1,?)").bind(now));
        statements.push(db.prepare("INSERT INTO employee_role_permissions(business_id,user_id,permission_key,is_enabled,updated_at) VALUES('a','manager','view_sensitive_employee_data',0,?)").bind(now));
        await db.batch(statements);
        for(const key of [templateKey,i9Key,foreignKey]) await bindings.DOC_MEDIA.put(key,'%PDF-1.7 isolated private fixture',{httpMetadata:{contentType:'application/pdf'}});
        return Response.json({ok:true});
      }
      if(path==='/fail') {await db.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON employee_i9_document_copies BEGIN SELECT RAISE(ABORT,'isolated copy failure'); END");return Response.json({ok:true});}
      if(path==='/clear') {await db.exec('DROP TRIGGER fixture_failure');return Response.json({ok:true});}
      if(path==='/pause') {pauseNext=true;return Response.json({ok:true});}
      if(path==='/waiting') return Response.json({waiting});
      if(path==='/release') {waiting=false;return Response.json({ok:true});}
      if(path==='/revoke') {await db.exec("UPDATE business_users SET is_active=0 WHERE user_id='owner'");return Response.json({ok:true});}
      if(path==='/restore') {await db.exec("UPDATE business_users SET is_active=1 WHERE user_id='owner'");return Response.json({ok:true});}
      const actor=url.searchParams.get('actor')||'owner',businessId=actor==='foreign'?'b':'a';
      const bucket={async put(...args){const result=await bindings.DOC_MEDIA.put(...args);if(pauseNext){pauseNext=false;waiting=true;for(let i=0;waiting&&i<1000;i++)await new Promise(resolve=>setTimeout(resolve,10));if(waiting)throw Error('Isolated upload pause timed out');}return result;},delete:keys=>bindings.DOC_MEDIA.delete(keys)};
      const locals={DB:db,env:bindings,MEDIA_BUCKET:bucket,userId:actor,businessId,businessRole:'owner',businessPermissionTemplate:'owner',userRole:'admin'};
      if(path==='/template'||path==='/verify'||path==='/delete') {
        const form=new FormData(),pdf=name=>new File(['%PDF-1.7 isolated new fixture'],name,{type:'application/pdf'});
        if(path==='/template') {
          for(const [key,value] of Object.entries({id:'template',item_type:'acknowledgement',title:url.searchParams.get('title')||'Updated handbook',existing_source_file_url:fileUrl(foreignKey)}))form.set(key,value);
          form.set('source_file',pdf('handbook.pdf'));
        } else if(path==='/verify') {
          for(const [key,value] of Object.entries({package_id:'packet',document_selection:'list_a',employee_first_day:'2026-11-01',examined_at:'2026-11-02',verifier_name:url.searchParams.get('name')||'Example verifier',verifier_title:'Manager',attested:'1'}))form.set(key,value);
          form.set('completed_i9',pdf('completed.pdf'));form.set('document_copies',pdf('copy.pdf'));
        } else form.set('id','template');
        const action=path==='/template'?updateEmployeeOnboardingTemplateItem:path==='/verify'?verifyEmployeeI9:deleteEmployeeOnboardingTemplateItem;
        const result=await action(new Request(request.url,{method:'POST',body:form}),locals);
        return Response.json({status:result.status||200,success:result.success||false});
      }
      if(path==='/media') {
        const key=url.searchParams.get('foreign')?foreignKey:(await db.prepare("SELECT completed_i9_file_url FROM employee_i9_verifications WHERE id='verification'").first()).completed_i9_file_url.replace('/api/documents/media/','');
        return media({params:{key},locals,request});
      }
      return Response.json({template:await db.prepare("SELECT title,source_file_url FROM employee_onboarding_template_items WHERE id='template'").first(),
        verification:await db.prepare("SELECT status,verifier_name,completed_i9_file_url FROM employee_i9_verifications WHERE id='verification'").first(),
        copies:(await db.prepare('SELECT COUNT(*) n FROM employee_i9_document_copies').first()).n,
        audits:(await db.prepare('SELECT COUNT(*) n FROM account_audit_logs').first()).n,
        sensitiveAudits:(await db.prepare("SELECT COUNT(*) n FROM employee_sensitive_record_audit WHERE action='employee_i9_physically_verified'").first()).n,
        objects:(await bindings.DOC_MEDIA.list({limit:100})).objects.map(row=>row.key),
        foreignKeys:(await db.prepare('PRAGMA foreign_key_check').all()).results});
    }};` },
  bundle: true, format: 'esm', platform: 'neutral', conditions: ['workerd', 'node', 'production'],
  mainFields: ['module', 'main'], target: 'es2022', write: false, external: ['cloudflare:workers'],
  plugins: [{ name: 'fixture-env', setup(build) {
    build.onResolve({ filter: /^\$app\/env$/ }, () => ({ path: 'env', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const dev=false;export const browser=false;export const building=false;' }));
  } }]
});
const runtime = new Miniflare({ host: '127.0.0.1', port: 0, cf: false, telemetry: { enabled: false }, workers: [{
  config: { name: 'hr-file-runtime', compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
    env: { DB: { type: 'd1', id: 'isolated-hr-files' }, DOC_MEDIA: { type: 'r2', name: 'isolated-hr-files' } },
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: outputFiles[0].text } } } },
  dev: { outboundService: { type: 'fetcher', handler: () => { throw Error('HR file tests must not send external requests'); } } }
}] });
async function response(path) { return runtime.dispatchFetch('https://fixture.example.invalid' + path, { method: /^\/(template|verify|delete)/.test(path) ? 'POST' : 'GET' }); }
async function request(path) {
  const result = await response(path); assert.equal(result.status, 200, await result.clone().text()); return result.json();
}
async function paused(path, during) {
  await request('/pause'); const pending=request(path); pending.catch(()=>{});
  let waiting=false;
  for(let i=0;i<100&&!waiting;i++){waiting=(await request('/waiting')).waiting;if(!waiting)await new Promise(resolve=>setTimeout(resolve,10));}
  assert.equal(waiting,true);
  try {await during();} finally {await request('/release');}
  return pending;
}
try {
  await request('/setup'); await request('/fail');
  assert.equal((await request('/verify')).status,503);
  const failed=await request('/inspect');
  assert.equal(failed.verification.status,'pending');assert.equal(failed.objects.length,3);assert.equal(failed.audits,0);assert.equal(failed.copies,0);assert.equal(failed.sensitiveAudits,0);
  await request('/clear');
  assert.equal((await paused('/template',async()=>{assert.equal((await request('/template?title=Winner')).success,true);})).status,409);
  const template=await request('/inspect');assert.equal(template.template.title,'Winner');assert.equal(template.objects.length,4);assert.ok(template.objects.includes(templateKey));assert.ok(template.objects.includes(foreignKey));
  assert.equal((await paused('/verify',async()=>{assert.equal((await request('/verify?name=Winner')).success,true);})).status,409);
  const verified=await request('/inspect');assert.equal(verified.verification.verifier_name,'Winner');assert.equal(verified.copies,1);assert.equal(verified.sensitiveAudits,1);assert.equal(verified.audits,2);assert.equal(verified.objects.length,5);assert.ok(!verified.objects.includes(i9Key));
  assert.equal((await paused('/verify',async()=>{await request('/revoke');})).status,409);
  const revoked=await request('/inspect');assert.deepEqual(revoked,verified);await request('/restore');
  assert.equal((await request('/verify?actor=foreign')).status,404);
  assert.equal((await request('/template?actor=foreign')).status,404);
  const own=await response('/media');assert.equal(own.status,200);assert.equal(own.headers.get('cache-control'),'private, no-store');assert.equal(own.headers.get('x-content-type-options'),'nosniff');
  assert.equal((await response('/media?actor=manager')).status,403);assert.equal((await response('/media?foreign=1')).status,404);
  assert.equal((await request('/delete')).success,true);
  const deleted=await request('/inspect');assert.equal(deleted.template,null);assert.equal(deleted.objects.length,4);assert.ok(deleted.objects.includes(templateKey));assert.ok(deleted.objects.includes(foreignKey));assert.deepEqual(deleted.foreignKeys,[]);
  console.log('PASS actual Workers/D1/R2: atomic I-9 rollback, barrier-controlled template/verification races, revoked authority, retained files, scoped deletes and private media denial');
} finally {await runtime.dispose();}
