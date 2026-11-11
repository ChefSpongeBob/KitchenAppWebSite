import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const file = 'src/lib/client/nativeDownloads.ts';
const source = ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise(setImmediate); };

function fixture({ native = true, origin = 'https://localhost' } = {}) {
  const listeners = new Map(), timers = new Map(), files = new Map();
  const requests = [], writes = [], shares = [], errors = [];
  let business = 'restaurant-a', reply = () => new Response('a,b\n1,2', { headers: { 'content-type': 'text/csv' } });
  let writeFailure = false, shareFailure = false, cancel = false, cleanupFailure = false, nextTimer = 0;
  class Element { closest() { return this; } }
  class Anchor extends Element { constructor(href) { super(); this.href = new URL(href, origin).href; } }
  class Form { action = 'https://localhost/logout'; }
  const exports = {};
  runInNewContext(source, {
    exports, require(name) {
      if (name === '@capacitor/core') return { Capacitor: { isNativePlatform: () => native } };
      if (name === '#lib/workspaceIntent.ts') return { WORKSPACE_HEADER: 'x-crimini-workspace' };
      if (name === '@capacitor/filesystem') return {
        Directory: { Cache: 'CACHE' }, Filesystem: {
          async rmdir(options) {
            assert.equal(options.directory, 'CACHE');
            assert.equal(options.path, 'crimini-exports');
            if (cleanupFailure) throw Object.assign(Error('private cleanup failure'), { code: 'OS-PLUG-FILE-0007' });
            files.clear();
          },
          async writeFile(options) {
            assert.equal(options.directory, 'CACHE');
            assert.match(options.path, /^crimini-exports\/[a-zA-Z0-9 _-]+\.(csv|pdf|jpg|png|gif|webp)$/);
            if (writeFailure) throw Error('private native filesystem failure');
            writes.push(options);
            files.set(options.path, options.data);
            return { uri: 'file:///private/cache/' + options.path };
          },
          async deleteFile({ path }) { files.delete(path); }
        }
      };
      if (name === '@capacitor/share') return { Share: { async share(options) {
        if (shareFailure) throw Error('private native share failure');
        if (cancel) throw Error('Share canceled');
        shares.push(options);
      } } };
      throw Error('Unexpected dependency: ' + name);
    },
    URL, Response, AbortController, Error, Uint8Array, btoa,
    Element, HTMLAnchorElement: Anchor, HTMLFormElement: Form,
    window: { location: { origin: new URL(origin).origin, href: origin + '/reports' } },
    document: {
      addEventListener(type, fn, capture) { assert.equal(capture, true); listeners.set(type, fn); },
      removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); }
    },
    fetch: async (url, options) => { requests.push({ url, options }); return reply(url, options); },
    setTimeout(fn, duration) { const id = ++nextTimer; timers.set(id, { fn, duration }); return id; },
    clearTimeout(id) { timers.delete(id); }
  }, { filename: file });
  const dispose = exports.installNativeDownloads(() => business, message => errors.push(message));
  function click(href, overrides = {}) {
    const event = { target: new Anchor(href), button: 0, defaultPrevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...overrides };
    listeners.get('click')?.(event);
    return event;
  }
  return { ...exports, listeners, timers, files, requests, writes, shares, errors, dispose, click,
    reply(value) { reply = typeof value === 'function' ? value : () => value; },
    business(value) { business = value; },
    writeFailure() { writeFailure = true; }, shareFailure() { shareFailure = true; }, cancel() { cancel = true; },
    cleanupFailure() { cleanupFailure = true; },
    logout() { listeners.get('submit')?.({ target: new Form() }); }
  };
}

