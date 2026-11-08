import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const transpile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

// Execute the real service-worker handlers against an isolated CacheStorage/network.
const handlers = new Map();
const stores = new Map();
const origin = 'https://criminiops.com';
const keyOf = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
const open = async name => {
  if (!stores.has(name)) stores.set(name, new Map());
  const entries = stores.get(name);
  return {
    async put(request, response) { entries.set(keyOf(request), response.clone()); },
    async match(request) { return entries.get(keyOf(request))?.clone(); },
    async keys() { return [...entries.keys()].map(url => ({ url })); },
    async delete(request) { return entries.delete(keyOf(request)); },
    async addAll() {}
  };
};
const caches = { open, async keys() { return [...stores.keys()]; }, async delete(name) { return stores.delete(name); },
  async match(request) { for (const name of stores.keys()) { const response = await (await open(name)).match(request); if (response) return response; } } };
let network = () => new Response('Public', { headers: { 'cache-control': 'public, max-age=60' } });
const self = { registration: { scope: origin + '/' }, location: { origin }, clients: { async claim() {} }, skipWaiting() {},
  addEventListener(name, callback) { handlers.set(name, callback); } };
vm.runInNewContext(transpile('src/service-worker/index.ts'), { exports: {}, URL, Response, Headers, caches, fetch: async request => network(request), require(name) {
  const modules = { '$app/env': { version: 'isolated' }, '$app/manifest': { assets: [{ path: 'logo.png' }], immutable: [] }, '$app/paths': { asset: path => '/' + path }, '$app/service-worker': { self } };
  assert.ok(name in modules, name); return modules[name];
} });
async function fetchWorker(path, mode = 'navigate') {
  let response;
  handlers.get('fetch')({ request: { url: origin + path, method: 'GET', mode }, respondWith(value) { response = value; } });
  const result = await response; await flush(); return result;
}
await fetchWorker('/');
assert.equal(await (await caches.match('/')).text(), 'Public');
for (const policy of ['private, no-store', 'no-cache', 'private, max-age=10']) {
  network = () => new Response('Private identity', { headers: { 'cache-control': policy } });
  await fetchWorker('/features');
  assert.equal(await caches.match('/features'), undefined);
}
network = () => new Response('Sensitive', { headers: { 'cache-control': 'public' } });
for (const path of ['/app', '/admin', '/login', '/register', '/api/temps', '/app/__data.json']) {
  await fetchWorker(path); assert.equal(await caches.match(path), undefined);
}
network = () => Promise.reject(Error('Offline'));
assert.equal(await (await fetchWorker('/')).text(), 'Public');
assert.equal((await fetchWorker('/app')).status, 503);
assert.equal((await fetchWorker('/api/temps', 'same-origin')).status, 503);
network = () => new Response('Private asset', { headers: { 'cache-control': 'no-store' } });
await fetchWorker('/logo.png', 'same-origin');
assert.equal(await caches.match('/logo.png'), undefined);
network = () => new Response('Logo');
await fetchWorker('/logo.png', 'same-origin');
assert.equal(await (await caches.match('/logo.png')).text(), 'Logo');
await (await open('old-cache')).put('/app', new Response('Prior user'));
await (await open('cache-isolated')).put('/admin', new Response('Prior admin'));
const activation = [];
handlers.get('activate')({ waitUntil(promise) { activation.push(promise); } });
await Promise.all(activation);
assert.equal(stores.has('old-cache'), false);
assert.equal(await caches.match('/admin'), undefined);
console.log('PASS actual service worker: public/static caching, private/no-store and auth/API/data exclusion, safe offline responses and old private-cache removal');

// Run actual polling with a deterministic clock; no timers or browser globals escape this VM.
let time = 100000;
let nextTimer = 0;
const timers = new Map();
function target(extra = {}) {
  const listeners = new Map();
  return { ...extra, listeners, addEventListener(name, listener) { listeners.set(name, listener); }, removeEventListener(name) { listeners.delete(name); }, fire(name) { listeners.get(name)?.(); } };
}
const document = target({ visibilityState: 'visible' });
const window = target();
const navigator = { onLine: true };
const exports = {};
vm.runInNewContext(transpile('src/lib/client/polling.ts'), { exports, document, window, navigator, Date: { now: () => time }, Math,
  setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: time + delay }); return id; }, clearTimeout(id) { timers.delete(id); }
});
async function advance(ms) {
  time += ms;
  const ready = [...timers].filter(([, timer]) => timer.at <= time);
  for (const [id, timer] of ready) { timers.delete(id); timer.callback(); }
  await flush();
}
let calls = 0;
let finish;
let failing = false;
const stop = exports.startVisiblePolling(() => {
  calls++;
  if (failing) throw Error('Network');
  if (calls === 1) return new Promise(resolve => { finish = resolve; });
}, { intervalMs: 1000, maxIntervalMs: 4000, visibleRefreshThrottleMs: 1000 });
assert.equal(calls, 1);
window.fire('online'); window.fire('online');
assert.equal(calls, 1, 'Concurrent triggers cannot overlap a request');
finish(); await flush(); await advance(0);
assert.equal(calls, 2);
document.visibilityState = 'hidden'; document.fire('visibilitychange'); await advance(10000);
assert.equal(calls, 2); assert.equal(timers.size, 0);
navigator.onLine = false;
document.visibilityState = 'visible'; document.fire('visibilitychange'); await advance(1000);
assert.equal(calls, 2, 'Offline visibility changes cannot poll the server');
navigator.onLine = true; window.fire('online'); await flush();
assert.equal(calls, 3);
failing = true; await advance(1000);
assert.equal(calls, 4); assert.equal([...timers.values()][0].at - time, 2000);
await advance(2000); assert.equal([...timers.values()][0].at - time, 4000);
await advance(4000); assert.equal([...timers.values()][0].at - time, 4000);
failing = false; await advance(4000); assert.equal([...timers.values()][0].at - time, 1000);
stop(); assert.equal(timers.size, 0); assert.equal(document.listeners.size, 0); assert.equal(window.listeners.size, 0);
const stoppedCalls = calls; await advance(10000); window.fire('online'); assert.equal(calls, stoppedCalls);
console.log('PASS actual polling: no overlap/hidden/offline polling, bounded error backoff, recovery and full timer/listener disposal');
