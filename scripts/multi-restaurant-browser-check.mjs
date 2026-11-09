import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const executable = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
assert.ok(existsSync(executable), 'This explicit browser check requires installed Edge');
const root = mkdtempSync(resolve('.wrangler/multi-restaurant-ui-'));
const path = file => resolve(file).replaceAll('\\', '/');
writeFileSync(resolve(root, 'index.html'), '<html data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
writeFileSync(resolve(root, 'main.js'), `import {mount} from 'svelte';import Fixture from './Fixture.svelte';import '${path('src/app.css')}';
  window.submissions=[];document.addEventListener('submit',event=>{window.submissions.push({blocked:event.defaultPrevented,fields:Object.fromEntries(new FormData(event.target))});event.preventDefault();});
  mount(Fixture,{target:document.getElementById('app')});`);
writeFileSync(resolve(root, 'Fixture.svelte'), `<script>
  import Register from '${path('src/routes/register/+page.svelte')}';
  import Workspace from '${path('src/routes/workspace/+page.svelte')}';
  const mode=new URLSearchParams(location.search).get('mode')||'existing';
  window.fixtureMode=mode;
  const data={inviteCode:'EXAMPLE-INVITE',inviteEmail:mode==='unavailable'?null:'shared@example.invalid',existingInviteAccount:mode!=='new',canAcceptInvite:mode==='existing',
    invitationBusinessName:'Restaurant B',acceptedInvitation:mode==='accepted'?{businessId:'b',businessName:'Restaurant B'}:null,agreementVersion:'fixture'};
  </script>{#if mode==='chooser'}<Workspace data={{businesses:[{businessId:'a',businessName:'Restaurant A'},{businessId:'b',businessName:'Restaurant B'}]}}/>{:else}<Register {data} form={null}/>{/if}`);
const server = await createServer({ root, configFile: false, envDir: root, publicDir: resolve('static'),
  plugins: [svelte(), { name: 'fixture-form-navigation', resolveId(id) { if (id === '$app/forms') return '\0fixture-forms'; },
    load(id) { if (id === '\0fixture-forms') return 'export function enhance(){return{destroy(){}}}'; } }],
  resolve: { alias: { '#lib': resolve('src/lib') } }, server: { host: '127.0.0.1', port: 0, fs: { allow: [process.cwd()] } } });
await server.listen();
const origin = server.resolvedUrls.local[0];
const profile = mkdtempSync(resolve('.wrangler/multi-restaurant-browser-'));
const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
  '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, origin], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let diagnostics = '', socket, nextId = 0, pageLoads = 0;
const pending = new Map(), errors = [];
browser.stderr.on('data', chunk => { diagnostics += chunk; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function poll(read, label) { for (let i = 0; i < 120; i++) { const value = await read(); if (value) return value; await pause(150); } throw Error('Browser timeout: ' + label); }
function send(method, params = {}) { return new Promise((resolve, reject) => {
  const id = ++nextId, timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, 20000);
  pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result); }, reject }); socket.send(JSON.stringify({ id, method, params }));
}); }
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error('Browser evaluation: ' + (result.exceptionDetails.exception?.description || result.exceptionDetails.text)); return result.result.value; }
async function navigate(mode, selector = 'form') {
  const before = pageLoads;
  await send('Page.navigate', { url: origin + '?mode=' + mode });
  await poll(() => pageLoads > before, 'document load ' + mode);
  await poll(() => evaluate(`window.fixtureMode===${JSON.stringify(mode)}&&Boolean(document.querySelector(${JSON.stringify(selector)}))`), 'render ' + mode);
}
async function fill(selector, value) { await evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});node.value=${JSON.stringify(value)};node.dispatchEvent(new Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`); }
try {
  const port = await poll(() => diagnostics.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//)?.[1], 'headless browser');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page' && tab.url.startsWith(origin)).webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.method === 'Page.loadEventFired') pageLoads++; if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    const job = pending.get(message.id); if (!job) return; pending.delete(message.id); message.error ? job.reject(Error(message.error.message)) : job.resolve(message.result); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  for (const width of [1366, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width === 390 });
    await navigate('existing');
    await fill('input[autocomplete="name"]', 'New B name'); await fill('input[type="date"]', '1990-03-04');
    await evaluate('document.querySelector("button.continue").click()');
    await poll(() => evaluate('Boolean(document.querySelector("select"))'), 'address');
    await fill('input[autocomplete="address-line1"]', '2 Example Street'); await fill('input[autocomplete="address-level2"]', 'Example');
    await fill('select[autocomplete="address-level1"]', 'CO'); await fill('input[autocomplete="postal-code"]', '80000');
    await evaluate('document.querySelector("button.continue").click()');
    await poll(() => evaluate('Boolean(document.querySelector("input[type=tel]"))'), 'contact');
    assert.equal(await evaluate('document.querySelectorAll("input[name=password],input[name=confirm_password],.consents").length'), 0);
    await fill('input[type="tel"]', '2025550102');
    assert.equal(await evaluate('document.querySelector("button[type=submit]").textContent.trim()'), 'Join restaurant');
    await evaluate('document.querySelector("form").requestSubmit()');
    await poll(() => evaluate('window.submissions.length===1'), 'join submission');
    const submission = await evaluate('window.submissions[0]');
    assert.equal(submission.blocked, false); assert.equal(submission.fields.existing_account, '1');
    assert.equal(submission.fields.real_name, 'New B name'); assert.equal(submission.fields.user_state, 'CO');
    assert.equal('password' in submission.fields, false);
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'), false);
  }
  await navigate('new');
  await fill('input[autocomplete="name"]', 'New person'); await fill('input[type="date"]', '1990-03-04');
  await evaluate('document.querySelector("button.continue").click()');
  await poll(() => evaluate('Boolean(document.querySelector("select"))'), 'new address');
  await fill('input[autocomplete="address-line1"]', '2 Example Street'); await fill('input[autocomplete="address-level2"]', 'Example');
  await fill('select', 'CO'); await fill('input[autocomplete="postal-code"]', '80000');
  await evaluate('document.querySelector("button.continue").click()');
  await poll(() => evaluate('Boolean(document.querySelector("input[name=password]"))'), 'new-account password');
  assert.equal(await evaluate('document.querySelectorAll("input[name=password],input[name=confirm_password]").length'), 2);
  assert.equal(await evaluate('document.querySelectorAll(".consents input:checked").length'), 0);
  assert.equal(await evaluate('document.querySelector("button[type=submit]").textContent.trim()'), 'Create account');
  await navigate('prompt', 'a[href*=invite]');
  assert.equal(await evaluate('document.querySelector("a[href*=invite]").getAttribute("href")'), '/login?invite=EXAMPLE-INVITE');
  await navigate('unavailable', 'a[href]');
  assert.equal(await evaluate('document.querySelector("a[href]").getAttribute("href")'), '/login');
  assert.equal(await evaluate('document.querySelector("form")===null'), true);
  await navigate('accepted');
  assert.equal(await evaluate('document.querySelector("form").getAttribute("action")'), '/workspace/switch');
  assert.equal(await evaluate('document.querySelector("input[name=business_id]").value'), 'b');
  await navigate('chooser');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("input[name=business_id]")].map(node=>node.value)'), ['a', 'b']);
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'), false);
  assert.deepEqual(errors, []);
  console.log('PASS real browser UI: desktop/mobile additional-restaurant slideshow, retained separate information, no replacement passwords/consent, unchanged new-account fields, invite sign-in, accepted-link and chooser controls');
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} socket.close(); }
  if (browser.exitCode === null) browser.kill(); await server.close();
}
