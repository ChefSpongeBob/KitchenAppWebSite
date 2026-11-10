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
const { build } = runtimeTools('esbuild'), { Miniflare } = runtimeTools('miniflare');
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const { outputFiles } = await build({
  stdin: { resolveDir: process.cwd(), sourcefile: 'registration-runtime.ts', contents: `
    import {actions,load as loadRegistration} from './src/routes/register/+page.server.ts';
    import {verifyPassword} from './src/lib/server/auth.ts';
    import {loadEmployeeOnboarding} from './src/lib/server/admin.ts';
    import {getBusinessTrialAccess} from './src/lib/server/trial.ts';
    let race=false,arrivals=0;
    export default {async fetch(request,bindings) {
      const db=bindings.DB, now=Math.floor(Date.now()/1000), url=new URL(request.url), path=url.pathname;
      const env={...bindings,APP_BASE_URL:'https://criminiops.com',PUBLIC_SIGNUP_ENABLED:'false',
        OWNER_SIGNUP_ALLOWLIST:'owner-one@example.invalid,owner-two@example.invalid',
        PASSWORD_PEPPER:'isolated-registration-runtime-pepper',SENSITIVE_DATA_KEY:'isolated-registration-runtime-encryption-key',SENSITIVE_DATA_KEY_VERSION:'fixture'};
      if(path==='/setup') {
        await db.batch(${JSON.stringify(schema)}.map(sql=>db.prepare(sql)));
        const statements=[];
        for(const id of ['a','b']) {
          statements.push(db.prepare('INSERT INTO users(id,email,email_normalized,created_at,updated_at) VALUES(?,?,?,?,?)').bind('owner-'+id,'owner-'+id+'@example.invalid','owner-'+id+'@example.invalid',now,now));
          statements.push(db.prepare("INSERT INTO businesses(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)").bind(id,id,id,now,now));
          statements.push(db.prepare("INSERT INTO business_users(business_id,user_id,role,permission_template,created_at,updated_at) VALUES(?,?,'owner','owner',?,?)").bind(id,'owner-'+id,now,now));
          statements.push(db.prepare("INSERT INTO business_trials(business_id,owner_user_id,status,trial_started_at,trial_ends_at,created_at,updated_at) VALUES(?,?,'active',?,?,?,?)").bind(id,'owner-'+id,now,now,now,now));
        }
        statements.push(db.prepare("INSERT INTO business_invites(id,business_id,email,email_normalized,invite_code,role,permission_template,employment_type,onboarding_required,created_at,expires_at) VALUES('invite','a','new@example.invalid','new@example.invalid','RUNTIME-REGISTRATION','staff','staff','employee',1,?,?)").bind(now,now+3600));
        statements.push(db.prepare("INSERT INTO user_invites(id,email,email_normalized,invite_code,invited_by,created_at,expires_at) VALUES('legacy','legacy@example.invalid','legacy@example.invalid','UNSCOPED','owner-a',?,?)").bind(now,now+3600));
        await db.batch(statements);await bindings.DOC_MEDIA.put('businesses/b/documents/retained.pdf','private retained fixture');
        return Response.json({ok:true});
      }
      if(path==='/fail') {
        const table=url.searchParams.get('owner')?'store_billing_placeholders':'employee_sensitive_record_vault';
        await db.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON "+table+" BEGIN SELECT RAISE(ABORT,'isolated registration rollback'); END");return Response.json({ok:true});
      }
      if(path==='/clear') {await db.exec('DROP TRIGGER fixture_failure');return Response.json({ok:true});}
      if(path==='/race') {race=true;arrivals=0;return Response.json({ok:true});}
      const transactionDb={prepare:sql=>db.prepare(sql),async batch(statements){
        if(race&&arrivals<2){arrivals++;for(let i=0;arrivals<2&&i<1000;i++)await new Promise(resolve=>setTimeout(resolve,10));
          if(arrivals<2)throw Error('Isolated registration barrier timed out');}
        return db.batch(statements);
      }};
      const locals={DB:transactionDb,env:{...env,DB:transactionDb},MEDIA_BUCKET:bindings.DOC_MEDIA};
      if(['/invite','/owner','/legacy'].includes(path)) {
        const owner=path==='/owner', legacy=path==='/legacy';
        const email=owner?(url.searchParams.get('two')?'owner-two@example.invalid':'owner-one@example.invalid'):legacy?'legacy@example.invalid':'new@example.invalid';
        const form=new FormData();
        const fields={email,confirm_email:email,password:'Isolated-runtime-password7!',confirm_password:'Isolated-runtime-password7!',
          real_name:'Example Legal Name',display_name:'Example Person',birthday:'1990-03-04',user_phone:'2025550101',
          user_address_line_1:'1 Example Street',user_city:'Example',user_state:'CO',user_postal_code:'80000',email_updates:'0',sms_updates:'0',
          ...(owner?{business_name:'Concurrent Restaurant',owner_title:'Owner',plan_tier:'medium',purchase_mode:'buy_now',liability_agreement_accepted:'1',
            schedule_setup:JSON.stringify([{name:'Dining',roles:['Server']}])}:{invite_code:legacy?'UNSCOPED':'RUNTIME-REGISTRATION'})};
        for(const [key,value] of Object.entries(fields))form.set(key,value);
        if(owner)form.set('business_documents',new File(['%PDF-1.7 isolated handbook'],'handbook.pdf',{type:'application/pdf'}));
        const requestUrl='https://criminiops.com/register'+(owner?'':'?invite='+fields.invite_code);
        const cookies=new Map();
        try {
          const result=await actions.default({locals,request:new Request(requestUrl,{method:'POST',body:form}),url:new URL(requestUrl),
            cookies:{get:key=>cookies.get(key),set:(key,value)=>cookies.set(key,value),delete:key=>cookies.delete(key)}});
          return Response.json({status:result.status,cookies:cookies.size,retainedFields:result.data.values.realName===fields.real_name});
        }catch(error){if(error.status===303)return Response.json({status:303,location:error.location,cookies:cookies.size});throw error;}
      }
      if(path==='/legacy-load')return Response.json(await loadRegistration({locals,url:new URL('https://criminiops.com/register?invite=UNSCOPED')}));
      const user=await db.prepare("SELECT id,password_hash FROM users WHERE email_normalized='new@example.invalid'").first();
      const businesses=(await db.prepare("SELECT id,slug,status FROM businesses WHERE id NOT IN ('a','b') ORDER BY id").all()).results;
      let personal=null;
      if(user) {
        const onboarding=await loadEmployeeOnboarding(db,user.id,'a',{env,actorUserId:user.id});
        const item=onboarding.items.find(item=>item.form_key==='personal_information');
        personal={status:item.status,name:JSON.parse(item.form_payload).legal_name,validPassword:(await verifyPassword('Isolated-runtime-password7!',user.password_hash,env)).valid};
      }
      const counts={};for(const table of ['users','businesses','business_users','employee_onboarding_packages','employee_profiles','sessions','devices','legal_agreements','store_billing_placeholders'])counts[table]=(await db.prepare('SELECT COUNT(*) n FROM '+table).first()).n;
      return Response.json({counts,personal,businesses,allowApps:await Promise.all(businesses.map(business=>getBusinessTrialAccess(db,business.id).then(access=>access.allowApp))),
        used:await db.prepare("SELECT used_at,used_by_user_id FROM business_invites WHERE id='invite'").first(),
        objects:(await bindings.DOC_MEDIA.list({limit:100})).objects.map(row=>row.key),
        foreignMembership:user?await db.prepare("SELECT 1 FROM business_users WHERE business_id='b' AND user_id=?").bind(user.id).first():null,
        foreignKeys:(await db.prepare('PRAGMA foreign_key_check').all()).results});
    }};` },
  bundle: true, format: 'esm', platform: 'neutral', conditions: ['workerd', 'node', 'production'], mainFields: ['module', 'main'],
  target: 'es2022', write: false, external: ['cloudflare:workers'],
  plugins: [{ name: 'fixture-env', setup(build) {
    build.onResolve({ filter: /^\$app\/env$/ }, () => ({ path: 'env', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const dev=false;export const browser=false;export const building=false;' }));
  } }]
});
const runtime = new Miniflare({ host: '127.0.0.1', port: 0, cf: false, telemetry: { enabled: false }, workers: [{
  config: { name: 'registration-runtime', compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
    env: { DB: { type: 'd1', id: 'isolated-registration' }, DOC_MEDIA: { type: 'r2', name: 'isolated-registration-files' } },
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: outputFiles[0].text } } } },
  dev: { outboundService: { type: 'fetcher', handler: () => { throw Error('Registration tests must not send external requests'); } } }
}] });
async function request(path) {
  const response = await runtime.dispatchFetch('https://fixture.example.invalid' + path);
  assert.equal(response.status, 200, await response.clone().text()); return response.json();
}
try {
  await request('/setup'); await request('/fail');
  assert.equal((await request('/invite')).status, 503);
  const failed = await request('/inspect');
  assert.deepEqual(failed.counts, { users: 2, businesses: 2, business_users: 2, employee_onboarding_packages: 0, employee_profiles: 0, sessions: 0, devices: 0, legal_agreements: 0, store_billing_placeholders: 0 });
  assert.equal(failed.used.used_at, null); assert.equal(failed.personal, null);
  await request('/clear');
  await request('/race');
  const attempts = await Promise.all([request('/invite'), request('/invite')]);
  assert.equal(attempts.filter(result => result.status === 303 && result.location === '/register/welcome?onboarding=1').length, 1);
  const loser = attempts.find(result => result.status !== 303); assert.equal(loser.status, 409); assert.equal(loser.cookies, 0);
  const invited = await request('/inspect');
  assert.deepEqual(invited.personal, { status: 'submitted', name: 'Example Legal Name', validPassword: true });
  assert.equal(invited.counts.employee_onboarding_packages, 1); assert.equal(invited.counts.sessions, 1); assert.equal(invited.foreignMembership, null);
  assert.equal((await request('/legacy')).status, 400); assert.equal((await request('/legacy-load')).inviteEmail, null);
  await request('/fail?owner=1'); assert.equal((await request('/owner')).status, 503);
  const ownerFailed = await request('/inspect'); assert.deepEqual(ownerFailed.counts, invited.counts); assert.equal(ownerFailed.objects.length, 1);
  await request('/clear');
  await request('/race');
  const owners = await Promise.all([request('/owner'), request('/owner?two=1')]);
  assert.ok(owners.every(result => result.status === 303 && result.location === '/billing?purchase=pending'));
  const complete = await request('/inspect');
  assert.equal(complete.businesses.length, 2); assert.equal(new Set(complete.businesses.map(row => row.slug)).size, 2);
  assert.ok(complete.businesses.every(row => row.status === 'pending_payment')); assert.deepEqual(complete.allowApps, [false, false]);
  assert.equal(complete.counts.legal_agreements, 2); assert.equal(complete.counts.store_billing_placeholders, 2);
  assert.equal(complete.counts.employee_onboarding_packages, 1); assert.equal(complete.counts.sessions, 3); assert.equal(complete.objects.length, 3);
  assert.deepEqual(complete.foreignKeys, []);
  console.log('PASS actual Workers/D1/R2: registration rollback/retry, concurrent single-use invites, real password/encrypted-profile persistence, purchaser files/billing/legal, unique concurrent restaurant names and legacy-invite denial');
} finally { await runtime.dispose(); }
