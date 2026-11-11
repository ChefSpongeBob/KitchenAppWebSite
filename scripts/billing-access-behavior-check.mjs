import assert from 'node:assert/strict';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

const now = Math.floor(Date.now() / 1000);
const quiet = { logOperationalEvent() {}, logOperationalError() {} };
function fixture() {
  const t = createTestD1();
  const insert = (table, row) => {
    const keys = Object.keys(row);
    t.sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
  };
  for (const id of ['a','b']) {
    insert('users', { id: 'owner-' + id, email: `${id}@example.invalid`, email_normalized: `${id}@example.invalid`, created_at: now, updated_at: now });
    insert('businesses', { id, name: id, slug: id, status: 'active', created_at: now, updated_at: now });
    insert('business_users', { business_id: id, user_id: 'owner-' + id, role: 'owner', permission_template: 'owner', created_at: now, updated_at: now });
    insert('business_trials', { business_id: id, owner_user_id: 'owner-' + id, status: 'active', trial_started_at: now, trial_ends_at: now, created_at: now, updated_at: now });
  }
  insert('users', { id: 'employee', email: 'employee@example.invalid', email_normalized: 'employee@example.invalid', created_at: now, updated_at: now });
  insert('business_users', { business_id: 'a', user_id: 'employee', role: 'staff', permission_template: 'staff', created_at: now, updated_at: now });
  insert('employee_profiles', { business_id: 'a', user_id: 'employee', real_name: 'Retained identity', updated_at: now });
  insert('store_products', { id: 'fixture-product', store: 'google_play', product_id: 'fixture.plan', display_name: 'Existing fixture plan',
    entitlement_key: 'plan.fixture', plan_tier: 'growth', billing_period: 'monthly', price_cents: 4900, currency: 'USD', created_at: now, updated_at: now });
  const env = { DB: t.db, APP_BASE_URL: 'https://criminiops.com' };
  const load = loadServerModules({ '#lib/server/observability.ts': quiet,
    '#lib/server/operationalEvents.ts': { async recordOperationalEventBestEffort() {} } });
  const locals = { DB: t.db, env, userId: 'owner-a', businessId: 'a', userRole: 'admin', businessRole: 'owner', businessPermissionTemplate: 'owner' };
  const entitlement = (changes = {}) => insert('business_store_entitlements', { id: 'entitlement-a', business_id: 'a', owner_user_id: 'owner-a',
    store: 'google_play', product_id: 'fixture.plan', entitlement_key: 'plan.fixture', plan_tier: 'growth',
    purchase_token_hash: 'retained-token-hash', status: 'active', verified_at: now - 100, expires_at: now + 3600, current_period_end: now + 3600,
    raw_payload_json: '{"retained":"provider-response"}', created_at: now, updated_at: now, ...changes });
  const access = (id = 'a') => load('src/lib/server/trial.ts').getBusinessTrialAccess(t.db, id, now);
  const submit = (body, who = locals) => load('src/routes/api/billing/native-purchase/+server.ts').POST({ locals: who,
    request: new Request('https://criminiops.com/api/billing/native-purchase', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  return { ...t, get queryCount() { return t.queryCount; }, insert, entitlement, env, load, locals, access, submit };
}
const failures = [];
let passed = 0;
async function check(label, run) {
  const t = fixture();
  try { await run(t); assert.deepEqual(t.sqlite.prepare('PRAGMA foreign_key_check').all(), []); passed++; console.log('PASS ' + label); }
  catch (error) { failures.push(label); console.error('FAIL ' + label + ': ' + error.message); }
  finally { t.close(); }
}

await check('server-granted pilot access needs no store setup and remains a one-statement read with no mutations', async t => {
  const queries = t.queryCount, writes = t.sqlite.prepare('SELECT total_changes() n').get().n;
  assert.equal((await t.access()).allowApp, true); assert.equal(t.queryCount - queries, 1);
  assert.equal(t.sqlite.prepare('SELECT total_changes() n').get().n, writes);
});
for (const state of ['pending_payment','past_due','expired','canceled','suspended','unknown']) await check(state + ' cannot grant operational access or purge data', async t => {
  t.sqlite.prepare("UPDATE business_trials SET status=? WHERE business_id='a'").run(state);
  const result = await t.access(); assert.equal(result.allowApp, false); assert.equal(result.shouldPurge, false);
  assert.ok(t.sqlite.prepare("SELECT * FROM employee_profiles WHERE business_id='a'").get());
});
await check('missing billing and still-running public trials fail closed in production', async t => {
  t.sqlite.exec("DELETE FROM business_trials WHERE business_id='a'"); assert.equal((await t.access()).allowApp, false);
  t.insert('business_trials', { business_id:'a',status:'trialing',trial_started_at:now,trial_ends_at:now+3600,created_at:now,updated_at:now });
  assert.equal((await t.access()).allowApp, false);
});
for (const status of ['active','grace_period']) await check('current verified ' + status + ' plan permits the whole restaurant', async t => {
  t.entitlement({ status }); assert.equal((await t.access()).allowApp, true);
});
for (const [label, changes] of [
  ['expired', { expires_at: now - 1 }], ['exact expiry second', { expires_at: now }],
  ['revoked', { status:'refunded' }], ['missing expiry', { expires_at:null,current_period_end:null }],
  ['malformed expiry', { expires_at:'not-a-timestamp' }]
]) await check('cached active billing cannot bypass a ' + label + ' verified plan', async t => {
  t.entitlement(changes); assert.equal((await t.access()).allowApp, false);
  assert.equal(t.sqlite.prepare("SELECT status FROM business_trials WHERE business_id='a'").get().status, 'active', 'read gate does not rewrite billing history');
});
await check('another restaurant entitlement cannot revive an expired subscription', async t => {
  t.entitlement({ expires_at:now-1 }); t.entitlement({ id:'entitlement-b',business_id:'b',owner_user_id:'owner-b' });
  assert.equal((await t.access()).allowApp, false); assert.equal((await t.access('b')).allowApp, true);
});
await check('an unverified retry cannot downgrade or replace an already verified entitlement', async t => {
  t.entitlement(); const before = t.sqlite.prepare("SELECT * FROM business_store_entitlements WHERE id='entitlement-a'").get();
  const billing = t.load('src/lib/server/storeBilling.ts');
  await billing.upsertPendingStoreEntitlement(t.db, {businessId:'a',ownerUserId:'employee',purchaseTokenHash:'unverified-replacement',
    product:await billing.readStoreProduct(t.db,'google_play','fixture.plan'),rawPayload:{untrusted:true}});
  assert.deepEqual(t.sqlite.prepare("SELECT * FROM business_store_entitlements WHERE id='entitlement-a'").get(), before);
});
await check('unconfigured store submission cannot buy access, change the chosen business plan or trust client status', async t => {
  t.sqlite.exec("UPDATE business_trials SET status='pending_payment' WHERE business_id='a'");
  const response = await t.submit({store:'google_play',productId:'fixture.plan',purchaseToken:'isolated-unverified-token',
    businessId:'b',status:'active',verified:true,price:0,planTier:'enterprise'});
  assert.equal(response.status,202); assert.equal((await response.json()).ok,false); assert.equal((await t.access()).allowApp,false);
  assert.equal(t.sqlite.prepare("SELECT plan_tier FROM businesses WHERE id='a'").get().plan_tier,'starter');
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM business_store_entitlements WHERE business_id='b'").get().n,0);
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM business_store_entitlements WHERE business_id='a'").get().n,0);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM store_purchase_events').get().n,0);
});
await check('pending submission preserves the approved pilot grant even without store credentials', async t => {
  assert.equal((await t.submit({store:'google_play',productId:'fixture.plan',purchaseToken:'isolated-unverified-token'})).status,202);
  assert.equal((await t.access()).allowApp,true);
});
await check('production conversion form queues preferences, never turns a posted tier into payment', async t => {
  t.sqlite.exec("UPDATE business_trials SET status='pending_payment' WHERE business_id='a'");
  await assert.rejects(t.load('src/routes/billing/+page.server.ts').actions.convert({locals:t.locals,
    request:formRequest({plan_tier:'large',status:'active',paid:'1',addon_temp_monitoring:'1'},'/billing?/convert')}),{location:'/billing?store=queued'});
  assert.equal((await t.access()).allowApp,false);
  assert.equal(t.sqlite.prepare("SELECT status FROM store_billing_placeholders WHERE business_id='a'").get().status,'queued');
});
await check('invited employees inherit restaurant access but cannot purchase, read billing details or convert it', async t => {
  const staff = {...t.locals,userId:'employee',userRole:'user',businessRole:'staff',businessPermissionTemplate:'staff'};
  assert.equal((await t.access()).allowApp,true);
  assert.equal((await t.submit({store:'google_play',productId:'fixture.plan',purchaseToken:'invalid'},staff)).status,403);
  for (const path of ['products','status']) {
    const url = new URL('https://criminiops.com/api/billing/'+path);
    assert.equal((await t.load(`src/routes/api/billing/${path}/+server.ts`).GET({locals:staff,url,request:new Request(url)})).status,403);
  }
  assert.equal((await t.load('src/routes/billing/+page.server.ts').actions.convert({locals:staff,request:formRequest({},'/billing?/convert')})).status,403);
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM store_purchase_events').get().n,0);
});
await check('anonymous submissions and unauthorized provider callbacks cannot write billing rows', async t => {
  assert.equal((await t.submit({}, {...t.locals,userId:undefined})).status,401);
  for (const name of ['app-store-notifications','google-play-notifications']) {
    const url = new URL('https://criminiops.com/api/billing/'+name);
    const response = await t.load(`src/routes/api/billing/${name}/+server.ts`).POST({locals:t.locals,url,
      request:new Request(url,{method:'POST',headers:{authorization:'Bearer invalid','content-type':'application/json'},body:'{}'})});
    assert.equal(response.status,401);
  }
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM store_webhook_events').get().n,0);
});
await check('malformed JSON shapes fail as input errors, not uncaught exceptions', async t => {
  for (const body of [null,[],false,42]) assert.equal((await t.submit(body)).status,400);
});

await check('actual request hook blocks unpaid pages/actions/files/APIs; paid employees and the pilot remain usable', async t => {
  const auth = t.load('src/lib/server/auth.ts'), token='isolated-billing-hook-token';
  t.insert('sessions',{id:'employee-session',user_id:'employee',session_token_hash:await auth.hashSessionToken(token),created_at:now,last_seen_at:now,expires_at:now+3600});
  const hooks=loadServerModules({'cloudflare:workers':{env:t.env,waitUntil(){}},'#lib/server/observability.ts':quiet,
    '#lib/server/operationalEvents.ts':{async processOperationalEvents(){}},'#lib/server/platformDiagnostics.ts':{async recordRequestDiagnostic(){}}})('src/hooks.server.ts');
  const probe=async(path,method='GET')=>{
    const cookies=new Map([['__Host-kitchen_session',token],['kitchen_active_business','a']]);
    const url=new URL(path,'https://criminiops.com');let resolved=false;
    try { const response=await hooks.handle({event:{url,request:new Request(url,{method,headers:{origin:url.origin}}),locals:{},
      cookies:{get:k=>cookies.get(k),set:(k,v)=>cookies.set(k,v),delete:k=>cookies.delete(k)}},resolve:async()=>{resolved=true;return new Response('Allowed');}});
      return {response,resolved};
    } catch(error){return {error,resolved};}
  };
  assert.equal((await probe('/app')).resolved,true);
  t.entitlement({expires_at:now-1});
  for(const path of ['/app','/schedule','/lists','/reports/schedule.csv','/api/documents/media/businesses/a/private.pdf','/api/temps']) {
    for(const method of ['GET','POST']) {
      if(path==='/api/temps' && method==='POST')continue; // Machine uploads enforce billing in their authenticated handler.
      const result=await probe(path,method);assert.equal(result.resolved,false,path+' '+method);
      if(path.startsWith('/api/'))assert.equal(result.response.status,402);else assert.equal(result.error.location,'/billing?access=required');
    }
  }
  assert.equal((await probe('/workspace')).resolved,true);assert.equal((await probe('/privacy')).resolved,true);
  t.sqlite.exec("UPDATE businesses SET addon_temp_monitoring=1 WHERE id='a'");
  const device = await t.load('src/lib/server/iotIngest.ts').provisionIoTDevice(t.db,
    {businessId:'a',deviceType:'sensor_gateway',externalDeviceId:'isolated-billing-gateway',displayName:'Fixture'});
  const upload = await t.load('src/routes/api/temps/+server.ts').POST({locals:t.locals,url:new URL('https://criminiops.com/api/temps'),
    request:new Request('https://criminiops.com/api/temps',{method:'POST',headers:{'content-type':'application/json','x-device-id':'isolated-billing-gateway','x-device-key':device.deviceKey},body:'{"gateway_status":true}'})});
  assert.equal(upload.status,403);assert.equal((await upload.json()).error,'Workspace activation required.');
  assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM temps').get().n,0);
  t.sqlite.exec("UPDATE business_store_entitlements SET expires_at=unixepoch()+3600");assert.equal((await probe('/app')).resolved,true);
});

console.log(`Billing essentials: ${passed} cases passed; ${failures.length} failed.`);
if(failures.length)process.exitCode=1;
