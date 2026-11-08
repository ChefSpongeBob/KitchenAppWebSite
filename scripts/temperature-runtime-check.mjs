import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createTestD1 } from './helpers/test-d1.mjs';

const fixture = createTestD1();
const schema = fixture.sqlite.prepare(`SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
  ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END`).all().map(row => row.sql);
fixture.close();
const require = createRequire(import.meta.url);
const tools = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = tools('miniflare');
const { build } = tools('esbuild');
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const { outputFiles } = await build({
  stdin: { contents: `
    import { POST } from './src/routes/api/temps/+server.ts';
    import { claimTemperatureGateway, claimTemperatureSensorNode } from './src/lib/server/temperatureDeviceProvisioning.ts';
    let ready = false;
    export default { async fetch(request, env) {
      const db = env.DB;
      if (!ready) {
        await db.batch(${JSON.stringify(schema)}.map(sql => db.prepare(sql)));
        const now = Math.floor(Date.now()/1000);
        await db.prepare("INSERT INTO businesses (id,name,slug,created_at,updated_at) VALUES ('a','Fixture','fixture',?,?)").bind(now,now).run();
        await db.prepare("INSERT INTO business_trials (business_id,status,trial_started_at,trial_ends_at,created_at,updated_at) VALUES ('a','active',?,?,?,?)").bind(now,now,now,now).run();
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('runtime-fixture-credential')));
        const hash = Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
        await db.prepare("INSERT INTO iot_device_inventory (serial,device_type,key_hash,key_prefix,created_at,updated_at) VALUES ('runtime-gateway','sensor_gateway',?,'fixture',?,?)").bind(hash,now,now).run();
        const gateway = await claimTemperatureGateway(db,{businessId:'a',serial:'runtime-gateway',displayName:'Fixture gateway'});
        for (const nodeSerial of ['runtime-node-1','runtime-node-2']) await claimTemperatureSensorNode(db,{businessId:'a',gatewayDeviceId:gateway.id,nodeSerial,displayName:nodeSerial});
        ready = true;
      }
      if (request.headers.get('x-fixture-inspect')) return Response.json({
        readings:(await db.prepare('SELECT node_serial,packet_sequence,last_seen_at FROM temperature_sensor_nodes ORDER BY node_serial').all()).results,
        count:(await db.prepare('SELECT COUNT(*) n FROM temps').first()).n,
        foreignKeys:(await db.prepare('PRAGMA foreign_key_check').all()).results
      });
      if (request.headers.get('x-fixture-fail')) await db.exec("CREATE TRIGGER fixture_node_failure BEFORE UPDATE ON temperature_sensor_nodes BEGIN SELECT RAISE(ABORT,'fixture node rollback'); END");
      try { return await POST({request,url:new URL(request.url),locals:{env,DB:db}}); }
      catch { return Response.json({error:'isolated transaction failure'},{status:500}); }
    }};`, resolveDir: process.cwd(), sourcefile: 'temperature-runtime-fixture.ts' },
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false,
  plugins: [{ name: 'production-environment', setup(build) {
    build.onResolve({ filter: /^\$app\/env$/ }, () => ({ path: 'environment', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const dev=false; export const building=false; export const browser=false;' }));
  } }]
});
const runtime = new Miniflare({ host: '127.0.0.1', port: 0, cf: false, telemetry: { enabled: false }, workers: [{
  config: { name: 'temperature-runtime-check', compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
    env: { DB: { type: 'd1', id: 'isolated-temperature-runtime' } },
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: outputFiles[0].text } } }
  },
  dev: { outboundService: { type: 'fetcher', handler: () => { throw Error('Temperature tests must not send network requests'); } } }
} ] });
const now = Math.floor(Date.now() / 1000);
const reading = (serial, sequence, nonce = 'abcdef01') => ({ node_serial: serial, packet_sequence: sequence, wake_nonce: nonce, temperature: 37, humidity_pct: 45, ts: now });
const post = (readings, extra = {}) => runtime.dispatchFetch('https://runtime.example.invalid/api/temps', { method: 'POST',
  headers: { 'content-type': 'application/json', 'x-device-id': 'runtime-gateway', 'x-device-key': 'runtime-fixture-credential', ...extra }, body: JSON.stringify({ readings }) });
const inspect = async () => (await runtime.dispatchFetch('https://runtime.example.invalid', { headers: { 'x-fixture-inspect': '1' } })).json();
try {
  const first = [reading('runtime-node-1', 1), reading('runtime-node-2', 1)];
  const response = await post(first);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { accepted: 2, rejected: 0, inserted: 2 });
  const initial = await inspect();
  assert.equal(initial.count, 2); assert.ok(initial.readings.every(row => row.packet_sequence === 1 && row.last_seen_at === now));
  assert.deepEqual(await (await post(first)).json(), { accepted: 0, rejected: 2, inserted: 0 });
  const contenders = await Promise.all([post([reading('runtime-node-1', 2)]), post([reading('runtime-node-1', 2, 'abcdef02')])]);
  const outcomes = await Promise.all(contenders.map(result => result.json()));
  assert.equal(outcomes.reduce((sum, row) => sum + row.inserted, 0), 1);
  const beforeFailure = await inspect();
  assert.equal(beforeFailure.count, 3);
  assert.equal((await post([reading('runtime-node-2', 2)], { 'x-fixture-fail': '1' })).status, 500);
  assert.deepEqual(await inspect(), beforeFailure, 'Actual D1 must roll back the reading and node state together');
  assert.deepEqual(beforeFailure.foreignKeys, []);
  console.log('PASS actual Workers/D1 temperature ingest: production helpers, JSON batch lookup, paired changes() state updates, replay/concurrency and late-failure rollback; no network or production data');
} finally { await runtime.dispose(); }
