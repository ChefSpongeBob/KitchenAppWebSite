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
const { outputFiles } = await build({
  stdin: { resolveDir: process.cwd(), sourcefile: 'multi-restaurant-runtime.ts', contents: `
    import {acceptExistingAccountInvitation} from './src/lib/server/businessInvitations.ts';
    import {load as loadRegistration} from './src/routes/register/+page.server.ts';
    export default {async fetch(request, bindings) {
      const db=bindings.DB, now=Math.floor(Date.now()/1000), path=new URL(request.url).pathname;
      if(path==='/setup') {
        await db.batch(${JSON.stringify(schema)}.map(sql=>db.prepare(sql)));
        const statements=[];
        for(const id of ['shared','manager']) statements.push(db.prepare("INSERT INTO users(id,email,email_normalized,display_name,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
          .bind(id,id+'@example.invalid',id+'@example.invalid',id,'unchanged-credential',now,now));
        for(const id of ['a','b']) {
          statements.push(db.prepare("INSERT INTO businesses(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)").bind(id,'Restaurant '+id,id,now,now));
          statements.push(db.prepare("INSERT INTO business_trials(business_id,owner_user_id,status,trial_started_at,trial_ends_at,created_at,updated_at) VALUES(?,'manager','active',?,?,?,?)").bind(id,now,now,now,now));
        }
        statements.push(db.prepare("INSERT INTO business_users(business_id,user_id,role,permission_template,created_at,updated_at) VALUES('a','shared','owner','owner',?,?)").bind(now,now));
        statements.push(db.prepare("INSERT INTO business_users(business_id,user_id,role,permission_template,created_at,updated_at) VALUES('b','manager','owner','owner',?,?)").bind(now,now));
        statements.push(db.prepare("INSERT INTO employee_profiles(business_id,user_id,real_name,emergency_contact_name,updated_at) VALUES('a','shared','Original A name','Original A private contact',?)").bind(now));
        statements.push(db.prepare("INSERT INTO employee_sensitive_record_vault(id,business_id,user_id,record_scope,record_type,status,encrypted_payload,created_at,updated_at) VALUES('private-a','a','shared','tax','withholding','accepted','A-PRIVATE-DATA',?,?)").bind(now,now));
        statements.push(db.prepare("INSERT INTO sessions(id,user_id,session_token_hash,created_at,last_seen_at,expires_at) VALUES('session','shared','isolated-session',?,?,?)").bind(now,now,now+3600));
        statements.push(db.prepare("INSERT INTO business_invites(id,business_id,email,email_normalized,invite_code,role,permission_template,employment_type,onboarding_required,created_at,expires_at) VALUES('invite-b','b','shared@example.invalid','shared@example.invalid','RUNTIME-INVITE','staff','staff','employee',1,?,?)").bind(now,now+3600));
        await db.batch(statements); return Response.json({ok:true});
      }
      if(path==='/fail') {await db.exec("CREATE TRIGGER fixture_packet_failure BEFORE INSERT ON employee_sensitive_record_vault WHEN NEW.business_id='b' BEGIN SELECT RAISE(ABORT,'isolated packet failure'); END");return Response.json({ok:true});}
      if(path==='/clear') {await db.exec('DROP TRIGGER fixture_packet_failure');return Response.json({ok:true});}
      const env={...bindings,APP_BASE_URL:'https://criminiops.com',SENSITIVE_DATA_KEY:btoa('isolated-multi-restaurant-key-only-value'),SENSITIVE_DATA_KEY_VERSION:'fixture'};
      const locals={DB:db,env,userId:'shared',sessionId:'session',businessId:'a',businessRole:'owner'};
      if(path==='/accept') {
        const form=new FormData();
        for(const [key,value] of Object.entries({invite_code:'RUNTIME-INVITE',real_name:'New B name',birthday:'1990-03-04',user_phone:'2025550102',user_address_line_1:'2 Example Street',user_city:'Example',user_state:'CO',user_postal_code:'80000',business_id:'a',role:'owner'}))form.set(key,value);
        let selected='a';
        try {
          const result=await acceptExistingAccountInvitation({locals,request,url:new URL(request.url),cookies:{set:(name,value)=>selected=value}},form);
          return Response.json({status:result.status,selected});
        } catch(error) {
          if(error.status===303)return Response.json({status:error.status,location:error.location,selected});
          throw error;
        }
      }
      const membership=await db.prepare("SELECT role FROM business_users WHERE business_id='b' AND user_id='shared'").first();
      const used=await db.prepare("SELECT used_by_user_id FROM business_invites WHERE id='invite-b'").first();
      const accepted=await loadRegistration({locals,url:new URL('https://criminiops.com/register?invite=RUNTIME-INVITE')});
      const counts={};for(const table of ['account_audit_logs','employee_onboarding_packages','employee_profiles','employee_onboarding_items'])counts[table]=(await db.prepare('SELECT COUNT(*) n FROM '+table+" WHERE business_id='b'").first()).n;
      return Response.json({membership,used,counts,acceptedInvitation:accepted.acceptedInvitation,
        original:await db.prepare("SELECT real_name,emergency_contact_name FROM employee_profiles WHERE business_id='a' AND user_id='shared'").first(),
        password:(await db.prepare("SELECT password_hash FROM users WHERE id='shared'").first()).password_hash,
        copiedPrivate:(await db.prepare("SELECT COUNT(*) n FROM employee_sensitive_record_vault WHERE business_id='b' AND encrypted_payload='A-PRIVATE-DATA'").first()).n,
        personal:(await db.prepare("SELECT status FROM employee_onboarding_items WHERE business_id='b' AND form_key='personal_information'").first())?.status,
        foreignKeys:(await db.prepare('PRAGMA foreign_key_check').all()).results});
    }};` },
  bundle: true, format: 'esm', platform: 'neutral', conditions: ['workerd', 'node', 'production'], mainFields: ['module', 'main'], target: 'es2022', write: false, external: ['cloudflare:workers'],
  plugins: [{ name: 'fixture-env', setup(build) {
    build.onResolve({ filter: /^\$app\/env$/ }, () => ({ path: 'env', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const dev=false;export const browser=false;export const building=false;' }));
  } }]
});
const runtime = new Miniflare({ host: '127.0.0.1', port: 0, cf: false, telemetry: { enabled: false }, workers: [{
  config: { name: 'multi-restaurant-runtime', compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
    env: { DB: { type: 'd1', id: 'isolated-multi-restaurant' } },
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: outputFiles[0].text } } } },
  dev: { outboundService: { type: 'fetcher', handler: () => { throw Error('Multi-restaurant tests must not send external requests'); } } }
}] });
async function request(path) {
  const response = await runtime.dispatchFetch('https://fixture.example.invalid' + path, { method: path === '/accept' ? 'POST' : 'GET' });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
try {
  await request('/setup'); await request('/fail');
  assert.deepEqual(await request('/accept'), { status: 503, selected: 'a' });
  const failed = await request('/inspect');
  assert.equal(failed.membership, null); assert.equal(failed.used.used_by_user_id, null);
  assert.ok(Object.values(failed.counts).every(count => count === 0));
  await request('/clear');
  // These are intentionally concurrent requests to the same real D1 transaction boundary.
  const attempts = await Promise.all([request('/accept'), request('/accept')]);
  assert.equal(attempts.filter(result => result.status === 303 && result.selected === 'b').length, 1);
  assert.equal(attempts.filter(result => [403, 409].includes(result.status) && result.selected === 'a').length, 1);
  const accepted = await request('/inspect');
  assert.deepEqual(accepted.membership, { role: 'staff' }); assert.equal(accepted.used.used_by_user_id, 'shared');
  assert.equal(accepted.counts.employee_onboarding_packages, 1); assert.equal(accepted.counts.employee_profiles, 1);
  assert.equal(accepted.personal, 'submitted'); assert.equal(accepted.password, 'unchanged-credential');
  assert.equal(accepted.copiedPrivate, 0); assert.deepEqual(accepted.original, { real_name: 'Original A name', emergency_contact_name: 'Original A private contact' });
  assert.deepEqual(accepted.acceptedInvitation, { businessId: 'b', businessName: 'Restaurant b' });
  assert.deepEqual(accepted.foreignKeys, []);
  console.log('PASS actual Workers/D1: atomic invite rollback, concurrent single-use acceptance, unchanged credentials, tenant-specific roles/profile/HR and accepted-link recovery');
} finally { await runtime.dispose(); }
