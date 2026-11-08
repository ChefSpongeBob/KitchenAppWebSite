import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
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
const { outputFiles } = await build({ stdin: { resolveDir: process.cwd(), sourcefile: 'schedule-runtime-fixture.ts', contents: `
  import { saveScheduleWeekDraft, publishScheduleWeek, saveUserScheduleAvailability, approveScheduleAvailabilityRequest,
    offerScheduleShift, requestScheduleShiftOffer, approveScheduleShiftOffer } from './src/lib/server/schedules.ts';
  let ready = false;
  export default { async fetch(request, env) {
    const db = env.DB;
    if (!ready) {
      await db.batch(${JSON.stringify(schema)}.map(sql => db.prepare(sql)));
      const now = Math.floor(Date.now()/1000);
      await db.prepare("INSERT INTO businesses (id,name,slug,time_zone,created_at,updated_at) VALUES ('a','Fixture','fixture','America/Los_Angeles',?,?)").bind(now,now).run();
      for (const [name,role,department] of [['owner','owner',null],['manager','manager','Kitchen'],['alice','staff','Kitchen'],['bob','staff','Kitchen'],['service','staff','Service']]) {
        await db.prepare('INSERT INTO users (id,email,email_normalized,created_at,updated_at) VALUES (?,?,?,?,?)').bind(name,name+'@example.invalid',name+'@example.invalid',now,now).run();
        await db.prepare('INSERT INTO business_users (business_id,user_id,role,permission_template,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind('a',name,role,role==='manager'?'general_manager':role,now,now).run();
        if (department) await db.prepare('INSERT INTO user_schedule_departments (business_id,user_id,department,updated_at) VALUES (?,?,?,?)').bind('a',name,department,now).run();
      }
      for (const department of ['Kitchen','Service']) {
        await db.prepare('INSERT INTO schedule_departments (id,business_id,name,created_at,updated_at) VALUES (?,?,?,?,?)').bind(department,'a',department,now,now).run();
        await db.prepare('INSERT INTO schedule_role_definitions (id,business_id,department,role_name,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(department,'a',department,'Team',now,now).run();
      }
      ready = true;
    }
    const body = await request.json();
    if (body.operation === 'inspect') return Response.json({
      live:(await db.prepare('SELECT department,start_time,user_id FROM schedule_shifts ORDER BY department').all()).results,
      draft:(await db.prepare('SELECT department,start_time FROM schedule_draft_shifts ORDER BY department').all()).results,
      history:(await db.prepare('SELECT COUNT(*) n FROM schedule_publish_history').first()).n,
      events:(await db.prepare("SELECT COUNT(*) n FROM operational_events WHERE event_type='schedule.published'").first()).n,
      availability:(await db.prepare('SELECT weekday,start_time FROM user_schedule_availability ORDER BY weekday').all()).results,
      requests:(await db.prepare('SELECT id,status FROM user_schedule_availability_requests ORDER BY rowid').all()).results,
      foreignKeys:(await db.prepare('PRAGMA foreign_key_check').all()).results
    });
    if (body.operation === 'fail-review') await db.exec("CREATE TRIGGER fixture_fail_availability BEFORE INSERT ON user_schedule_availability BEGIN SELECT RAISE(ABORT,'fixture availability rollback'); END");
    if (body.operation === 'fail-transfer') await db.exec("CREATE TRIGGER fixture_fail_history BEFORE INSERT ON schedule_publish_history BEGIN SELECT RAISE(ABORT,'fixture approval rollback'); END");
    const name = body.actor ?? 'owner';
    const role = name === 'owner' ? 'owner' : name === 'manager' ? 'manager' : 'staff';
    const locals = {DB:db,env,businessId:'a',userId:name,businessRole:role,businessPermissionTemplate:role==='manager'?'general_manager':role,businessTimeZone:'America/Los_Angeles'};
    const form = new Request('https://fixture.example.invalid/admin/schedule',{method:'POST',body:new URLSearchParams(body.fields ?? {})});
    try {
      const result = body.operation === 'save' ? await saveScheduleWeekDraft(form,locals)
        : body.operation === 'publish' ? await publishScheduleWeek(form,locals)
        : body.operation === 'submit-availability' ? await saveUserScheduleAvailability(form,locals)
        : body.operation === 'offer' ? await offerScheduleShift(form,locals)
        : body.operation === 'request' ? await requestScheduleShiftOffer(form,locals)
        : ['transfer','fail-transfer'].includes(body.operation) ? await approveScheduleShiftOffer(form,locals)
        : await approveScheduleAvailabilityRequest(form,locals);
      return Response.json(result);
    } catch { return Response.json({error:'isolated transaction failure'},{status:500}); }
  }};` }, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false,
  plugins: [{ name: 'production-environment', setup(build) {
    build.onResolve({ filter: /^\$app\/env$/ }, () => ({ path: 'environment', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const dev=false;export const building=false;export const browser=false;' }));
  } }]
});
const runtime = new Miniflare({ host: '127.0.0.1', port: 0, cf: false, telemetry: { enabled: false }, workers: [{
  config: { name: 'schedule-runtime-check', compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
    env: { DB: { type: 'd1', id: 'isolated-schedule-runtime' } },
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: outputFiles[0].text } } } },
  dev: { outboundService: { type: 'fetcher', handler: () => { throw Error('Scheduling tests must not send network requests'); } } }
} ] });
const dispatch = (operation, fields = {}, actor = 'owner') => runtime.dispatchFetch('https://fixture.example.invalid', {
  method: 'POST', body: JSON.stringify({ operation, fields, actor }), headers: { 'content-type': 'application/json' }
});
const action = async (...args) => { const response = await dispatch(...args); assert.equal(response.status, 200); return response.json(); };
const inspect = () => action('inspect');
const fields = { week_start: '2026-11-02', draft_version: '0', payload: JSON.stringify(['Kitchen','Service'].map((department,index) => ({
  id:'shift-'+index,userId:index?'service':'alice',department,role:'Team',shiftDate:'2026-11-02',startTime:'09:00',endLabel:'17:00',breakMinutes:30
}))) };
try {
  assert.equal((await action('save', fields)).success, true);
  const publish = { week_start: fields.week_start, draft_version: '1' };
  const partial = await action('publish', publish, 'manager');
  assert.equal(partial.success, true); assert.equal(partial.hasUnpublishedChanges, true);
  assert.equal((await inspect()).live.length, 1);
  assert.equal((await action('publish', publish, 'manager')).success, true);
  assert.equal((await inspect()).history, 1);
  assert.equal((await action('publish', publish)).success, true);
  const published = await inspect(); assert.equal(published.live.length, 2); assert.equal(published.history, 2); assert.equal(published.events, 2);
  await action('offer', {shift_id:'shift-0'}, 'alice'); await action('request', {shift_id:'shift-0'}, 'bob');
  assert.equal((await action('transfer', {shift_id:'shift-0'}, 'manager')).success, true);
  const transferred = await inspect(); assert.equal(transferred.live.find(row=>row.department==='Kitchen').user_id, 'bob'); assert.equal(transferred.history, 3);
  await action('offer', {shift_id:'shift-0'}, 'bob'); await action('request', {shift_id:'shift-0'}, 'alice');
  assert.equal((await dispatch('fail-transfer', {shift_id:'shift-0'}, 'manager')).status, 500);
  assert.deepEqual((await inspect()).live, transferred.live); assert.equal((await inspect()).history, 3);
  const availability = JSON.stringify(Array.from({length:7},(_,weekday)=>({weekday,isAvailable:true,startTime:'09:00',endTime:'17:00'})));
  await action('submit-availability', { availability }, 'alice');
  const pending = (await inspect()).requests.find(row=>row.status==='pending');
  assert.equal((await action('review', {request_id:pending.id}, 'manager')).success, true);
  const approved = await inspect(); assert.equal(approved.availability.length, 7); assert.ok(approved.availability.every(row=>row.start_time==='09:00'));
  await action('submit-availability', {availability:availability.replaceAll('09:00','11:00')}, 'alice');
  const second = (await inspect()).requests.find(row=>row.status==='pending');
  assert.equal((await dispatch('fail-review', {request_id:second.id}, 'manager')).status, 500);
  const rolledBack = await inspect(); assert.deepEqual(rolledBack.availability, approved.availability);
  assert.equal(rolledBack.requests.find(row=>row.id===second.id).status, 'pending');
  assert.deepEqual(rolledBack.foreignKeys, []);
  console.log('PASS actual Workers/D1 scheduling: scoped publish/retry/history/events, transfer guards/history, seven-row availability upsert and late-failure atomic rollback; no network or production data');
} finally { await runtime.dispose(); }
