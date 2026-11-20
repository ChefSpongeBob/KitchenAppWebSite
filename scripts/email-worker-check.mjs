import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createTestD1 } from './helpers/test-d1.mjs';

const require = createRequire(import.meta.url);
const tools = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare, Response: WorkerResponse } = tools('miniflare');
const { build } = tools('esbuild');
const cloudflare = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const dispatcherConfig = JSON.parse(readFileSync('workers/operational-email-dispatcher/wrangler.jsonc', 'utf8'));
assert.ok(dispatcherConfig.compatibility_flags?.includes('nodejs_compat'), 'Dispatcher imports shared Node crypto and must enable its runtime compatibility');
const fixture = createTestD1();
const schema = fixture.sqlite.prepare(`SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
  ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END`).all().map(row => row.sql);
fixture.close();
const { outputFiles } = await build({
  stdin: { contents: `
    import { sendTransactionalEmail } from './src/lib/server/email.ts';
    import { recordOperationalEvent, processOperationalEvents } from './src/lib/server/operationalEvents.ts';
    import dispatcher from './workers/operational-email-dispatcher/index.js';
    export default { async fetch(request,bindings) {
      const url=new URL(request.url),db=bindings.DB,now=1700000000;
      const env={RESEND_API_KEY:'runtime-fixture',RESEND_FROM_EMAIL:'test@example.invalid'};
      if(url.pathname==='/dispatcher'){
        const jobs=[];
        dispatcher.scheduled({scheduledTime:60000},{SMOKE_INTERNAL_TOKEN:'runtime-internal-fixture',APP_BASE_URL:'https://criminiops.com'},
          {waitUntil(promise){jobs.push(promise)}});
        await Promise.all(jobs);return Response.json({completed:jobs.length});
      }
      if(url.pathname==='/setup'){
        await db.batch(${JSON.stringify(schema)}.map(sql=>db.prepare(sql)));
        for(const id of ['a','b'])await db.batch([
          db.prepare('INSERT INTO businesses(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id,id,now,now),
          db.prepare('INSERT INTO users(id,email,email_normalized,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id+'@example.invalid',id+'@example.invalid',now,now),
          db.prepare("INSERT INTO business_users(business_id,user_id,role,permission_template,created_at,updated_at) VALUES(?,?,'staff','staff',?,?)").bind(id,id,now,now)
        ]);
        return Response.json({ok:true});
      }
      if(url.pathname==='/event'){
        await db.prepare('DELETE FROM operational_events').run();
        await db.prepare("UPDATE business_users SET is_active=? WHERE business_id='a' AND user_id='a'").bind(url.searchParams.has('inactive')?0:1).run();
        return Response.json({id:await recordOperationalEvent(db,{businessId:'a',eventType:'onboarding.package.approved',category:'onboarding',targetUserId:'a',now})});
      }
      if(url.pathname==='/process')return Response.json(await processOperationalEvents(db,{env:url.searchParams.has('missing')?{}:env,
        now:now+Number(url.searchParams.get('offset')??0),maxAttempts:Number(url.searchParams.get('max')??6)}));
      if(url.pathname==='/inspect')return Response.json({
        events:(await db.prepare('SELECT business_id,delivery_status,delivery_attempts,next_attempt_at FROM operational_events').all()).results,
        receipts:(await db.prepare('SELECT business_id,status,error_message FROM operational_event_delivery_attempts').all()).results,
        foreignKeys:(await db.prepare('PRAGMA foreign_key_check').all()).results
      });
      return Response.json(await sendTransactionalEmail({
        env,
        to: 'employee@example.invalid', subject: 'Runtime check', html: '', text: ''
      }));
    }};`, resolveDir: process.cwd(), sourcefile: 'email-runtime-check.js' },
  bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', write: false,
  conditions: ['workerd', 'node', 'production'], external: ['cloudflare:workers', 'node:crypto'],
  plugins: [{ name: 'fixture-env', setup(build) {
    build.onResolve({ filter: /^\$app\/env$/ }, () => ({ path: 'env', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const dev=false;export const browser=false;export const building=false;' }));
  } }]
});
let status = 200, calls = 0, processorCalls = 0, mode = 'normal';
const privateFixture = 'fixture-private-token employee-private@example.invalid';
const recipients = [];
const runtime = new Miniflare({
  host: '127.0.0.1', port: 0, cf: false, telemetry: { enabled: false },
  workers: [{
    config: { name: 'email-runtime-check', compatibilityDate: dispatcherConfig.compatibility_date, compatibilityFlags: dispatcherConfig.compatibility_flags,
      env: { DB: { type: 'd1', id: 'isolated-email-runtime' } },
      manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: outputFiles[0].text } } } },
    dev: { outboundService: { type: 'fetcher', handler: async request => {
      if(request.url==='https://criminiops.com/api/internal/operational-events/process'){
        assert.equal(request.method,'POST');assert.equal(request.headers.get('authorization'),'Bearer runtime-internal-fixture');
        processorCalls++;return WorkerResponse.json({ok:true,checked:2,failed:2});
      }
      assert.equal(request.url, 'https://api.resend.com/emails');
      assert.equal(request.method, 'POST');
      assert.equal(request.headers.get('authorization'), 'Bearer runtime-fixture');
      calls++;
      recipients.push((await request.json()).to);
      if (mode === 'json-error') return WorkerResponse.json({ message: privateFixture }, { status: 503 });
      if (mode === 'text-error') return new WorkerResponse(privateFixture, { status: 503 });
      if (mode === 'invalid-json') return new WorkerResponse(privateFixture);
      if (mode === 'missing-receipt') return WorkerResponse.json({});
      return status === 200 ? WorkerResponse.json({ id: 'runtime-receipt' })
        : new WorkerResponse(null, { status, headers: { location: 'https://untrusted.example.invalid' } });
    } } }
  }]
});
async function request(path) {
  const response = await runtime.dispatchFetch('https://runtime.example.invalid' + path);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
try {
  assert.equal((await request('/dispatcher')).completed, 1);
  assert.equal(processorCalls, 1, 'Actual dispatcher startup/scheduled run must call the existing protected processor exactly once');
  for (status of [200, 301, 302, 303, 307, 308]) {
    const before = calls;
    const response = await runtime.dispatchFetch('https://runtime.example.invalid');
    const result = await response.json();
    assert.equal(calls, before + 1, 'Workerd must make exactly one provider request, never follow redirects');
    assert.equal(result.sent, status === 200);
    if (status !== 200) assert.equal(result.reason, 'Email provider returned an unexpected redirect.');
  }
  status = 200;
  for (mode of ['json-error', 'text-error', 'invalid-json', 'missing-receipt']) {
    const result = await request('/');
    assert.equal(result.sent, false);
    assert.ok(!JSON.stringify(result).includes(privateFixture), 'Workers must not return provider body contents');
  }
  mode = 'normal';
  await request('/setup'); await request('/event'); const beforeMissing = calls;
  assert.equal((await request('/process?missing=1')).retrying, 1);
  assert.equal(calls, beforeMissing);
  const pending = await request('/inspect');
  assert.equal(pending.events[0].delivery_status, 'pending'); assert.equal(pending.events[0].delivery_attempts, 1);
  assert.equal(pending.events[0].next_attempt_at, 1700000060);
  assert.equal((await request('/process?offset=59')).checked, 0);
  assert.equal((await request('/process?offset=60')).delivered, 1);
  assert.equal(calls, beforeMissing + 1); assert.equal(recipients.at(-1), 'a@example.invalid');
  assert.equal((await request('/process?offset=61')).checked, 0);
  await request('/event');
  assert.equal((await request('/process?missing=1&max=1')).failed, 1);
  assert.equal((await request('/process?offset=3600')).checked, 0, 'Existing attempt cap must terminate missing-configuration retries');
  await request('/event?inactive=1');
  assert.equal((await request('/process?missing=1')).skipped, 1, 'Removed recipients must not enter a retry loop');
  await request('/event'); mode = 'json-error';
  assert.equal((await request('/process?max=1')).failed, 1);
  const failed = await request('/inspect');
  assert.ok(!JSON.stringify(failed.receipts).includes(privateFixture));
  assert.ok(failed.receipts.every(row => row.business_id === 'a')); assert.deepEqual(failed.foreignKeys, []);
  console.log('PASS actual Workers/D1: provider failures redacted, missing mail configuration retries and recovers once, delay/cap respected, inactive recipient skipped and receipts stay tenant-scoped');
  console.log('PASS actual dispatcher runtime/config: shared Node imports boot and the scheduled task uses only the protected operational processor');
  console.log('PASS actual Workers runtime: email fetch options accepted, provider receipt confirmed, every redirect rejected without credential forwarding');
} finally { await runtime.dispose(); }
