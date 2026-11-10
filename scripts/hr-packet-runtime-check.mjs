import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createTestD1 } from './helpers/test-d1.mjs';

const fixture = createTestD1();
const schema = fixture.sqlite.prepare(`SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
  ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END`).all().map(row => row.sql);
fixture.close();
const require = createRequire(import.meta.url);
const runtimeTools = createRequire(require.resolve('wrangler/package.json'));
const { build } = runtimeTools('esbuild');
const { Miniflare } = runtimeTools('miniflare');
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const oldKey = 'businesses/a/employee-onboarding/employee/old.pdf';
const oldUrl = '/api/documents/media/' + oldKey;
const { outputFiles } = await build({
  stdin: { resolveDir: process.cwd(), sourcefile: 'hr-packet-runtime.ts', contents: `
    import {submitEmployeeOnboardingItem,loadEmployeeOnboarding} from './src/lib/server/admin.ts';
    import {GET as media} from './src/routes/api/documents/media/[...key]/+server.ts';
    let pauseNext=false, waiting=false;
    export default {async fetch(request,bindings) {
      const db=bindings.DB, now=Math.floor(Date.now()/1000), url=new URL(request.url), path=url.pathname;
      const oldKey=${JSON.stringify(oldKey)}, oldUrl=${JSON.stringify(oldUrl)};
      if(path==='/setup') {
        await db.batch(${JSON.stringify(schema)}.map(sql=>db.prepare(sql)));
        const statements=[];
        for(const id of ['a','b']) statements.push(db.prepare('INSERT INTO businesses(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id,id,now,now));
        for(const [id,business,role] of [['employee','a','staff'],['owner','a','owner'],['manager','a','manager'],['foreign','b','owner']]) {
          statements.push(db.prepare('INSERT INTO users(id,email,email_normalized,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id+'@example.invalid',id+'@example.invalid',now,now));
          statements.push(db.prepare('INSERT INTO business_users(business_id,user_id,role,permission_template,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(business,id,role,role==='manager'?'general_manager':role,now,now));
        }
        statements.push(db.prepare("INSERT INTO employee_onboarding_packages(id,business_id,user_id,status,sent_at,updated_at) VALUES('packet','a','employee','in_progress',?,?)").bind(now,now));
        statements.push(db.prepare("INSERT INTO employee_onboarding_items(id,package_id,business_id,user_id,item_type,form_key,title,file_url,file_name,created_at) VALUES('document','packet','a','employee','document','federal_w4','Federal W-4',?,'old.pdf',?)").bind(oldUrl,now));
        statements.push(db.prepare("INSERT INTO employee_role_permissions(business_id,user_id,permission_key,is_enabled,updated_at) VALUES('a','manager','view_sensitive_employee_data',0,?)").bind(now));
        statements.push(db.prepare("INSERT INTO employee_role_permissions(business_id,user_id,permission_key,is_enabled,updated_at) VALUES('a','manager','hr_sensitive_access',1,?)").bind(now));
        await db.batch(statements);
        await bindings.DOC_MEDIA.put(oldKey,'%PDF-1.7 old fixture',{httpMetadata:{contentType:'application/pdf'}});
        await bindings.DOC_MEDIA.put('businesses/b/employee-onboarding/foreign/private.pdf','foreign private fixture');
        return Response.json({ok:true});
      }
      if(path==='/fail') {await db.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON employee_compliance_documents BEGIN SELECT RAISE(ABORT,'isolated packet commit failure'); END");return Response.json({ok:true});}
      if(path==='/clear') {await db.exec('DROP TRIGGER fixture_failure');return Response.json({ok:true});}
      if(path==='/pause') {pauseNext=true;return Response.json({ok:true});}
      if(path==='/waiting') return Response.json({waiting});
      if(path==='/release') {waiting=false;return Response.json({ok:true});}
      if(path==='/review') {await db.prepare("UPDATE employee_onboarding_packages SET status='submitted' WHERE id='packet'").run();return Response.json({ok:true});}
      if(path==='/retain') {
        await db.batch([
          db.prepare("INSERT INTO employee_onboarding_packages(id,business_id,user_id,status,sent_at,updated_at) VALUES('retained','a','employee','approved',?,?)").bind(now-1,now-1),
          db.prepare("INSERT INTO employee_onboarding_items(id,package_id,business_id,user_id,item_type,title,status,file_url,created_at) VALUES('retained-document','retained','a','employee','document','Retained','approved',?,?)").bind(oldUrl,now-1)
        ]);return Response.json({ok:true});
      }
      const actor=url.searchParams.get('actor')||'employee', businessId=actor==='foreign'?'b':'a';
      const env={...bindings,SENSITIVE_DATA_KEY:'isolated-hr-runtime-encryption-key-only-value',SENSITIVE_DATA_KEY_VERSION:'fixture'};
      const bucket={async put(...args){const result=await bindings.DOC_MEDIA.put(...args);if(pauseNext){pauseNext=false;waiting=true;for(let i=0;waiting&&i<1000;i++)await new Promise(resolve=>setTimeout(resolve,10));if(waiting)throw Error('Isolated upload pause timed out');}return result;},delete:keys=>bindings.DOC_MEDIA.delete(keys)};
      const locals={DB:db,env,MEDIA_BUCKET:bucket,businessId,userId:actor,businessRole:actor==='employee'?'staff':'owner',businessPermissionTemplate:'owner'};
      if(path==='/submit') {
        const form=new FormData();
        form.set('item_id','document');form.set('signed_name','Example Employee');form.set('official_form_confirmed','1');
        form.set('file',new File(['%PDF-1.7 new isolated fixture'],'new.pdf',{type:'application/pdf'}));
        const result=await submitEmployeeOnboardingItem(new Request(request.url,{method:'POST',body:form}),locals,env);
        return Response.json({status:result.status||200,success:result.success||false});
      }
      if(path==='/redaction') {
        await db.prepare("UPDATE employee_onboarding_items SET form_payload=?,signed_name='Private signature' WHERE id='document'").bind(JSON.stringify({private:'PRIVATE-LEGACY-CONTENT'})).run();
        const state=await loadEmployeeOnboarding(db,'employee','a',{env,actorUserId:'manager',actorBusinessRole:'owner',actorPermissionTemplate:'owner',actorCapabilities:['view_sensitive_employee_data']});
        return Response.json({redacted:!JSON.stringify(state).includes('PRIVATE-LEGACY'),file:state.items[0].file_url,signature:state.items[0].signed_name});
      }
      if(path==='/media') {
        const item=await db.prepare("SELECT file_url FROM employee_onboarding_items WHERE id='document'").first();
        const key=url.searchParams.get('foreign')?'businesses/b/employee-onboarding/foreign/private.pdf':item.file_url.replace('/api/documents/media/','');
        return media({params:{key},locals,request});
      }
      const objects=await bindings.DOC_MEDIA.list({limit:100});
      return Response.json({item:await db.prepare("SELECT status,file_url,signed_name FROM employee_onboarding_items WHERE id='document'").first(),
        compliance:await db.prepare("SELECT status,file_url,signed_name FROM employee_compliance_documents WHERE onboarding_item_id='document'").first(),
        packet:await db.prepare("SELECT status FROM employee_onboarding_packages WHERE id='packet'").first(),
        audits:(await db.prepare('SELECT COUNT(*) n FROM account_audit_logs').first()).n,
        objects:objects.objects.map(row=>row.key), foreignKeys:(await db.prepare('PRAGMA foreign_key_check').all()).results});
    }};` },
  bundle: true, format: 'esm', platform: 'neutral', conditions: ['workerd', 'node', 'production'],
  mainFields: ['module', 'main'], target: 'es2022', write: false, external: ['cloudflare:workers'],
  plugins: [{ name: 'fixture-env', setup(build) {
    build.onResolve({ filter: /^\$app\/env$/ }, () => ({ path: 'env', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const dev=false;export const browser=false;export const building=false;' }));
  } }]
});
const runtime = new Miniflare({ host: '127.0.0.1', port: 0, cf: false, telemetry: { enabled: false }, workers: [{
  config: { name: 'hr-packet-runtime', compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
    env: { DB: { type: 'd1', id: 'isolated-hr-packet' }, DOC_MEDIA: { type: 'r2', name: 'isolated-hr-packet-files' } },
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: outputFiles[0].text } } } },
  dev: { outboundService: { type: 'fetcher', handler: () => { throw Error('HR packet tests must not send external requests'); } } }
}] });
async function response(path) { return runtime.dispatchFetch('https://fixture.example.invalid' + path, { method: path.startsWith('/submit') ? 'POST' : 'GET' }); }
async function request(path) {
  const result = await response(path); assert.equal(result.status, 200, await result.clone().text()); return result.json();
}
try {
  await request('/setup'); await request('/fail');
  assert.equal((await request('/submit')).status, 503);
  const failed = await request('/inspect');
  assert.equal(failed.item.file_url, oldUrl); assert.equal(failed.compliance, null); assert.equal(failed.audits, 0); assert.equal(failed.objects.length, 2);
  await request('/clear');
  assert.deepEqual(await request('/redaction'), { redacted: true, file: '', signature: '' });
  // Keep an older accepted packet's reference while racing two real R2 uploads.
  await request('/retain');
  await request('/pause'); const older = request('/submit'); older.catch(() => {});
  let waiting = false;
  for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
    waiting = (await request('/waiting')).waiting;
    if (!waiting) await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(waiting, true);
  assert.equal((await request('/submit')).success, true);
  const winner = await request('/inspect');
  await request('/release'); assert.equal((await older).status, 409);
  const saved = await request('/inspect');
  assert.deepEqual(saved.item, winner.item); assert.deepEqual(saved.compliance, saved.item);
  assert.equal(saved.audits, 1); assert.equal(saved.objects.length, 3); assert.ok(saved.objects.includes(oldKey)); assert.deepEqual(saved.foreignKeys, []);
  assert.equal((await request('/submit?actor=foreign')).status, 404);
  const own = await response('/media'); assert.equal(own.status, 200); assert.equal(own.headers.get('cache-control'), 'private, no-store'); assert.equal(own.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await response('/media?actor=manager')).status, 403); assert.equal((await response('/media?foreign=1')).status, 404);
  await request('/review'); assert.equal((await request('/submit')).status, 400);
  const reviewed = await request('/inspect'); assert.equal(reviewed.packet.status, 'submitted'); assert.deepEqual(reviewed.item, saved.item);
  console.log('PASS actual Workers/D1/R2: document rollback, concurrent replacement, retained files, private media denial, redaction and review lock');
} finally { await runtime.dispose(); }
