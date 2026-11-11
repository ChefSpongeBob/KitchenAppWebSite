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
const { outputFiles } = await build({ stdin: { resolveDir: process.cwd(), sourcefile: 'auth-lifecycle-runtime.ts', contents: `
  import {actions as login} from './src/routes/login/+page.server.ts';
  import {actions as reset} from './src/routes/reset-password/[token]/+page.server.ts';
  import {hashPassword,hashSessionToken,verifyPassword} from './src/lib/server/auth.ts';
  import {checkRateLimit} from './src/lib/server/security.ts';
  import {cancelBusinessAccess,getBusinessTrialAccess} from './src/lib/server/trial.ts';
  import {deleteUser} from './src/lib/server/admin.ts';
  let pauseNext=false,waiting=false,originalHash='';
  const jar=new Map(),cookieOptions=[];
  export default {async fetch(request,bindings){
    const raw=bindings.DB,url=new URL(request.url),path=url.pathname,now=Math.floor(Date.now()/1000);
    const db={prepare:sql=>raw.prepare(sql),async batch(statements){
      if(pauseNext){pauseNext=false;waiting=true;for(let i=0;waiting&&i<1000;i++)await new Promise(resolve=>setTimeout(resolve,10));if(waiting)throw Error('Isolated auth pause timed out');}
      return raw.batch(statements);
    }};
    const env={...bindings,DB:db,PASSWORD_PEPPER:'isolated-worker-auth-pepper',APP_BASE_URL:'https://criminiops.com'};
    const token='a'.repeat(64),password=url.searchParams.get('password')||'New-password-789!';
    if(path==='/setup'){
      await raw.batch(${JSON.stringify(schema)}.map(sql=>raw.prepare(sql)));
      originalHash=await hashPassword('Isolated-password-123!',env);
      for(const id of ['alice','bob'])await raw.batch([
        raw.prepare('INSERT INTO users(id,email,email_normalized,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,id+'@example.invalid',id+'@example.invalid',originalHash,now,now),
        raw.prepare('INSERT INTO businesses(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id+'-business',id,id,now,now),
        raw.prepare("INSERT INTO business_users(business_id,user_id,role,permission_template,created_at,updated_at) VALUES(?,?,'owner','owner',?,?)").bind(id+'-business',id,now,now),
        raw.prepare("INSERT INTO business_trials(business_id,owner_user_id,status,trial_started_at,trial_ends_at,created_at,updated_at) VALUES(?,?,'active',?,?,?,?)").bind(id+'-business',id,now,now,now,now),
        raw.prepare("INSERT INTO devices(id,user_id,pin_hash,created_at,updated_at) VALUES(?,?,'',?,?)").bind(id+'-device',id,now,now),
        raw.prepare('INSERT INTO sessions(id,user_id,device_id,session_token_hash,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(id+'-session',id,id+'-device',await hashSessionToken(id+'-token'),now,now,now+3600)
      ]);
      return Response.json({ok:true});
    }
    if(path==='/restore'){
      await raw.batch([
        raw.prepare('UPDATE users SET password_hash=?,is_active=1 WHERE id=?').bind(originalHash,'alice'),
        raw.prepare('UPDATE sessions SET revoked_at=NULL'),raw.prepare('UPDATE devices SET revoked_at=NULL'),
        raw.prepare('DELETE FROM account_audit_logs'),raw.prepare('DELETE FROM password_resets'),raw.prepare('DELETE FROM security_rate_limits'),
        raw.prepare('INSERT INTO password_resets(id,user_id,email,token_hash,created_at,expires_at) VALUES(?,?,?,?,?,?)').bind('reset-alice','alice','alice@example.invalid',await hashSessionToken(token),now,now+3600)
      ]);jar.clear();jar.set('__Host-kitchen_session','bob-token');jar.set('kitchen_active_business','bob-business');cookieOptions.length=0;
      return Response.json({ok:true});
    }
    if(path==='/pause'){pauseNext=true;return Response.json({ok:true});}
    if(path==='/waiting')return Response.json({waiting});
    if(path==='/release'){waiting=false;return Response.json({ok:true});}
    if(path==='/fail-reset'){await raw.exec("CREATE TRIGGER fixture_reset_failure BEFORE UPDATE ON sessions BEGIN SELECT RAISE(ABORT,'isolated revoke failure');END");return Response.json({ok:true});}
    if(path==='/fail-login'){await raw.exec("CREATE TRIGGER fixture_login_failure BEFORE INSERT ON sessions BEGIN SELECT RAISE(ABORT,'isolated session failure');END");return Response.json({ok:true});}
    if(path==='/clear'){await raw.exec('DROP TRIGGER IF EXISTS fixture_reset_failure;DROP TRIGGER IF EXISTS fixture_login_failure;');return Response.json({ok:true});}
    if(path==='/limit')return Response.json(await checkRateLimit(raw,{action:'parallel',identifier:'same-ip',limit:8,windowSeconds:900,blockSeconds:900}));
    if(path==='/removal-setup'){
      await raw.batch([
        raw.prepare("UPDATE businesses SET status='active' WHERE id IN ('alice-business','bob-business')"),
        raw.prepare("UPDATE business_users SET role='owner',permission_template='owner',is_active=1 WHERE user_id='alice'"),
        raw.prepare("UPDATE business_users SET is_active=? WHERE business_id='bob-business' AND user_id='bob'").bind(url.searchParams.has('single')?0:1),
        raw.prepare("INSERT INTO business_users(business_id,user_id,role,permission_template,created_at,updated_at) VALUES('alice-business','bob','staff','staff',?,?) ON CONFLICT(business_id,user_id) DO UPDATE SET is_active=1").bind(now,now),
        raw.prepare("INSERT OR IGNORE INTO employee_profiles(business_id,user_id,real_name,updated_at) VALUES('alice-business','bob','Retained employee',?)").bind(now),
        raw.prepare("INSERT OR IGNORE INTO employee_sensitive_record_vault(id,business_id,user_id,record_scope,record_type,status,encrypted_payload,created_at,updated_at) VALUES('retained-vault','alice-business','bob','tax','withholding','accepted','unchanged-encrypted-record',?,?)").bind(now,now),
        raw.prepare('UPDATE sessions SET revoked_at=NULL'),raw.prepare('UPDATE devices SET revoked_at=NULL'),raw.prepare('DELETE FROM account_audit_logs')
      ]);return Response.json({ok:true});
    }
    if(path==='/removal-revoke-authority'){
      await raw.prepare("UPDATE business_users SET role='staff',permission_template='staff' WHERE user_id='alice'").run();return Response.json({ok:true});
    }
    if(path==='/removal-failure'){
      await raw.exec("CREATE TRIGGER fixture_removal_failure BEFORE UPDATE ON devices BEGIN SELECT RAISE(ABORT,'isolated removal failure');END");return Response.json({ok:true});
    }
    if(path==='/removal-clear'){await raw.exec('DROP TRIGGER IF EXISTS fixture_removal_failure;');return Response.json({ok:true});}
    if(path==='/removal-inspect')return Response.json({
      membership:await raw.prepare("SELECT is_active FROM business_users WHERE business_id='alice-business' AND user_id='bob'").first(),
      otherMembership:await raw.prepare("SELECT role,is_active FROM business_users WHERE business_id='bob-business' AND user_id='bob'").first(),
      identity:await raw.prepare("SELECT id,password_hash FROM users WHERE id='bob'").first(),
      profile:await raw.prepare("SELECT real_name FROM employee_profiles WHERE business_id='alice-business' AND user_id='bob'").first(),
      vault:await raw.prepare("SELECT encrypted_payload FROM employee_sensitive_record_vault WHERE id='retained-vault'").first(),
      session:await raw.prepare("SELECT revoked_at FROM sessions WHERE id='bob-session'").first(),
      device:await raw.prepare("SELECT revoked_at FROM devices WHERE id='bob-device'").first(),
      audit:await raw.prepare("SELECT count(*) AS n FROM account_audit_logs WHERE action='user_deleted_from_business'").first()
    });
    if(path==='/remove'){
      const form=new URLSearchParams({user_id:'bob'});
      try{const result=await deleteUser(new Request('https://criminiops.com/admin/users/bob?/delete_user',
        {method:'POST',body:form,headers:{origin:'https://criminiops.com'}}),
        {DB:db,userId:'alice',sessionId:'alice-session',userRole:'admin',businessId:'alice-business',businessRole:'owner',businessPermissionTemplate:'owner'});
        return Response.json({status:result.status,data:result.data});
      }catch(error){if(error.location)return Response.json({status:error.status,location:error.location});throw error;}
    }
    if(path==='/missing-pepper'){
      try{await hashPassword('Isolated-password-123!',{});return Response.json({blocked:false});}
      catch{return Response.json({blocked:true});}
    }
    if(path==='/cancel')return Response.json({success:await cancelBusinessAccess(db,{businessId:'alice-business',requestedByUserId:'alice',sessionId:'alice-session',request})});
    if(path==='/expire'){
      await raw.prepare("UPDATE business_trials SET status='trialing',trial_ends_at=? WHERE business_id='bob-business'").bind(now-1).run();
      return Response.json(await getBusinessTrialAccess(db,'bob-business'));
    }
    if(path==='/billing-window'){
      await raw.prepare("UPDATE business_trials SET status='active' WHERE business_id='bob-business'").run();
      await raw.prepare("INSERT INTO business_store_entitlements(id,business_id,owner_user_id,store,product_id,entitlement_key,plan_tier,status,verified_at,expires_at,created_at,updated_at) VALUES('billing-fixture','bob-business','bob','google_play','fixture.plan','plan.fixture','growth','active',?,?,?,?) ON CONFLICT(id) DO UPDATE SET expires_at=excluded.expires_at")
        .bind(now-10,url.searchParams.has('expired')?now-1:now+3600,now,now).run();
      return Response.json({access:await getBusinessTrialAccess(db,'bob-business'),
        cached:await raw.prepare("SELECT status FROM business_trials WHERE business_id='bob-business'").first()});
    }
    if(path==='/reset'||path==='/login'){
      const fields=path==='/reset'?{password,confirm_password:password}:{email:'alice@example.invalid',password:'Isolated-password-123!'};
      const body=new URLSearchParams(fields),headers={origin:'https://criminiops.com',...(url.searchParams.has('native')?{'x-crimini-native':'1'}:{})};
      const event={request:new Request('https://criminiops.com'+(path==='/reset'?'/reset-password/'+token:'/login'),{method:'POST',body,headers}),
        url:new URL('https://criminiops.com/login'),params:{token},locals:{DB:db,env},getClientAddress:()=> '192.0.2.10',
        cookies:{get:key=>jar.get(key),delete:key=>jar.delete(key),set:(key,value,options)=>{jar.set(key,value);cookieOptions.push({key,options});}}};
      try{const result=await (path==='/reset'?reset.default:login.login)(event);return Response.json({status:result.status||200,data:result.data});}
      catch(error){if(error.location)return Response.json({status:error.status,location:error.location});throw error;}
    }
    return Response.json({alice:await raw.prepare("SELECT password_hash FROM users WHERE id='alice'").first(),
      sessions:(await raw.prepare('SELECT id,user_id,revoked_at FROM sessions ORDER BY id').all()).results,
      devices:(await raw.prepare('SELECT id,user_id,revoked_at FROM devices ORDER BY id').all()).results,
      reset:await raw.prepare("SELECT used_at FROM password_resets WHERE id='reset-alice'").first(),
      audits:(await raw.prepare('SELECT action FROM account_audit_logs ORDER BY rowid').all()).results,
      expectedPassword:await verifyPassword(password,(await raw.prepare("SELECT password_hash FROM users WHERE id='alice'").first()).password_hash,env),
      cookies:[...jar.keys()],options:cookieOptions,foreignKeys:(await raw.prepare('PRAGMA foreign_key_check').all()).results});
  }};` }, bundle: true, format: 'esm', platform: 'neutral', conditions: ['workerd', 'node', 'production'], mainFields: ['module', 'main'],
  target: 'es2022', write: false, external: ['cloudflare:workers'], plugins: [{ name: 'fixture-env', setup(build) {
    build.onResolve({ filter: /^\$app\/env$/ }, () => ({ path: 'env', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const dev=false;export const browser=false;export const building=false;' }));
  } }] });
const runtime = new Miniflare({ host: '127.0.0.1', port: 0, cf: false, telemetry: { enabled: false }, workers: [{
  config: { name: 'auth-lifecycle-runtime', compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
    env: { DB: { type: 'd1', id: 'isolated-auth-lifecycle' } },
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: outputFiles[0].text } } } },
  dev: { outboundService: { type: 'fetcher', handler: () => { throw Error('Auth tests must not send external requests'); } } }
}] });
async function request(path) { const response = await runtime.dispatchFetch('https://fixture.example.invalid' + path, { method: 'POST' });
  assert.equal(response.status, 200, await response.clone().text()); return response.json(); }
