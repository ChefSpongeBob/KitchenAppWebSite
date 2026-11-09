import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const executable='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
assert.ok(existsSync(executable),'This explicit browser acceptance check requires the installed Edge executable');
const root=mkdtempSync(resolve('.wrangler/temperature-history-ui-'));
writeFileSync(resolve(root,'index.html'),'<html data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
writeFileSync(resolve(root,'main.js'),`import {mount} from 'svelte';import Fixture from './Fixture.svelte';
  import '${resolve('src/app.css').replaceAll('\\','/')}';
  window.historyRequests=0;window.cancelled=0;window.mode='normal';const realFetch=window.fetch;
  window.fetch=(url,options={})=>{
    if(!String(url).startsWith('/api/temps?'))return realFetch(url,options);
    window.historyRequests++;
    if(window.mode==='slow')return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{window.cancelled++;reject(new DOMException('Aborted','AbortError'));}));
    const end=Math.floor(Date.now()/1000);return Promise.resolve(Response.json({start:end-28800,end,timeZone:'America/Denver',intervalSeconds:1200,
      readings:Array.from({length:24},(_,i)=>({ts:end-i*1200,temperature:37+i/10,humidity_pct:i%2?null:50}))}));
  };mount(Fixture,{target:document.getElementById('app')});`);
writeFileSync(resolve(root,'Fixture.svelte'),`<script>
  import History from '${resolve('src/lib/components/ui/TemperatureHistory.svelte').replaceAll('\\','/')}';
  let visible=false,token=0;
  </script><button id="open" onclick={()=>visible=true}>Walk-in 37F</button><button id="refresh" onclick={()=>token++}>New reading</button>
  {#if visible}<History sensorId={7} name="Walk-in" refreshToken={token} onClose={()=>visible=false}/>{/if}`);
const server=await createServer({root,configFile:false,envDir:root,plugins:[svelte()],resolve:{alias:{'#lib':resolve('src/lib')}},
  server:{host:'127.0.0.1',port:0,fs:{allow:[process.cwd()]}}});
await server.listen();
const origin=server.resolvedUrls.local[0];
const profile=mkdtempSync(resolve('.wrangler/temperature-history-browser-'));
const browser=spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-sync',
  '--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,origin],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let diagnostics='',socket,nextId=0;const pending=new Map(),errors=[];
browser.stderr.on('data',chunk=>{diagnostics+=chunk;});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function poll(read,label){for(let i=0;i<100;i++){const value=await read();if(value)return value;await pause(150);}throw Error('Browser timeout: '+label);}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},15000);
  pending.set(id,{resolve:result=>{clearTimeout(timer);resolve(result);},reject});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error('Browser evaluation failed: '+result.exceptionDetails.text);return result.result.value;}
try{
  const port=await poll(()=>diagnostics.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//)?.[1],'headless browser');
  const tabs=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(tabs.find(tab=>tab.type==='page'&&tab.url.startsWith(origin)).webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve);socket.addEventListener('error',reject);});
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
    const job=pending.get(message.id);if(!job)return;pending.delete(message.id);message.error?job.reject(Error(message.error.message)):job.resolve(message.result);});
  await send('Runtime.enable');await poll(()=>evaluate("Boolean(document.getElementById('open'))"),'Svelte hydration');
  assert.equal(await evaluate('window.historyRequests'),0,'Closed history must not poll or prefetch');
  for(const width of [1366,390])for(const theme of ['light','dark']){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width===390});
    await evaluate(`document.documentElement.dataset.theme='${theme}';document.getElementById('open').click()`);
    await poll(()=>evaluate("document.querySelector('dialog[open] tbody')?.children.length===24"),'24 rendered readings');
    const state=await evaluate("(()=>{const dialog=document.querySelector('dialog');const css=getComputedStyle(dialog);return{width:dialog.getBoundingClientRect().width,viewport:innerWidth,background:css.backgroundColor,color:css.color,overflow:document.documentElement.scrollWidth>innerWidth+1};})()");
    assert.ok(state.width<=width-20&&!state.overflow,JSON.stringify(state));assert.notEqual(state.background,state.color);
    const requests=await evaluate('window.historyRequests');await pause(250);assert.equal(await evaluate('window.historyRequests'),requests);
    await evaluate("document.getElementById('refresh').click()");await poll(()=>evaluate(`window.historyRequests===${requests+1}`),'new reading refresh');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await poll(()=>evaluate("!document.querySelector('dialog')"),'Escape closes history');
  }
  await evaluate("window.mode='slow';document.getElementById('open').click()");
  await poll(()=>evaluate("document.querySelector('dialog[open]')!==null"),'loading dialog');
  await evaluate("document.querySelector('dialog button').click()");await poll(()=>evaluate('window.cancelled===1'),'close aborts request');
  assert.deepEqual(errors,[]);
  console.log('PASS real browser: desktop/mobile light/dark history, 24-row readout, keyboard/form close, no background polling, refresh-on-new-reading and request cancellation');
}finally{
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}
  if(browser.exitCode===null)browser.kill();await server.close();
}
