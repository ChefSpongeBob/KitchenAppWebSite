import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createTestD1 } from './helpers/test-d1.mjs';

const fixture=createTestD1();
const schema=fixture.sqlite.prepare(`SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
  ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END`).all().map(row=>row.sql);
fixture.close();
const require=createRequire(import.meta.url), runtimeTools=createRequire(require.resolve('wrangler/package.json'));
const {build}=runtimeTools('esbuild'), {Miniflare}=runtimeTools('miniflare');
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const {outputFiles}=await build({stdin:{resolveDir:process.cwd(),sourcefile:'temperature-history-runtime.ts',contents:`
  import {cleanupExpiredTemps} from './src/lib/server/retention.ts';
  import {archiveTemperatureReadings,visitTemperatureArchives,cleanupTemperatureArchives} from './src/lib/server/temperatureArchive.ts';
  import {loadTemperatureHourlyAverageReport,loadTemperatureReadingsReport} from './src/lib/server/reports.ts';
  import {GET} from './src/routes/api/temps/+server.ts';
  import {setListItemCompletion,loadListHistoryReport} from './src/lib/server/history.ts';
  import {resetChecklistRun} from './src/lib/server/checklistHistory.ts';
  let ready=false;
  export default {async fetch(request,env){
    const db=env.DB,now=Math.floor(Date.now()/1000),url=new URL(request.url);
    if(!ready){
      await db.batch(${JSON.stringify(schema)}.map(sql=>db.prepare(sql)));
      for(const business of ['a','b']){
        await db.prepare('INSERT INTO businesses(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)').bind(business,business,business,now,now).run();
        await db.prepare("INSERT INTO iot_devices(id,business_id,device_type,external_device_id,display_name,key_hash,key_prefix,created_at,updated_at) VALUES(?,?,'sensor_gateway',?,?,'fixture','fixture',?,?)").bind(business,business,business,business,now,now).run();
        await db.prepare("INSERT INTO temperature_sensor_nodes(id,business_id,gateway_device_id,node_serial,sensor_id,display_name,last_seen_at,created_at,updated_at) VALUES(?,?,?,?,1,'Walk-in',?,?,?)").bind(business,business,business,business,now,now,now).run();
        await db.prepare("WITH RECURSIVE n(x) AS(SELECT 0 UNION ALL SELECT x+1 FROM n WHERE x<29) INSERT INTO temps(business_id,sensor_id,temperature,humidity_pct,ts) SELECT ?,1,37,50,?-x*1200 FROM n").bind(business,now).run();
      }ready=true;
    }
    if(url.pathname==='/fail')await db.exec("CREATE TRIGGER fixture_delete_failure BEFORE DELETE ON temps BEGIN SELECT RAISE(ABORT,'fixture archive delete failure');END");
    if(url.pathname==='/clear'){await db.exec('DROP TRIGGER fixture_delete_failure');return Response.json({ok:true});}
    if(url.pathname==='/history')return GET({url:new URL('https://fixture.example.invalid/api/temps?view=history&sensor=1'),request,locals:{env,DB:db,businessId:'a',businessTimeZone:'America/Denver'}});
    if(url.pathname==='/checklists'){
      await db.prepare("INSERT INTO users(id,email,email_normalized,display_name,created_at,updated_at) VALUES('actor','actor@example.invalid','actor@example.invalid','Original person',?,?)").bind(now,now).run();
      await db.prepare("INSERT INTO checklist_sections(id,business_id,title,slug,created_at,updated_at) VALUES('section','a','Closing','closing',?,?)").bind(now,now).run();
      for(const id of ['one','two'])await db.prepare("INSERT INTO checklist_items(id,business_id,section_id,content,created_at,updated_at) VALUES(?,'a','section',?,?,?)").bind(id,'Task '+id,now,now).run();
      await setListItemCompletion(db,'a','checklists','section','one','actor',1);
      await setListItemCompletion(db,'a','checklists','section','two','actor',1);
      await setListItemCompletion(db,'a','checklists','section','two','actor',1);
      await db.prepare("UPDATE users SET display_name='Renamed person' WHERE id='actor'").run();
      const first=await loadListHistoryReport(db,'a','checklists');
      const other=await loadListHistoryReport(db,'b','checklists');
      await resetChecklistRun(db,'a','section');
      await setListItemCompletion(db,'a','checklists','section','one','actor',1);
      await db.exec("CREATE TRIGGER fixture_checklist_failure BEFORE INSERT ON checklist_completed_run_items BEGIN SELECT RAISE(ABORT,'fixture checklist rollback');END");
      let rolledBack=false;try{await setListItemCompletion(db,'a','checklists','section','two','actor',1);}catch{rolledBack=true;}
      await db.exec('DROP TRIGGER fixture_checklist_failure');
      const checked=await db.prepare("SELECT is_checked FROM checklist_items WHERE id='two'").first();
      await setListItemCompletion(db,'a','checklists','section','two','actor',1);
      return Response.json({first:first.rows,other:other.rows,rolledBack,checked:checked.is_checked,
        runs:(await db.prepare("SELECT COUNT(*) n FROM checklist_completed_runs WHERE business_id='a'").first()).n});
    }
    if(url.pathname==='/merge'){
      const reading={sensor_id:1,sensor_name:'Walk-in',temperature:38,humidity_pct:null,ts:now-86400};
      await Promise.all([archiveTemperatureReadings(env.DOC_MEDIA,'a',[{...reading,id:10001}]),archiveTemperatureReadings(env.DOC_MEDIA,'a',[{...reading,id:10002}])]);
    }
    try{
      if(url.pathname==='/rotate'||url.pathname==='/fail')await cleanupExpiredTemps(db,env.DOC_MEDIA,'a');
      const rows=[];await visitTemperatureArchives(env.DOC_MEDIA,'a',now-3*86400,now+1,row=>rows.push(row));
      const day=new Date(now*1000).toISOString().slice(0,10);
      const report=await loadTemperatureHourlyAverageReport(db,'a',{start:day,end:day,archiveBucket:env.DOC_MEDIA});
      const raw=await loadTemperatureReadingsReport(db,'a',{start:day,end:day,archiveBucket:env.DOC_MEDIA,export:true});
      return Response.json({a:(await db.prepare("SELECT COUNT(*) n FROM temps WHERE business_id='a'").first()).n,
        b:(await db.prepare("SELECT COUNT(*) n FROM temps WHERE business_id='b'").first()).n,
        archived:rows.length,merged:rows.filter(row=>row.id>=10000).length,
        reportSamples:report.rows.reduce((sum,row)=>sum+row.reading_count,0),
        rawSamples:raw.rows.length,
        foreignKeys:(await db.prepare('PRAGMA foreign_key_check').all()).results});
    }catch{return Response.json({error:'isolated failure'},{status:500});}
  }};`},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,external:['cloudflare:workers'],
  plugins:[{name:'fixture-env',setup(build){build.onResolve({filter:/^\$app\/env$/},()=>({path:'env',namespace:'fixture'}));
    build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const dev=false;export const browser=false;export const building=false;'}));}}]});
const runtime=new Miniflare({host:'127.0.0.1',port:0,cf:false,telemetry:{enabled:false},workers:[{
  config:{name:'temperature-history-runtime',compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,
    env:{DB:{type:'d1',id:'isolated-history-runtime'},DOC_MEDIA:{type:'r2',name:'isolated-history-archive'}},
    manifest:{mainModule:'index.js',modules:{'index.js':{type:'esm',contents:outputFiles[0].text}}}},
  dev:{outboundService:{type:'fetcher',handler:()=>{throw Error('History runtime tests must not send network requests');}}}
}]});
const request=path=>runtime.dispatchFetch('https://fixture.example.invalid'+path);
try{
  assert.equal((await request('/fail')).status,500);
  await request('/clear');
  const failed=await (await request('/inspect')).json();assert.equal(failed.a,30);assert.equal(failed.archived,6);
  const rotated=await (await request('/rotate')).json();assert.equal(rotated.a,24);assert.equal(rotated.b,30);assert.equal(rotated.archived,6);
  assert.equal(rotated.reportSamples,failed.reportSamples,'A failed D1 delete cannot double count already archived samples');
  assert.equal(failed.rawSamples,failed.reportSamples);
  assert.equal(rotated.rawSamples,rotated.reportSamples);
  const merged=await (await request('/merge')).json();assert.equal(merged.merged,2,'Real R2 conditional merge must retain both simultaneous uploads');
  assert.deepEqual(merged.foreignKeys,[]);
  const history=await (await request('/history')).json();assert.equal(history.readings.length,24);assert.equal(history.intervalSeconds,1200);
  const checklistResponse=await request('/checklists');assert.equal(checklistResponse.status,200,await checklistResponse.clone().text());
  const checklist=await checklistResponse.json();
  assert.equal(checklist.first.length,2);assert.ok(checklist.first.every(row=>row.completed_by_name==='Original person'&&row.submitted_by_name==='Original person'));
  assert.deepEqual(checklist.other,[]);assert.equal(checklist.rolledBack,true);assert.equal(checklist.checked,0);assert.equal(checklist.runs,2);
  console.log('PASS actual Workers/D1 checklist completion: one atomic run, frozen names, tenant isolation, reset-only next run and late-failure rollback');
  console.log('PASS actual Workers/D1/R2: windowed rotation, conditional concurrent CSV writes, failed-delete retry/deduplication, tenant isolation and 24-reading history');
}finally{await runtime.dispose();}