async function paused(path, during) {
  await request('/pause'); const pending = request(path); pending.catch(() => {}); let waiting = false;
  for (let i = 0; i < 100 && !waiting; i++) { waiting = (await request('/waiting')).waiting; if (!waiting) await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.equal(waiting, true); try { await during(); } finally { await request('/release'); } return pending;
}
try {
  await request('/setup'); await request('/restore'); const original = await request('/inspect');
  assert.equal((await request('/missing-pepper')).blocked, true, 'Workers must not silently use a development pepper');
  await request('/fail-reset'); assert.equal((await request('/reset')).status, 503);
  assert.deepEqual(await request('/inspect'), original); await request('/clear');
  assert.equal((await request('/reset')).location, '/login?reset=success');
  const reset = await request('/inspect'); assert.equal(reset.expectedPassword.valid, true); assert.ok(reset.reset.used_at);
  assert.ok(reset.sessions.find(row => row.user_id === 'alice').revoked_at); assert.equal(reset.sessions.find(row => row.user_id === 'bob').revoked_at, null);
  assert.equal((await request('/reset')).status, 400);
  await request('/restore');
  assert.equal((await paused('/reset', async () => { assert.equal((await request('/reset?password=Winning-password-456!')).status, 303); })).status, 400);
  assert.equal((await request('/inspect?password=Winning-password-456!')).expectedPassword.valid, true);
  await request('/restore');
  assert.equal((await paused('/login', async () => { assert.equal((await request('/reset')).status, 303); })).status, 400);
  assert.ok((await request('/inspect')).cookies.includes('kitchen_active_business'));
  await request('/restore'); await request('/fail-login'); const beforeLogin = await request('/inspect'); assert.equal((await request('/login')).status, 500);
  const failed = await request('/inspect'); assert.deepEqual(failed, beforeLogin);
  assert.equal(failed.sessions.find(row => row.user_id === 'bob').revoked_at, null); assert.ok(failed.cookies.includes('kitchen_active_business')); await request('/clear');
  assert.equal((await request('/login?native=1')).location, '/app');
  const native = await request('/inspect'); assert.equal(native.cookies.includes('kitchen_active_business'), false);
  assert.equal(native.options.at(-1).options.sameSite, 'none'); assert.equal(native.options.at(-1).options.secure, true);
  await request('/restore'); assert.equal((await request('/login')).status, 303);
  assert.equal((await request('/inspect')).options.at(-1).options.sameSite, 'lax');
  const limits = await Promise.all(Array.from({ length: 30 }, () => request('/limit'))); assert.equal(limits.filter(row => row.allowed).length, 8);
  await request('/restore'); const beforeCancel = await request('/inspect'); assert.equal((await request('/cancel')).success, true);
  const afterCancel = await request('/inspect'); assert.deepEqual(afterCancel.sessions, beforeCancel.sessions); assert.deepEqual(afterCancel.devices, beforeCancel.devices);
  assert.deepEqual(afterCancel.alice, beforeCancel.alice); assert.deepEqual(afterCancel.reset, beforeCancel.reset);
  assert.equal((await request('/cancel')).success, false);
  const expiry = await request('/expire'); assert.equal(expiry.allowApp, false); assert.equal(expiry.shouldPurge, false);
  await request('/removal-setup'); const beforeRemoval=await request('/removal-inspect');
  const removalResult=await request('/remove');assert.equal(removalResult.location,'/admin/users',JSON.stringify(removalResult));
  const removed=await request('/removal-inspect'); assert.equal(removed.membership.is_active,0);assert.equal(removed.audit.n,1);
  for(const key of ['identity','profile','vault','session','device','otherMembership'])assert.deepEqual(removed[key],beforeRemoval[key]);
  assert.equal((await request('/remove')).status,303);assert.deepEqual(await request('/removal-inspect'),removed);
  await request('/removal-setup?single=1');const beforeFailedRemoval=await request('/removal-inspect');
  await request('/removal-failure');assert.equal((await request('/remove')).status,503);
  assert.deepEqual(await request('/removal-inspect'),beforeFailedRemoval);await request('/removal-clear');
  assert.equal((await paused('/remove',async()=>{await request('/removal-revoke-authority');})).status,409);
  assert.deepEqual(await request('/removal-inspect'),beforeFailedRemoval);
  await request('/removal-setup?single=1');assert.equal((await request('/remove')).status,303);
  const lastRestaurantRemoval=await request('/removal-inspect');assert.equal(lastRestaurantRemoval.membership.is_active,0);
  assert.ok(lastRestaurantRemoval.session.revoked_at);assert.ok(lastRestaurantRemoval.device.revoked_at);
  for(const key of ['identity','profile','vault'])assert.deepEqual(lastRestaurantRemoval[key],beforeFailedRemoval[key]);
  assert.equal((await request('/billing-window')).access.allowApp,true);
  const expiredStore=await request('/billing-window?expired=1');assert.equal(expiredStore.access.allowApp,false);
  assert.equal(expiredStore.access.shouldPurge,false);assert.equal(expiredStore.cached.status,'active');
  assert.equal((await request('/billing-window')).access.allowApp,true);
  assert.deepEqual((await request('/inspect')).foreignKeys, []);
  console.log('PASS actual Workers/D1: reset rollback/replay/concurrency, stale-password login rejection, account-switch preservation, native/browser cookies, atomic parallel abuse limits and non-destructive cancellation/expiry');
  console.log('PASS actual Workers/D1 employee removal: retained identity/HR, other-restaurant access, replay, transaction rollback, commit-time revocation and last-restaurant session/device revocation');
  console.log('PASS actual Workers/D1 store access: expired cached-active plans deny access without deletion; a current verified period permits it');
} finally { await runtime.dispose(); }
