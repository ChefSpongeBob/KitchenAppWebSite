import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createTestD1 } from './helpers/test-d1.mjs';

const fixture = createTestD1();
const schema = fixture.sqlite.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END")
  .all().map(row => row.sql);
fixture.close();
const require = createRequire(import.meta.url), runtimeTools = createRequire(require.resolve('wrangler/package.json'));
const { build } = runtimeTools('esbuild'), { Miniflare } = runtimeTools('miniflare');
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const { outputFiles } = await build({ stdin: { resolveDir: process.cwd(), sourcefile: 'staff-operations-runtime.ts', contents: `
  import { actions } from './src/routes/staff/equipment/+page.server.ts';
  import { changeStaffMembership } from './src/lib/server/platformStaffAdministration.ts';
  let initialize;
  export default { async fetch(request, env) {
    const db = env.DB, url = new URL(request.url), now = Math.floor(Date.now()/1000);
    if (!initialize) initialize = (async () => {
      for (const sql of ${JSON.stringify(schema)}) await db.prepare(sql).run();
      for (const id of ['a','b']) await db.prepare('INSERT INTO businesses(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id,id,now,now).run();
      for (const id of ['owner','support']) {
        await db.prepare('INSERT INTO users(id,email,email_normalized,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id+'@example.invalid',id+'@example.invalid',now,now).run();
        await db.prepare('INSERT INTO platform_staff_members(user_id,staff_role,granted_by,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id,id==='owner'?null:'owner',now,now).run();
        await db.prepare('INSERT INTO sessions(id,user_id,session_token_hash,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?)').bind(id+'-session',id,'fixture-'+id,now,now,now+3600).run();
        await db.prepare('INSERT INTO platform_staff_step_up(session_id,user_id,membership_revision,verified_at,email_verified_at) VALUES(?,?,1,?,?)').bind(id+'-session',id,now,now).run();
      }
      await db.prepare("INSERT INTO iot_device_inventory(serial,device_type,key_hash,key_prefix,created_at,updated_at) VALUES('gateway','sensor_gateway','fixture','fixture',?,?)").bind(now,now).run();
    })();
    await initialize;
    if (url.pathname === '/state') return Response.json({
      reservations:(await db.prepare('SELECT * FROM iot_device_reservations').all()).results,
      audit:(await db.prepare("SELECT action,business_id FROM platform_staff_audit WHERE action IN ('gateway_reserved','gateway_reservation_released','staff_access_updated') ORDER BY created_at,id").all()).results,
      role:(await db.prepare("SELECT staff_role,revision FROM platform_staff_members WHERE user_id='support'").first()),
      foreignKeys:(await db.prepare('PRAGMA foreign_key_check').all()).results
    });
    if (url.pathname === '/fail-audit') {
      await db.exec("CREATE TRIGGER fixture_staff_audit_failure BEFORE INSERT ON platform_staff_audit BEGIN SELECT RAISE(ABORT,'fixture audit rollback'); END");
      return Response.json({ok:true});
    }
    if (url.pathname === '/clear-audit-failure') { await db.exec('DROP TRIGGER fixture_staff_audit_failure'); return Response.json({ok:true}); }
    try {
      if (url.pathname === '/team') {
        const trace = {};
        const traced = {prepare:sql=>db.prepare(sql), async batch(statements) {
          const result = await db.batch(statements); trace.changes = result.map(row=>row.meta.changes); return result;
        }};
        try {
          await changeStaffMembership(traced,{userId:'owner',role:'owner'},'owner-session', {userId:'support',role:'equipment',active:1,revision:1,reason:'Approved test fixture'});
          return Response.json({success:true,trace});
        } catch (error) { return Response.json({error:'Isolated team operation denied',trace},{status:error.status||409}); }
      }
      const result = await actions[url.pathname === '/release'?'release':'reserve']({
        locals:{DB:db,env,userId:'owner',sessionId:'owner-session'}, request
      });
      return Response.json(result, {status:result.status || 200});
    } catch (error) { return Response.json({error:'Isolated operation denied'}, {status:error.status || 409}); }
  }};` }, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false,
  external: ['cloudflare:workers'], plugins: [{ name: 'fixture-kit-and-rate-budget', setup(build) {
    build.onResolve({ filter: /^@sveltejs\/kit$/ }, () => ({ path: 'kit', namespace: 'fixture' }));
    build.onResolve({ filter: /^#lib\/server\/security\.ts$/ }, () => ({ path: 'rate', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'kit'
      ? "export function error(status,message){throw Object.assign(Error(message),{status,body:{message}})}; export function fail(status,data){return{status,data}}; export const isHttpError=e=>Boolean(e.status);"
      : "export const checkRateLimit=async()=>({allowed:true}); export const rateLimitFailure=message=>({status:429,data:{error:message}});" }));
  } }] });
