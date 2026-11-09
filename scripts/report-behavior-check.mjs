import assert from 'node:assert/strict';
import { createTestD1, loadServerModules } from './helpers/test-d1.mjs';

const test = createTestD1();
const { sqlite, db } = test;
const load = loadServerModules();
const history = load('src/lib/server/history.ts');
const reports = load('src/lib/server/reports.ts');
const policy = load('src/lib/server/reporting.ts');
const checklists = load('src/lib/server/checklistHistory.ts');
const now = Math.floor(Date.now() / 1000);
const params = { start: '2026-01-01', end: '2027-12-31' };
const locals = { DB: db, businessId: 'a', userId: 'a', businessRole: 'owner', businessPermissionTemplate: 'owner', businessTimeZone: 'UTC' };
function insert(table, row) {
  const keys = Object.keys(row);
  sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
}
const csv = (name, query = '', overrides = {}) => load(`src/routes/reports/${name}.csv/+server.ts`).GET({
  locals: { ...locals, ...overrides }, url: new URL(`https://criminiops.com/reports/${name}.csv?start=${params.start}&end=${params.end}${query}`)
});
try {
  for (const id of ['a','b']) {
    insert('businesses', { id, name: id, slug: id, created_at: now, updated_at: now });
    insert('users', { id, email: id+'@example.invalid', email_normalized: id+'@example.invalid', display_name: 'Person '+id, created_at: now, updated_at: now });
    insert('business_users', { business_id: id, user_id: id, role: 'owner', permission_template: 'owner', created_at: now, updated_at: now });
    insert('checklist_sections', { id, business_id: id, title: 'Closing', slug: 'closing', created_at: now, updated_at: now });
    for (const suffix of ['1','2']) insert('checklist_items', { id:id+suffix, business_id:id, section_id:id, content:'Task '+suffix, created_at:now, updated_at:now });
  }
  const countRuns = () => sqlite.prepare('SELECT COUNT(*) n FROM checklist_completed_runs').get().n;
  await history.setListItemCompletion(db,'a','checklists','a','a1','a',1);
  assert.equal(countRuns(),0);
  await history.setListItemCompletion(db,'a','checklists','a','a2','a',1);
  assert.equal(countRuns(),1);
  const firstRun = sqlite.prepare('SELECT id FROM checklist_completed_runs').get().id;
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM checklist_completed_run_items').get().n,2);
  await history.setListItemCompletion(db,'a','checklists','a','a2','a',1);
  await history.setListItemCompletion(db,'a','checklists','a','a1','a',0);
  await history.setListItemCompletion(db,'a','checklists','a','a1','a',1);
  assert.equal(countRuns(),1,'Only Reset permits another completed run');
  assert.equal(await history.setListItemCompletion(db,'a','checklists','b','b1','a',1),null);
  assert.equal(countRuns(),1);
  sqlite.exec("UPDATE users SET display_name='Changed' WHERE id='a'; UPDATE checklist_items SET content='Changed task' WHERE id='a1'; UPDATE checklist_sections SET title='Changed list' WHERE id='a'");
  const original = await history.loadListHistoryReport(db,'a','checklists',{...params,batchId:firstRun});
  assert.equal(original.rows.length,2);
  assert.ok(original.rows.every(row=>row.submitted_by_name==='Person a'&&row.completed_by_name==='Person a'&&row.section_title_snapshot==='Closing'));
  assert.ok(original.rows.some(row=>row.item_name_snapshot==='Task 1'));
  assert.equal((await history.loadListHistoryReport(db,'b','checklists',{...params,batchId:firstRun})).rows.length,0);
  await checklists.resetChecklistRun(db,'a','a');
  await history.setListItemCompletion(db,'a','checklists','a','a1','a',1);
  sqlite.exec("CREATE TRIGGER fixture_report_failure BEFORE INSERT ON checklist_completed_run_items BEGIN SELECT RAISE(ABORT,'report rollback'); END");
  await assert.rejects(history.setListItemCompletion(db,'a','checklists','a','a2','a',1),/report rollback/);
  assert.equal(sqlite.prepare("SELECT is_checked FROM checklist_items WHERE id='a2'").get().is_checked,0);
  assert.equal(countRuns(),1);
  sqlite.exec('DROP TRIGGER fixture_report_failure');
  await history.setListItemCompletion(db,'a','checklists','a','a2','a',1);
  assert.equal(countRuns(),2);
  assert.throws(()=>insert('checklist_completed_run_items',{run_id:firstRun,business_id:'b',item_id:'copied',item_name_snapshot:'No',completed_by_name_snapshot:'No'}),/FOREIGN KEY/);
  const oldId=crypto.randomUUID();
  insert('checklist_completed_runs',{id:oldId,business_id:'b',section_id:'deleted',section_title_snapshot:'Old',submitted_by_name_snapshot:'Person b',submitted_at:now-61*86400});
  insert('checklist_completed_run_items',{run_id:oldId,business_id:'b',item_id:'old-item',item_name_snapshot:'Old task',completed_by_name_snapshot:'Person b'});
  assert.equal((await history.loadListHistoryReport(db,'b','checklists',params)).rows.length,0,'Expired history is not exposed while cleanup catches up');
  await checklists.cleanupChecklistHistory(db,now);
  assert.equal(countRuns(),2);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM checklist_completed_run_items WHERE run_id=?').get(oldId).n,0);
  console.log('PASS completed checklist runs: atomic snapshots, executor/title preservation, reset-only next run, copied-ID denial, rollback, composite tenant FK and 60-day cleanup');

  for(const id of ['a','b']) {
    insert('list_sections',{id:'prep-'+id,business_id:id,domain:'preplists',slug:'daily',title:'Daily',created_at:now,updated_at:now});
    insert('list_items',{id:'rice-'+id,business_id:id,section_id:'prep-'+id,content:'Rice',created_at:now,updated_at:now});
    await history.setListItemCompletion(db,id,'preplists','prep-'+id,'rice-'+id,id,1);
    await history.recordListSubmission(db,id,'preplists','prep-'+id,id,new Map([['rice-'+id,'4']]));
  }
  await history.recordListSubmission(db,'a','preplists','prep-a','a',new Map([['rice-a','5']]));
  const batches=sqlite.prepare("SELECT id FROM list_submission_batches WHERE business_id='a'").all();
  assert.equal(batches.length,2);
  assert.equal((await history.loadListHistoryReport(db,'a','preplists',{...params,batchId:batches[0].id})).rows.length,1);
  assert.equal((await history.loadListHistoryReport(db,'b','preplists',{...params,batchId:batches[0].id})).rows.length,0);
  const before=await history.loadListHistoryReport(db,'a','preplists',params);
  sqlite.exec("UPDATE users SET display_name='Renamed again' WHERE id='a'; DELETE FROM list_item_activity_events WHERE business_id='a' AND domain='preplists'");
  assert.deepEqual((await history.loadListHistoryReport(db,'a','preplists',params)).rows,before.rows,'Snapshots must not depend on current activity or names');
  console.log('PASS list batches use unique IDs, preserve submitter/executor snapshots and cannot select another tenant');

  const fullBatch='whole-prep';
  insert('list_submission_batches',{id:fullBatch,business_id:'a',domain:'preplists',section_id:'prep-a',section_title_snapshot:'Whole prep',submitted_by:'a',submitted_at:now,business_day:new Date(now*1000).toISOString().slice(0,10)});
  sqlite.prepare(`WITH RECURSIVE n(x) AS(SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1005)
    INSERT INTO list_submission_items(id,batch_id,business_id,item_id,item_name_snapshot,submitted_value)
    SELECT 'whole-item-'||x,?,'a','current-'||x,'Item '||x,'3' FROM n`).run(fullBatch);
  const fullPreview=await history.loadListHistoryReport(db,'a','preplists',{...params,batchId:fullBatch});
  assert.equal(fullPreview.rows.length,1000);assert.equal(fullPreview.hasMore,true);
  assert.equal((await (await csv('lists','&domain=preplists&batch_id='+fullBatch)).text()).trim().split('\n').length,1006);
  assert.equal((await (await csv('lists','&domain=preplists&batch_id='+fullBatch,{businessId:'b'})).text()).trim().split('\n').length,1);
  for(const id of ['a','b']) {
    insert('schedule_publish_history',{id:'publish-'+id,business_id:id,schedule_week_id:'week-'+id,week_start:'2026-11-01',published_by:id,published_at:now,version_number:1});
    sqlite.prepare(`WITH RECURSIVE n(x) AS(SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<?)
      INSERT INTO schedule_shift_history(id,publish_history_id,business_id,shift_id_snapshot,shift_date,employee_name_snapshot,department,role_name,start_time,end_label)
      SELECT ?||x,?,?,'shift-'||x,'2026-11-02',?,'Custom department','Chef','09:00','17:00' FROM n`)
      .run(id==='a'?1505:1,'snapshot-'+id,'publish-'+id,id,'Person '+id);
  }
  const schedulePreview=await history.loadScheduleHistoryReport(db,'a',{...params,publishId:'publish-a'});
  assert.equal(schedulePreview.rows.length,1500);assert.equal(schedulePreview.hasMore,true);
  assert.equal((await (await csv('schedule','&publish_id=publish-a')).text()).trim().split('\n').length,1506);
  assert.equal((await (await csv('schedule','&publish_id=publish-a',{businessId:'b'})).text()).trim().split('\n').length,1);
  assert.equal((await history.loadScheduleHistoryReport(db,'a',{...params,publishId:"' OR 1=1--"})).rows.length,0);
  console.log('PASS whole prep submissions and published schedule versions export beyond preview caps; copied/SQL-shaped IDs cannot select another tenant');

  const availability = Array.from({length:7},(_,weekday)=>({weekday,isAvailable:weekday===1,startTime:weekday===1?'09:00':'',endTime:weekday===1?'17:00':''}));
  for(const id of ['a','b']) insert('user_schedule_availability_requests',{
    id:'availability-'+id,business_id:id,user_id:id,availability_json:JSON.stringify(availability),
    status:'approved',manager_note:'Reviewed '+id,created_at:now,updated_at:now,resolved_at:now,resolved_by_user_id:id
  });
  const requests = await reports.loadScheduleRequestsReport(db,'a',params);
  assert.ok(sqlite.prepare('EXPLAIN QUERY PLAN SELECT id FROM user_schedule_availability_requests WHERE business_id=? AND updated_at>=? AND updated_at<? ORDER BY updated_at DESC').all('a',0,now+1)
    .some(row=>row.detail.includes('idx_schedule_availability_requests_business_updated')));
  assert.equal(requests.rows.length,1); assert.equal(requests.rows[0].request_type,'availability');
  assert.match(requests.rows[0].detail,/Monday: 09:00-17:00/);
  assert.match(requests.rows[0].detail,/Sunday: Unavailable/);
  assert.equal(requests.rows[0].manager_note,'Reviewed a');
  assert.ok(!JSON.stringify(requests).includes('availability_json'));
  for(const [businessRole,businessPermissionTemplate] of [['owner','owner'],['manager','foh_manager'],['manager','hr_manager'],['external','consultant']]) {
    const response = await csv('requests','',{businessRole,businessPermissionTemplate});
    const content = await response.text();
    assert.match(content,/availability/); assert.match(content,/Reviewed a/); assert.ok(!content.includes('Reviewed b'));
  }
  await assert.rejects(csv('requests','',{businessCapabilities:[]}),{location:'/app'});
  sqlite.prepare("UPDATE user_schedule_availability_requests SET availability_json='invalid' WHERE business_id='a'").run();
  assert.equal((await reports.loadScheduleRequestsReport(db,'a',params)).rows[0].detail,'Availability not recorded');
  console.log('PASS availability requests: readable seven-day details, preserved business-wide manager/HR/consultant reports, capability denial and tenant isolation');

  for(const id of ['a','b']) insert('waste_logs',{id:'waste-'+id,business_id:id,submitted_by_user_id:id,product:'Product '+id,amount:1,reason:'Discarded',created_at:now});
  insert('waste_logs',{id:'waste-a2',business_id:'a',submitted_by_user_id:'a',product:'Second same-second product',amount:2,reason:'Discarded',created_at:now});
  assert.equal((await reports.loadWasteReport(db,'a',{...params,entryId:'waste-a'})).rows.length,1);
  assert.equal((await reports.loadWasteReport(db,'a',{...params,entryId:'waste-b'})).rows.length,0);
  assert.equal((await reports.loadWasteReport(db,'a',{...params,entryId:"' OR 1=1 --"})).rows.length,0);
  sqlite.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1005)
    INSERT INTO waste_logs(id,business_id,submitted_by_user_id,product,amount,reason,created_at)
    SELECT 'bulk-'||x,'a','a','Bulk '||x,1,'Discarded',? FROM n`).run(now);
  const preview=await reports.loadWasteReport(db,'a',params);
  assert.equal(preview.rows.length,1000); assert.equal(preview.hasMore,true);
  const full=await csv('waste'); const text=await full.text();
  assert.equal(text.trim().split('\n').length,1008,'The CSV includes all 1007 records, not the preview cap');
  assert.equal(full.headers.get('cache-control'),'private, no-store');
  assert.equal(full.headers.get('x-report-time-zone'),'UTC');
  assert.equal((await (await csv('waste','&entry_id=waste-a')).text()).trim().split('\n').length,2);
  sqlite.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<9000)
    INSERT INTO waste_logs(id,business_id,submitted_by_user_id,product,amount,reason,created_at)
    SELECT 'overflow-'||x,'a','a','Extra',1,'Discarded',? FROM n`).run(now);
  await assert.rejects(csv('waste'),{status:413},'Oversized exports must reject, never silently shorten');
  console.log('PASS actual waste CSV: same-second isolation, SQL-shaped IDs, complete >1000-row export, explicit >10000-row rejection and private response headers');

  const fallback=policy.reportRange({timeZone:'America/Los_Angeles'},14,new Date('2026-11-08T01:00:00Z'));
  assert.equal(fallback.endDate,'2026-11-07');
  for(const date of ['2026-02-30','2026-13-01',"2026-01-01' OR 1=1--"]) assert.throws(()=>policy.reportRange({start:date,end:'2026-12-01'},14),{status:400});
  assert.throws(()=>policy.reportRange({start:'2026-12-01',end:'2026-01-01'},14),{status:400});
  assert.throws(()=>policy.reportRange({start:'2020-01-01',end:'2030-01-01'},14),{status:400});
  for(const [day,hours] of [['2026-03-08',23],['2026-11-01',25]]) {
    const range=policy.reportRange({start:day,end:day,timeZone:'America/New_York'},14);
    assert.equal(range.endTs-range.startTs,hours*3600);
  }
  for(const ts of ['2026-11-01T05:20:00Z','2026-11-01T06:20:00Z']) insert('temps',{business_id:'a',sensor_id:1,temperature:40,ts:Date.parse(ts)/1000});
  insert('temps',{business_id:'b',sensor_id:1,temperature:99,ts:Date.parse('2026-11-01T05:20:00Z')/1000});
  const hourly=await reports.loadTemperatureHourlyAverageReport(db,'a',{start:'2026-11-01',end:'2026-11-01',timeZone:'America/New_York'});
  assert.equal(hourly.rows.length,2); assert.equal(new Set(hourly.rows.map(row=>row.event_hour)).size,2);
  assert.ok(hourly.rows.every(row=>row.avg_temperature===40&&row.reading_count===1&&row.avg_humidity_pct===null&&row.event_date==='2026-11-01'));
  insert('temps',{business_id:'a',sensor_id:2,temperature:20,humidity_pct:50,ts:Date.parse('2026-11-01T18:40:00Z')/1000});
  const india=await reports.loadTemperatureHourlyAverageReport(db,'a',{start:'2026-11-02',end:'2026-11-02',timeZone:'Asia/Kolkata'});
  assert.equal(india.rows.length,1);assert.equal(india.rows[0].event_date,'2026-11-02');assert.match(india.rows[0].event_hour,/00:00/);
  const plan=sqlite.prepare('EXPLAIN QUERY PLAN SELECT id FROM waste_logs WHERE business_id=? AND created_at>=? AND created_at<?').all('a',0,now+1);
  assert.ok(plan.some(row=>row.detail.includes('idx_waste_logs_business_created')));
  console.log('PASS restaurant-local dates, invalid/reversed/excessive ranges, 23/25-hour DST days, repeated hours, half-hour zones, missing humidity and indexed timestamp filters');

  for(const value of ['=SUM(1,1)',' +1','\n=1','\ttext','\rtext','\uFF1D1+1','\uFF0B1','\uFF0D1','\uFF201']) assert.ok(history.csvEscape(value).replace(/^"/,'').startsWith("'"));
  assert.equal(history.csvEscape('a,"b"\nc'),'"a,""b""\nc"');
  assert.equal(history.csvEscape('caf\u00e9 \ud83c\udf44'),'caf\u00e9 \ud83c\udf44');
  for(const name of ['lists','schedule','requests','temperature','onboarding','waste']) {
    await assert.rejects(csv(name,'',{businessRole:'staff',businessPermissionTemplate:'staff'}),{location:'/app'});
  }
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  console.log('PASS CSV formula/control/full-width/quotes/newline/Unicode handling and denial of every unauthorized report endpoint');
} finally { test.close(); }
