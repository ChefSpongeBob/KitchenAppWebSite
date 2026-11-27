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
const { outputFiles } = await build({ stdin: { resolveDir: process.cwd(), sourcefile: 'privacy-readiness-runtime.ts', contents: `
  import {load,actions} from './src/routes/staff/deletion-requests/+page.server.ts';
  import {encryptSensitiveJsonPayload,decryptSensitiveJsonPayload} from './src/lib/server/sensitive.ts';
  export default { async fetch(request, env) {
    const path = new URL(request.url).pathname, now = Math.floor(Date.now()/1000), db = env.DB;
    const insert = (table,row) => { const keys=Object.keys(row); return db.prepare('INSERT INTO '+table+' ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').bind(...Object.values(row)); };
    if(path==='/setup') {
      await db.batch(${JSON.stringify(schema)}.map(sql=>db.prepare(sql)));
      for(const id of ['a','b']) await insert('businesses',{id,name:id,slug:id,created_at:now,updated_at:now}).run();
      for(const id of ['owner','support','manager']) {
        await insert('users',{id,email:id+'@example.invalid',email_normalized:id+'@example.invalid',created_at:now,updated_at:now}).run();
        await insert('business_users',{business_id:'a',user_id:id,role:'owner',created_at:now,updated_at:now}).run();
        await insert('sessions',{id:id+'-session',user_id:id,session_token_hash:'fixture-'+id,created_at:now,last_seen_at:now,expires_at:now+3600}).run();
        if(id!=='manager') {
          await insert('platform_staff_members',{user_id:id,staff_role:id,created_at:now,updated_at:now}).run();
          await insert('platform_staff_step_up',{session_id:id+'-session',user_id:id,membership_revision:1,verified_at:now,email_verified_at:now}).run();
        }
      }
      await insert('business_users',{business_id:'b',user_id:'manager',role:'owner',created_at:now,updated_at:now}).run();
      await insert('account_deletion_requests',{id:'request-a',email:'manager@example.invalid',request_scope:'workspace',details:'PRIVATE-FIXTURE-REQUEST',
        requester_user_id:'manager',requester_business_id:'a',created_at:now,updated_at:now}).run();
      return Response.json({ok:true});
    }
    if(path==='/inspect') return Response.json({request:await db.prepare("SELECT status,review_revision FROM account_deletion_requests WHERE id='request-a'").first(),
      audits:(await db.prepare('SELECT action,reason FROM platform_staff_audit ORDER BY rowid').all()).results,
      counts:await db.prepare('SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM businesses) businesses,(SELECT COUNT(*) FROM business_users) memberships').first(),
      foreignKeys:(await db.prepare('PRAGMA foreign_key_check').all()).results});
    if(path==='/fail-audit') { await db.exec("CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON platform_staff_audit BEGIN SELECT RAISE(ABORT,'PRIVATE-FIXTURE-REQUEST'); END"); return Response.json({ok:true}); }
    if(path==='/clear-audit') { await db.exec('DROP TRIGGER fixture_audit_failure'); return Response.json({ok:true}); }
    if(path==='/expire-proof') { await db.prepare("UPDATE platform_staff_step_up SET verified_at=?,email_verified_at=? WHERE user_id='owner'").bind(now-901,now-901).run(); return Response.json({ok:true}); }
    if(path==='/revoke') { await db.exec("UPDATE sessions SET revoked_at=1 WHERE user_id='owner'"); return Response.json({ok:true}); }
    if(path==='/crypto') {
      const secret={SENSITIVE_DATA_KEY:'isolated-workerd-sensitive-record-material',SENSITIVE_DATA_KEY_VERSION:'fixture'};
      const context={businessId:'a',userId:'manager',recordScope:'tax',recordType:'withholding'};
      const first=await encryptSensitiveJsonPayload(secret,{value:'PRIVATE-FIXTURE-HR'},context);
      const stored={encrypted_payload:first.encryptedPayload,payload_iv:first.payloadIv,key_version:first.keyVersion,encryption_algorithm:first.encryptionAlgorithm};
      const decoded=await decryptSensitiveJsonPayload(secret,stored,context);
      const denied=[];
      for(const key of Object.keys(context)) { try { await decryptSensitiveJsonPayload(secret,stored,{...context,[key]:'b'}); denied.push(false); } catch { denied.push(true); } }
      return Response.json({roundTrip:decoded.value==='PRIVATE-FIXTURE-HR',denied,notPlaintext:!JSON.stringify(first).includes('PRIVATE-FIXTURE-HR')});
    }
    const user = new URL(request.url).searchParams.get('user')||'owner';
    const event={locals:{DB:db,userId:user,sessionId:user+'-session'},request,
      url:new URL('https://criminiops.com/staff/deletion-requests'+(path==='/detail'||path==='/review'?'?request=request-a':''))};
    try {
      const result=path==='/review'?await actions.review(event):await load(event);
      return Response.json({status:result.status||200,result});
    } catch(err) { if(err.status) return Response.json({status:err.status,location:err.location}); throw err; }
  }};
` }, bundle: true, format: 'esm', platform: 'neutral', conditions: ['workerd', 'node', 'production'],
  mainFields: ['module', 'main'], target: 'es2022', write: false, external: ['cloudflare:workers', 'node:crypto'],
  plugins: [{ name: 'fixture-env', setup(build) {
    build.onResolve({ filter: /^\$app\/env$/ }, () => ({ path: 'env', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const dev=false;export const browser=false;export const building=false;' }));
  } }] });
const runtime = new Miniflare({ host: '127.0.0.1', port: 0, cf: false, telemetry: { enabled: false }, workers: [{
  config: { name: 'privacy-readiness', compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
    env: { DB: { type: 'd1', id: 'isolated-privacy-readiness' } },
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: outputFiles[0].text } } } },
  dev: { outboundService: { type: 'fetcher', handler: () => { throw Error('Privacy tests must not send external requests'); } } }
}] });
async function request(path, fields) {
  const response = await runtime.dispatchFetch('https://fixture.example.invalid' + path, fields ? {
    method: 'POST', body: new URLSearchParams(fields)
  } : undefined);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
try {
  await request('/setup');
  for (const user of ['manager', 'support']) {
    assert.equal((await request('/queue?user=' + user)).status, 403);
    assert.equal((await request('/review?user=' + user, { status: 'closed', review_revision: 1 })).status, 403);
  }
  const queue = await request('/queue'); assert.equal(queue.status, 200);
  assert.equal(JSON.stringify(queue).includes('PRIVATE-FIXTURE-REQUEST'), false);
  const detail = await request('/detail'); assert.equal(detail.status, 200);
  assert.equal(detail.result.detail.details, 'PRIVATE-FIXTURE-REQUEST');
  const before = await request('/inspect');
  await request('/fail-audit');
  assert.equal((await request('/detail')).status, 503);
  assert.equal((await request('/review', { status: 'closed', review_revision: 1 })).status, 503);
  assert.deepEqual(await request('/inspect'), before);
  await request('/clear-audit');
  assert.equal((await request('/review', { status: 'awaiting_verification', review_revision: 1 })).status, 303);
  assert.equal((await request('/review', { status: 'closed', review_revision: 1 })).status, 409);
  assert.equal((await request('/review', { status: 'closed', review_revision: 2 })).status, 303);
  const after = await request('/inspect');
  assert.deepEqual(after.counts, before.counts); assert.equal(after.request.review_revision, 3); assert.equal(after.request.status, 'closed');
  assert.equal(after.audits.length, before.audits.length + 2); assert.deepEqual(after.foreignKeys, []);
  assert.equal(JSON.stringify(after.audits).includes('PRIVATE-FIXTURE-REQUEST'), false);
  assert.deepEqual(await request('/crypto'), { roundTrip: true, denied: [true, true, true, true], notPlaintext: true });
  await request('/expire-proof'); assert.equal((await request('/queue')).status, 200);
  assert.equal((await request('/review', { status: 'in_review', review_revision: 3 })).status, 403);
  await request('/revoke'); assert.equal((await request('/queue')).status, 403);
  console.log('PASS actual Workers/D1: owner-only review, audit-coupled reads/rollback, same-second conflicts, non-destructive closure, stale/revoked proof and HR encryption context isolation; no external requests');
} finally { await runtime.dispose(); }
