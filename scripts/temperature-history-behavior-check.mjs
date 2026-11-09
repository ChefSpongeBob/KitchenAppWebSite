import assert from 'node:assert/strict';
import { createTestD1, loadServerModules } from './helpers/test-d1.mjs';
import { createTestR2 } from './helpers/test-r2.mjs';

const test = createTestD1();
const { sqlite, db } = test;
const storage = createTestR2();
const load = loadServerModules();
const api = load('src/routes/api/temps/+server.ts');
const retention = load('src/lib/server/retention.ts');
const archive = load('src/lib/server/temperatureArchive.ts');
const reports = load('src/lib/server/reports.ts');
const now = Math.floor(Date.now()/1000);
const day = new Date(now*1000).toISOString().slice(0,10);
const insert = (table,row) => { const keys=Object.keys(row); sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?')})`).run(...Object.values(row)); };
const allArchived = async businessId => {
  const rows=[]; await archive.visitTemperatureArchives(storage.bucket,businessId,now-60*86400,now+1,row=>rows.push(row),now); return rows;
};
try {
  for(const businessId of ['a','b']) {
    insert('businesses',{id:businessId,name:businessId,slug:businessId,created_at:now,updated_at:now});
    insert('iot_devices',{id:businessId,business_id:businessId,device_type:'sensor_gateway',external_device_id:businessId,display_name:businessId,key_hash:'fixture',key_prefix:'fixture',created_at:now,updated_at:now});
    for(let sensor=1;sensor<=25;sensor++) {
      insert('temperature_sensor_nodes',{id:businessId+sensor,business_id:businessId,gateway_device_id:businessId,node_serial:businessId+'-'+sensor,sensor_id:sensor,display_name:businessId+' Sensor '+sensor,last_seen_at:now,packet_sequence:50,created_at:now,updated_at:now});
      for(let sample=0;sample<50;sample++) insert('temps',{business_id:businessId,sensor_id:sensor,temperature:businessId==='a'?35+sample/10:170,humidity_pct:sample%2?null:50,ts:now-sample*1200});
    }
  }
  const locals = businessId => ({DB:db,env:{DB:db},businessId,businessTimeZone:'America/Denver'});
  async function get(businessId, query='view=history&sensor=1&limit=99999') {
    const url = new URL('https://criminiops.com/api/temps?'+query);
    return api.GET({url,request:new Request(url),locals:locals(businessId)});
  }
  const beforeQueries=test.queryCount;
  const response=await get('a');const history=await response.json();
  assert.equal(test.queryCount-beforeQueries,1); assert.equal(history.readings.length,24);
  assert.equal(history.intervalSeconds,1200);assert.equal(history.end-history.start,8*3600);
  assert.equal(history.timeZone,'America/Denver');assert.ok(history.readings.every(row=>row.temperature<100&&row.ts>now-8*3600));
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.ok((await (await get('b')).json()).readings.every(row=>row.temperature===170));
  for(const query of ['view=history','view=history&sensor=1%20OR%201=1','view=history&sensor=-1']) assert.equal((await get('a',query)).status,400);
  assert.equal((await (await get('a','view=history&sensor=99999')).json()).readings.length,0);
  sqlite.exec("UPDATE temperature_sensor_nodes SET is_active=0 WHERE business_id='a' AND sensor_id=2");
  assert.equal((await (await get('a','view=history&sensor=2')).json()).readings.length,0);
  sqlite.exec("UPDATE temperature_sensor_nodes SET is_active=1 WHERE business_id='a' AND sensor_id=2");
  console.log('PASS fixed eight-hour/24-reading history: one indexed tenant query, real timestamps, fixed cadence, malformed IDs and inactive nodes');

  const count = businessId => sqlite.prepare('SELECT COUNT(*) n FROM temps WHERE business_id=?').get(businessId).n;
  const original = count('a');
  await assert.rejects(retention.cleanupExpiredTemps(db,undefined,'a',undefined,now),/archive storage unavailable/);
  assert.equal(count('a'),original,'Missing R2 must not discard unarchived data');
  await assert.rejects(retention.cleanupExpiredTemps(db,{...storage.bucket,async put(){throw Error('R2 failure');}},'a',undefined,now),/R2 failure/);
  assert.equal(count('a'),original);
  for(let cycle=0;cycle<3;cycle++) await retention.cleanupExpiredTemps(db,storage.bucket,'a',undefined,now);
  assert.equal(count('a'),25*24); assert.equal(count('b'),25*50);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM temps WHERE business_id='a' AND ts < ?").get(now-23*1200).n,0);
  assert.equal((await allArchived('a')).length,25*26);
  assert.equal((await allArchived('b')).length,0);
  assert.ok(sqlite.prepare("SELECT packet_sequence FROM temperature_sensor_nodes WHERE business_id='a'").all().every(row=>row.packet_sequence===50),'Rotation cannot reset anti-replay counters');
  console.log('PASS 25-node rotation: 600 retained live rows, 650 archived rows, other tenant untouched, missing/failed archive preserves D1 and anti-replay state');

  const incoming = {id:900001,sensor_id:1,sensor_name:'Walk-in, "North"\nShelf',temperature:39,humidity_pct:null,ts:now-86400};
  await Promise.all([archive.archiveTemperatureReadings(storage.bucket,'a',[incoming],now),archive.archiveTemperatureReadings(storage.bucket,'a',[{...incoming,id:900002,temperature:41}],now)]);
  await archive.archiveTemperatureReadings(storage.bucket,'a',[incoming],now);
  const concurrent=(await allArchived('a')).filter(row=>row.id>=900000);
  assert.equal(concurrent.length,2);assert.equal(concurrent[0].sensor_name,incoming.sensor_name);assert.equal(concurrent[0].humidity_pct,null);
  await archive.archiveTemperatureReadings(storage.bucket,'b',[{...incoming,id:900004,temperature:-14.5,ts:now-86400}],now);
  assert.equal((await allArchived('b'))[0].temperature,-14.5,'Freezer measurements remain numeric, not formula-prefixed strings');
  const row=sqlite.prepare("SELECT id,sensor_id,temperature,humidity_pct,ts,'a Sensor 1' sensor_name FROM temps WHERE business_id='a' AND sensor_id=1 ORDER BY ts DESC LIMIT 1").get();
  await archive.archiveTemperatureReadings(storage.bucket,'a',[row],now);
  const report=await reports.loadTemperatureHourlyAverageReport(db,'a',{start:day,end:day,archiveBucket:storage.bucket});
  const expected=sqlite.prepare("SELECT COUNT(*) n FROM temps WHERE business_id='a' AND ts>=unixepoch(?) AND ts<unixepoch(?,'+1 day')").get(day,day).n+
    (await allArchived('a')).filter(r=>r.id!==row.id&&r.ts>=Date.parse(day)/1000&&r.ts<Date.parse(day)/1000+86400).length;
  assert.equal(report.rows.reduce((sum,r)=>sum+r.reading_count,0),expected,'R2 success followed by a failed D1 delete must not double-count reports');
  const raw = await reports.loadTemperatureReadingsReport(db,'a',{start:day,end:day,archiveBucket:storage.bucket,export:true});
  assert.equal(raw.rows.length,expected);
  assert.equal(new Set(raw.rows.map(r=>r.id)).size,expected);
  assert.ok(raw.rows.every(r=>r.temperature<100));
  const csvRoute=load('src/routes/reports/temperature.csv/+server.ts');
  async function exportReadings(businessId,query='') {
    return csvRoute.GET({url:new URL(`https://criminiops.com/reports/temperature.csv?format=readings&start=${day}&end=${day}${query}`),
      locals:{...locals(businessId),businessTimeZone:'UTC',businessRole:'owner',businessPermissionTemplate:'owner',env:{DOC_MEDIA:storage.bucket}}});
  }
  const csvFile=await exportReadings('a');
  const csvRows=load('src/lib/server/csv.ts').parseCsv((await csvFile.text()).replace(/^\uFEFF/,''));
  assert.equal(csvRows.length,expected+1);
  assert.ok(csvRows[0].includes('Measured At (UTC)'));
  assert.equal(csvFile.headers.get('cache-control'),'private, no-store');
  assert.match(csvFile.headers.get('content-disposition'),/temperature-readings-/);
  await assert.rejects(csvRoute.GET({url:new URL(`https://criminiops.com/reports/temperature.csv?format=bad&start=${day}&end=${day}`),locals:{...locals('a'),businessRole:'owner',env:{DOC_MEDIA:storage.bucket}}}),{status:400});
  await assert.rejects(csvRoute.GET({url:new URL(`https://criminiops.com/reports/temperature.csv?format=readings`),locals:{...locals('a'),businessRole:'staff',businessPermissionTemplate:'staff',env:{DOC_MEDIA:storage.bucket}}}),{location:'/app'});
  await assert.rejects(reports.loadTemperatureReadingsReport(db,'a',{start:day,end:day,archiveBucket:{async get(){throw Error('Storage failed');}},export:true}),{status:503});
  const oversized=createTestR2();
  await archive.archiveTemperatureReadings(oversized.bucket,'a',Array.from({length:10001},(_,index)=>({
    id:2000000+index,sensor_id:1,sensor_name:'Oversized archive',temperature:38,humidity_pct:null,ts:now
  })),now);
  await assert.rejects(reports.loadTemperatureReadingsReport(db,'a',{start:day,end:day,archiveBucket:oversized.bucket,export:true}),{status:413});
  console.log('PASS original-reading CSV: real timestamps/units, live/archive deduplication, permission denial, invalid format, archive failure and explicit export limits');
  await assert.rejects(reports.loadTemperatureHourlyAverageReport(db,'a',{start:day,end:day,archiveBucket:{async get(){throw Error('Storage failed');}}}),{status:503});
  console.log('PASS conditional CSV merge/retry, quotes/newlines/null humidity, archive/live deduplication and explicit unavailable-report failure');

  await archive.archiveTemperatureReadings(storage.bucket,'b',[{...incoming,id:900003,ts:now-62*86400}],now-62*86400);
  storage.objects.set('businesses/a/documents/keep.pdf',{body:'fixture',etag:'keep'});
  const currentKeys=[...storage.objects.keys()].filter(key=>key.startsWith('temperature-reports/')&&!key.includes(new Date((now-62*86400)*1000).toISOString().slice(0,10)));
  assert.equal(await archive.cleanupTemperatureArchives(storage.bucket,now),1);
  assert.ok(currentKeys.every(key=>storage.objects.has(key)));assert.ok(storage.objects.has('businesses/a/documents/keep.pdf'));
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  console.log('PASS automatic 60-day archive cleanup affects only expired temperature files, not current archives or documents');
} finally { test.close(); }