const runtime = new Miniflare({ host: '127.0.0.1', port: 0, cf: false, telemetry: { enabled: false }, workers: [{
  config: { name: 'staff-operations-isolated-runtime', compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
    env: { DB: { type: 'd1', id: 'isolated-staff-operations' } },
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: outputFiles[0].text } } } },
  dev: { outboundService: { type: 'fetcher', handler: () => { throw Error('Staff runtime fixtures must not send network requests or emails'); } } }
}] });
const request = (path, fields) => runtime.dispatchFetch('https://fixture.invalid' + path, fields ? {
  method: 'POST', body: new URLSearchParams(fields), headers: { 'content-type': 'application/x-www-form-urlencoded' }
} : undefined);
const state = async () => (await request('/state')).json();
const reserve = business => request('/reserve', { serial: 'gateway', business_id: business, reason: 'Fixture shipment', confirmed: 'yes' });
const release = (business, version) => request('/release', { serial: 'gateway', business_id: business, reservation_id: version, reason: 'Fixture cancellation', confirmed: 'yes' });
try {
  await state();
  const attempts = await Promise.all([reserve('a'), reserve('b')]);
  assert.deepEqual(attempts.map(response => response.status).sort(), [200,409]);
  let current = await state();
  assert.equal(current.reservations.length, 1); assert.equal(current.audit.length, 1);
  const first = current.reservations[0];
  const releases = await Promise.all([release(first.business_id,first.reservation_id), release(first.business_id,first.reservation_id)]);
  assert.deepEqual(releases.map(response => response.status).sort(), [200,409]);
  current = await state(); assert.equal(current.reservations.length,0); assert.equal(current.audit.length,2);
  const replacement = first.business_id === 'a'?'b':'a';
  assert.equal((await reserve(replacement)).status,200);
  current = await state(); const second = current.reservations[0]; assert.notEqual(second.reservation_id,first.reservation_id);
  assert.equal((await release(first.business_id,first.reservation_id)).status,409);
  assert.equal((await release(first.business_id,second.reservation_id)).status,409);
  assert.deepEqual((await state()).reservations,current.reservations);
  await request('/fail-audit');
  assert.equal((await release(second.business_id,second.reservation_id)).status,409);
  assert.deepEqual((await state()).reservations,current.reservations);
  assert.equal((await request('/team',{})).status,409);
  assert.deepEqual((await state()).role,{staff_role:'support',revision:1});
  await request('/clear-audit-failure');
  assert.equal((await release(second.business_id,second.reservation_id)).status,200);
  const teams = await Promise.all([request('/team',{}),request('/team',{})]);
  assert.deepEqual(teams.map(response=>response.status).sort(),[200,409],JSON.stringify(await Promise.all(teams.map(response=>response.clone().json()))));
  current = await state(); assert.deepEqual(current.role,{staff_role:'equipment',revision:2});
  assert.equal(current.audit.filter(row=>row.action==='staff_access_updated').length,1);
  assert.deepEqual(current.foreignKeys,[]);
  console.log('PASS actual isolated Workers/D1: concurrent reserve/release, cross-business/same-serial stale protection, atomic audit rollback and exactly-one team revision update');
} finally { await runtime.dispose(); }