const policy = fixture({ native: false });
assert.equal(policy.listeners.size, 0, 'Ordinary browsers retain their existing behavior');
for (const href of ['/reports/waste.csv', '/reports/schedule.csv?publish_id=x', '/api/documents/media/tenant/private.pdf']) {
  assert.equal(policy.nativeDownloadUrl(href, 'https://localhost').origin, 'https://criminiops.com');
  assert.equal(policy.nativeDownloadUrl(href, 'capacitor://localhost').origin, 'https://criminiops.com');
}
for (const href of ['https://evil.invalid/reports/waste.csv', 'http://criminiops.com/reports/waste.csv',
  'https://criminiops.com.evil.invalid/api/documents/media/a.pdf', '//evil.invalid/reports/waste.csv',
  'https://user:password@criminiops.com/reports/waste.csv', '/api/billing/native-purchase', '/reports',
  '/login', '/register?invite=private', '/reports/unknown.csv', 'javascript:alert(1)', 'data:text/csv,private', 'file:///private/a.pdf']) {
  assert.equal(policy.nativeDownloadUrl(href, 'https://localhost'), null, href);
}
for (const href of ['capacitor://other-host/reports/waste.csv', 'file:///reports/waste.csv', 'custom:/reports/waste.csv']) {
  assert.equal(policy.nativeDownloadUrl(href, 'capacitor://localhost'), null, 'Different opaque origins must not compare equal');
}
console.log('PASS native export policy: canonical file/report URLs only; browser, external links, credentials and non-file routes untouched');

for (const origin of ['https://localhost', 'capacitor://localhost', 'https://criminiops.com']) {
  const f = fixture({ origin: origin === 'https://criminiops.com' ? 'https://localhost' : origin });
  const event = f.click(origin + '/reports/waste.csv?start=2026-11-01&end=2026-11-10');
  assert.equal(event.defaultPrevented, true);
  assert.equal(event.stopped, true);
  await flush();
  assert.equal(f.requests[0].url, 'https://criminiops.com/reports/waste.csv?start=2026-11-01&end=2026-11-10');
  assert.equal(f.requests[0].options.credentials, 'include');
  assert.equal(f.requests[0].options.cache, 'no-store');
  assert.equal(f.requests[0].options.headers['x-crimini-workspace'], 'restaurant-a');
  assert.equal(f.requests[0].options.headers['x-crimini-native'], '1');
  assert.equal(Buffer.from(f.writes[0].data, 'base64').toString(), 'a,b\n1,2');
  assert.match(f.shares[0].files[0], /^file:\/\/\/private\/cache\/crimini-exports\//);
  assert.equal(JSON.stringify(f.shares).includes('criminiops.com'), false, 'Share bytes, never authenticated URLs or cookies');
  assert.equal(f.errors.length, 0);
  f.dispose(); await flush(); assert.equal(f.files.size, 0);
}
console.log('PASS native exports: Android/iOS URLs, query scope, session/restaurant headers, exact bytes, private file URI and teardown cleanup');

for (const [label, response] of [
  ['permission denial', () => new Response('private', { status: 403 })],
  ['expired session HTML', () => new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } })],
  ['redirect', () => { const r = new Response('private', { headers: { 'content-type': 'application/pdf' } }); Object.defineProperty(r, 'redirected', { value: true }); return r; }],
  ['wrong final origin', () => { const r = new Response('private', { headers: { 'content-type': 'text/csv' } }); Object.defineProperty(r, 'url', { value: 'https://evil.invalid/a.csv' }); return r; }],
  ['oversized header', () => new Response('private', { headers: { 'content-type': 'text/csv', 'content-length': 16 * 1024 * 1024 + 1 } })],
  ['oversized stream', () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(16 * 1024 * 1024 + 1)); c.close(); } }), { headers: { 'content-type': 'text/csv' } })],
  ['empty body', () => new Response('', { headers: { 'content-type': 'text/csv' } })],
  ['offline', () => { throw Error('private network failure'); }]
]) {
  const f = fixture(); f.reply(response); f.click('/reports/waste.csv'); await flush();
  assert.equal(f.shares.length, 0, label); assert.equal(f.writes.length, 0, label);
  assert.equal(f.errors.length, 1, label); assert.equal(f.errors[0].includes('private'), false, label);
  f.dispose(); await flush();
}
console.log('PASS native files fail closed: session/permission errors, redirects, MIME, oversize header/stream, empty files and offline; no private details in error toast');

