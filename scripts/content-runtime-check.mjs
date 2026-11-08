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
const { outputFiles } = await build({ stdin: { resolveDir: process.cwd(), sourcefile: 'content-runtime-fixture.ts', contents: `
  import {createListSection,createRecipe,updateRecipe,createDocument,deleteCreatorCategory,approveWhiteboard,createTodo} from './src/lib/server/admin.ts';
  import {setListItemCompletion} from './src/lib/server/history.ts';
  import {POST as whiteboard} from './src/routes/api/whiteboard/+server.ts';
  let ready=false;const removed=[];
  export default {async fetch(request,env) {
    const db=env.DB;
    if (!ready) {
      await db.batch(${JSON.stringify(schema)}.map(sql=>db.prepare(sql)));
      const now=Math.floor(Date.now()/1000);
      for (const business of ['a','b']) {
        await db.prepare('INSERT INTO businesses (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').bind(business,business,business,now,now).run();
        await db.prepare('INSERT INTO users (id,email,email_normalized,created_at,updated_at) VALUES (?,?,?,?,?)').bind(business,business+'@example.invalid',business+'@example.invalid',now,now).run();
        await db.prepare("INSERT INTO business_users (business_id,user_id,role,permission_template,created_at,updated_at) VALUES (?,?,'owner','owner',?,?)").bind(business,business,now,now).run();
        await db.prepare("INSERT INTO list_sections (id,business_id,domain,slug,title,created_at,updated_at) VALUES (?,?,'preplists','daily','Daily',?,?)").bind(business,business,now,now).run();
        await db.prepare("INSERT INTO list_items (id,business_id,section_id,content,created_at,updated_at) VALUES (?,?,?,'Rice',?,?)").bind(business,business,business,now,now).run();
        await db.prepare("INSERT INTO whiteboard_posts (id,business_id,content,votes,created_by,created_at,updated_at) VALUES (?,?,'Idea',0,?,?,?)").bind(business,business,business,now,now).run();
        await db.prepare("INSERT INTO whiteboard_review (post_id,business_id,status,reviewed_at) VALUES (?,?,'approved',?)").bind(business,business,now).run();
      }
      ready=true;
    }
    const body=await request.json();
    if(body.operation==='inspect')return Response.json({
      sections:(await db.prepare('SELECT id,domain FROM list_sections ORDER BY id').all()).results,
      items:(await db.prepare('SELECT id,is_checked FROM list_items ORDER BY id').all()).results,
      activity:(await db.prepare('SELECT COUNT(*) n FROM list_item_activity_events').first()).n,
      votes:(await db.prepare('SELECT id,votes FROM whiteboard_posts ORDER BY id').all()).results,
      voteRows:(await db.prepare('SELECT COUNT(*) n FROM whiteboard_votes').first()).n,
      recipes:(await db.prepare('SELECT title FROM recipes').all()).results,
      categories:(await db.prepare('SELECT category FROM creator_category_registry').all()).results,
      tasks:(await db.prepare('SELECT COUNT(*) n FROM todos').first()).n,
      removed,
      foreignKeys:(await db.prepare('PRAGMA foreign_key_check').all()).results
    });
    const failures={first:"CREATE TRIGGER fixture_failure BEFORE INSERT ON list_items BEGIN SELECT RAISE(ABORT,'fixture rollback'); END",
      completion:"CREATE TRIGGER fixture_failure BEFORE INSERT ON list_item_activity_events BEGIN SELECT RAISE(ABORT,'fixture rollback'); END",
      recipe:"CREATE TRIGGER fixture_failure BEFORE INSERT ON creator_category_registry BEGIN SELECT RAISE(ABORT,'fixture rollback'); END",
      vote:"CREATE TRIGGER fixture_failure BEFORE UPDATE ON whiteboard_posts BEGIN SELECT RAISE(ABORT,'fixture rollback'); END"};
    if(body.failure)await db.exec(failures[body.failure]);
    if(body.operation==='clear'){await db.exec('DROP TRIGGER fixture_failure');return Response.json({ok:true});}
    const locals={DB:db,env,businessId:'a',userId:'a',userRole:'admin',businessRole:'owner',businessPermissionTemplate:'owner',
      MEDIA_BUCKET:{async delete(keys){removed.push(...(Array.isArray(keys)?keys:[keys]));}}};
    const form=new Request('https://fixture.example.invalid/admin/creator',{method:'POST',body:new URLSearchParams(body.fields??{})});
    try{
      const result=body.operation==='first'?await createListSection(form,locals)
        :body.operation==='recipe'?await createRecipe(form,locals)
        :body.operation==='missing-recipe'?await updateRecipe(form,locals)
        :body.operation==='complete'?await setListItemCompletion(db,'a','preplists','a','a','a',1)
        :body.operation==='moderate'?await approveWhiteboard(form,locals)
        :body.operation==='todo'?await createTodo(form,locals)
        :body.operation==='document'?await createDocument(form,locals)
        :body.operation==='delete-category'?await deleteCreatorCategory(form,locals)
        :await whiteboard({locals,request:new Request('https://fixture.example.invalid/api/whiteboard',{method:'POST',body:JSON.stringify(body.fields)})});
      return result instanceof Response?result:Response.json(result);
    }catch{return Response.json({error:'isolated transaction failure'},{status:500});}
  }};` }, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false,
  plugins: [{ name: 'fixture-environment', setup(build) {
    build.onResolve({ filter: /^\$app\/env$/ }, () => ({ path: 'env', namespace: 'fixture' }));
    build.onResolve({ filter: /^#lib\/server\/operationalEvents\.ts$/ }, () => ({ path: 'events', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, ({path}) => ({ contents: path==='env'
      ? 'export const dev=false;export const building=false;export const browser=false;'
      : 'export async function recordOperationalEventBestEffort(){}' }));
  } }]
});
const runtime = new Miniflare({ host:'127.0.0.1',port:0,cf:false,telemetry:{enabled:false},workers:[{
  config:{name:'content-runtime-check',compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,
    env:{DB:{type:'d1',id:'isolated-content-runtime'}},manifest:{mainModule:'index.js',modules:{'index.js':{type:'esm',contents:outputFiles[0].text}}}},
  dev:{outboundService:{type:'fetcher',handler:()=>{throw Error('Content tests must not send network requests');}}}
}]});
const dispatch=(operation,fields={},failure)=>runtime.dispatchFetch('https://fixture.example.invalid',{
  method:'POST',body:JSON.stringify({operation,fields,failure}),headers:{'content-type':'application/json'}
});
const action=async(...args)=>{const response=await dispatch(...args);assert.equal(response.status,200);return response.json();};
const inspect=()=>action('inspect');
try{
  assert.equal((await dispatch('first',{domain:'inventory',title:'Stock',first_item:'Rice'},'first')).status,500);
  assert.equal((await inspect()).sections.length,2);await action('clear');
  assert.equal((await action('first',{domain:'inventory',title:'Stock',first_item:'Rice'})).success,true);
  assert.equal((await action('first',{domain:'inventory',title:'Stock',first_item:'Rice'})).status,400);
  assert.equal((await dispatch('complete',{},'completion')).status,500);
  assert.equal((await inspect()).items.find(row=>row.id==='a').is_checked,0);await action('clear');
  await action('complete');await action('complete');assert.equal((await inspect()).activity,1);
  const recipe={title:'Rice',category:'Kitchen',ingredients:'Rice',instructions:'Cook'};
  assert.equal((await dispatch('recipe',recipe,'recipe')).status,500);
  assert.equal((await inspect()).recipes.length,0);await action('clear');
  assert.equal((await action('recipe',recipe)).success,true);
  assert.equal((await action('missing-recipe',{...recipe,id:999,category:'Ghost'})).status,404);
  assert.deepEqual((await inspect()).categories.map(row=>row.category),['Kitchen']);
  assert.equal((await action('moderate',{id:'b'})).status,404);
  assert.equal((await dispatch('vote',{action:'upvote',id:'b'})).status,404);
  assert.equal((await dispatch('vote',{action:'upvote',id:'a'},'vote')).status,500);
  assert.equal((await inspect()).voteRows,0);await action('clear');
  await action('vote',{action:'upvote',id:'a'});assert.equal((await dispatch('vote',{action:'upvote',id:'a'})).status,409);
  assert.equal((await inspect()).votes.find(row=>row.id==='a').votes,1);
  assert.equal((await action('todo',{title:'Task',assigned_to:'b'})).status,400);
  assert.equal((await inspect()).tasks,0);assert.deepEqual((await inspect()).foreignKeys,[]);
  for(const [title,category,file] of [['Keep','Docs','shared'],['Remove','Docs','unused'],['Shared','Other','shared']]){
    assert.equal((await action('document',{title,category,file_url:'/api/documents/media/businesses/a/documents/'+file+'.pdf'})).success,true);
  }
  assert.equal((await action('delete-category',{editor_type:'document',category:'Docs',delete_with_content:1})).success,true);
  assert.deepEqual((await inspect()).removed,['businesses/a/documents/unused.pdf']);
  assert.deepEqual((await inspect()).foreignKeys,[]);
  console.log('PASS actual Workers/D1 content: first-item/category/completion/vote atomicity, replay guards, tenant moderation and assignment denials; no network or production data');
}finally{await runtime.dispose();}