for (const failure of ['restaurant changed', 'logout', 'teardown', 'timeout']) {
  const f = fixture(); let finish;
  f.reply(() => new Promise(resolve => { finish = resolve; }));
  f.click('/reports/waste.csv'); await flush();
  if (failure === 'restaurant changed') f.business('restaurant-b');
  if (failure === 'logout') f.logout();
  if (failure === 'teardown') f.dispose();
  if (failure === 'timeout') [...f.timers.values()].find(timer => timer.duration === 60000).fn();
  finish(new Response('private', { headers: { 'content-type': 'text/csv' } })); await flush();
  assert.equal(f.shares.length, 0, failure); assert.equal(f.writes.length, 0, failure);
  f.dispose(); await flush();
}
console.log('PASS interrupted native file requests cannot share across restaurant changes, logout, teardown or timeout');

for (const failure of ['writeFailure', 'shareFailure', 'cleanupFailure', 'cancel']) {
  const f = fixture(); f[failure]();
  f.reply(new Response('private', { headers: { 'content-type': 'application/pdf',
    'content-disposition': 'attachment; filename="../../Hostile name.pdf"' } }));
  f.click('/api/documents/media/a/source.pdf');
  await flush(); assert.equal(f.files.size, 0); assert.equal(f.errors.length, failure === 'cancel' ? 0 : 1);
  f.dispose(); await flush();
}
const f = fixture();
assert.equal(f.click('https://example.invalid/file').defaultPrevented, false);
assert.equal(f.click('/reports/waste.csv', { defaultPrevented: true }).stopped, false);
assert.equal(f.click('/reports/waste.csv', { button: 1 }).defaultPrevented, false);
f.click('/reports/waste.csv'); f.click('/reports/waste.csv'); await flush();
assert.equal(f.requests.length, 1, 'Repeated taps must not produce parallel exports');
assert.equal(f.shares.length, 1);
await [...f.timers.values()].find(timer => timer.duration === 600000).fn(); await flush();
assert.equal(f.files.size, 0, 'Temporary exports expire rather than becoming local HR storage');
f.dispose(); await flush(); assert.equal(f.listeners.size, 0);
console.log('PASS private filename sanitation, filesystem/share/cancel failures, duplicate taps, cache expiry and listener disposal');

const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
const paths = readFileSync('android/app/src/main/res/xml/file_paths.xml', 'utf8');
assert.ok(!paths.includes('external-path') && !paths.includes('path="."'));
assert.ok(paths.includes('path="crimini-exports/"'));
assert.ok(manifest.includes('android:exported="false"') && manifest.includes('android:allowBackup="false"'));
const ios = readFileSync('ios/App/App/AppDelegate.swift', 'utf8');
assert.ok(ios.includes('import CapApp_SPM') && ios.includes('registerPluginInstance(CriminiBillingPlugin())'));
assert.ok(readFileSync('ios/App/App/Base.lproj/Main.storyboard', 'utf8').includes('customClass="CriminiViewController"'));
assert.ok(readFileSync('ios/App/App/PrivacyInfo.xcprivacy', 'utf8').includes('NSPrivacyAccessedAPICategoryFileTimestamp'));
console.log('PASS native source wiring: private-only FileProvider, iOS bridge registration and filesystem privacy reason; physical device behavior still requires acceptance');

const serverUrlSource = ts.transpileModule(readFileSync('src/lib/client/nativeServerUrl.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
for (const local of ['https://localhost', 'capacitor://localhost']) {
  const exports = {};
  runInNewContext(serverUrlSource, { exports, URL, window: { location: { href: local + '/docs', origin: new URL(local).origin } },
    require(name) {
      if (name === '$app/env') return { browser: true };
      if (name === '@capacitor/core') return { Capacitor: { isNativePlatform: () => true } };
      throw Error(name);
    }
  });
  assert.equal(exports.nativeServerUrl('/api/documents/media/a/file.pdf'), 'https://criminiops.com/api/documents/media/a/file.pdf');
  assert.equal(exports.nativeServerUrl('/reports/waste.csv?start=2026-11-01'), 'https://criminiops.com/reports/waste.csv?start=2026-11-01');
  for (const value of ['capacitor://other-host/api/temps', 'file:///api/documents/media/a.pdf', 'https://evil.invalid/api/temps', '/app']) {
    assert.equal(exports.nativeServerUrl(value), value);
  }
}
console.log('PASS actual native media URL helper: iOS opaque origins resolve safely and do not trust other hosts/protocols');
