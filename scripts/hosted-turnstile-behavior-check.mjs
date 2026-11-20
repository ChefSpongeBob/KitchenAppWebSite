import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { loadServerModules } from './helpers/test-d1.mjs';

const load = loadServerModules({ '#lib/client/hostedChallengeFrame.js?raw': { __esModule: true, default: readFileSync('src/lib/client/hostedChallengeFrame.js', 'utf8') } });
const constants = load('src/lib/security/loginChallenge.ts');
const route = load('src/routes/login/security-check/+server.ts');
const env = { TURNSTILE_SITE_KEY: 'isolated-site', TURNSTILE_SECRET_KEY: 'never-client-side' };
const { LOGIN_CHALLENGE_MESSAGE: type, LOGIN_CHALLENGE_ORIGIN: origin } = constants;
let passed = 0;
async function check(label, run) { await run(); passed++; console.log('PASS ' + label); }
const source = file => ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;

function nativeClient() {
  const listeners = new Map(), timers = new Map(), children = [], posts = [], states = [];
  const window = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const document = { createElement(tag) {
    const node = { tag, style: {}, value: '', remove() { const index = children.indexOf(node); if (index >= 0) children.splice(index, 1); } };
    if (tag === 'iframe') node.contentWindow = { postMessage: (data, target) => posts.push({ data, target }) };
    return node;
  } };
  const element = { appendChild: node => children.push(node) }, exports = {};
  runInNewContext(source('src/lib/client/hostedTurnstile.ts'), { exports, require: () => constants, window, document,
    crypto: { getRandomValues: crypto.getRandomValues.bind(crypto) },
    setTimeout(fn) { const id = Symbol(); timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id) });
  const widget = exports.mountHostedLoginTurnstile(element, value => states.push(value));
  return { widget, children, posts, states, timers, listeners,
    get frame() { return children.find(node => node.tag === 'iframe'); },
    get input() { return children.find(node => node.tag === 'input'); },
    message(data, extras = {}) { listeners.get('message')?.({ origin, source: this.frame.contentWindow,
      data: { type, channel: this.frame.src.split('#')[1], ...data }, ...extras }); } };
}

await check('native check uses a fixed production URL and fragment-only correlation; no account data or SDK in the parent', () => {
  const c = nativeClient();
  assert.match(c.frame.src, /^https:\/\/criminiops\.com\/login\/security-check#[a-f0-9]{32}$/);
  assert.equal(c.frame.referrerPolicy, 'no-referrer');
  assert.equal(c.input.name, 'cf-turnstile-response'); assert.equal(c.input.value, '');
  c.frame.onload(); assert.equal(c.posts.length, 1); assert.equal(c.posts[0].target, origin);
  assert.equal(c.posts[0].data.command, 'start'); assert.equal(c.children.some(node => node.tag === 'script'), false);
  c.widget.destroy();
});
await check('forged origin, source window, channel, payload, token and resize messages cannot populate the login form', () => {
  const c = nativeClient();
  for (const extras of [{ origin: 'https://attacker.invalid' }, { origin: 'null' }, { source: {} },
    { data: null }, { data: { type, channel: 'wrong', status: 'complete', token: 'bad' } }]) {
    c.message({ status: 'complete', token: 'bad' }, extras); assert.equal(c.input.value, '');
  }
  for (const token of ['', 'x'.repeat(2049), {}, 7]) c.message({ status: 'complete', token });
  assert.equal(c.input.value, '');
  c.message({ status: 'size', height: 10000 }); assert.equal(c.frame.style.height, undefined);
  c.message({ status: 'size', height: 140 }); assert.equal(c.frame.style.height, '140px');
  c.message({ status: 'complete', token: 'valid-short-lived-response' });
  assert.equal(c.input.value, 'valid-short-lived-response'); assert.equal(c.timers.size, 0);
  c.message({ status: 'expired' }); assert.equal(c.input.value, ''); assert.equal(c.states.at(-1), true);
  c.widget.destroy();
});
await check('retry replaces the frame and channel, rejects delayed responses and removes all tokens/listeners/timers on exit', () => {
  const c = nativeClient(), old = c.frame, oldChannel = old.src.split('#')[1];
  c.message({ status: 'complete', token: 'old' }); c.widget.reset();
  assert.notEqual(c.frame, old); assert.notEqual(c.frame.src.split('#')[1], oldChannel);
  assert.equal(c.input.value, ''); assert.equal(old.onload, null);
  c.message({ status: 'complete', token: 'old' }, { source: old.contentWindow });
  c.message({ status: 'complete', token: 'old', channel: oldChannel });
  assert.equal(c.input.value, '');
  [...c.timers.values()][0](); assert.equal(c.states.at(-1), true);
  c.widget.reset(); c.frame.onerror(); assert.equal(c.states.at(-1), true);
  c.widget.destroy(); c.widget.reset();
  assert.equal(c.children.length, 0); assert.equal(c.listeners.size, 0); assert.equal(c.timers.size, 0);
});

const response = route.GET({ locals: { env } });
const html = await response.text();
await check('hosted response uses strict per-response nonce CSP, explicit native ancestors, no-store and no secret interpolation', () => {
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  const policy = response.headers.get('content-security-policy');
  assert.match(policy, /frame-ancestors https:\/\/localhost capacitor:\/\/localhost/);
  assert.ok(!policy.includes('unsafe-inline') && !policy.includes('unsafe-eval') && !policy.includes('*'));
  const nonce = policy.match(/'nonce-([a-f0-9]{32})'/)[1];
  assert.ok(html.includes(`<script nonce="${nonce}"`) && html.includes(`<style nonce="${nonce}">`));
  assert.ok(!html.includes(env.TURNSTILE_SECRET_KEY));
  assert.notEqual(route.GET({ locals: { env } }).headers.get('content-security-policy'), policy);
  for (const config of [{}, { TURNSTILE_SITE_KEY: 'site' }, { ...env, TURNSTILE_SITE_KEY: '</script>' }]) {
    assert.equal(route.GET({ locals: { env: config } }).status, 503);
  }
});

function hosted({ parentOrigin = 'https://localhost', embedded = true, channel = 'a'.repeat(32), width = 320 } = {}) {
  const listeners = new Map(), scripts = [], posts = [], timers = new Map(); let options;
  const parent = { postMessage: (data, target) => posts.push({ data, target }) };
  const window = { location: { hash: '#' + channel }, innerWidth: width,
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
    turnstile: { render(container, args) { options = args; return 'isolated-widget'; } } };
  window.parent = embedded ? parent : window;
  const document = { currentScript: { nonce: 'isolated-nonce', dataset: { siteKey: env.TURNSTILE_SITE_KEY, messageType: type } }, createElement: () => ({}),
    getElementById: () => ({}), head: { appendChild: script => scripts.push(script) } };
  runInNewContext(html.match(/<script nonce="[^"]+"[^>]*>([\s\S]*?)<\/script>/)[1], { window, document,
    setTimeout(fn) { const id = Symbol(); timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id) });
  return { window, parent, scripts, posts, timers, get options() { return options; },
    start(extra = {}) { listeners.get('message')?.({ source: parent, origin: parentOrigin,
      data: { type, channel, command: 'start' }, ...extra }); } };
}

await check('hosted view refuses top-level/foreign/stale handshakes and does not fetch the SDK until its native parent starts it', () => {
  for (const args of [{ embedded: false }, { channel: 'bad' }]) { const c = hosted(args); c.start(); assert.equal(c.scripts.length, 0); }
  const c = hosted();
  c.start({ origin: 'https://attacker.invalid' }); c.start({ source: {} }); c.start({ data: null });
  c.start({ data: { type, channel: 'b'.repeat(32), command: 'start' } }); assert.equal(c.scripts.length, 0);
  c.start(); c.start(); assert.equal(c.scripts.length, 1);
  assert.equal(c.scripts[0].src, 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
  assert.equal(c.scripts[0].nonce, 'isolated-nonce');
});
await check('Android/custom-scheme/opaque native parents receive bounded tokens and expiry/error states, with responsive size', () => {
  for (const parentOrigin of ['https://localhost', 'capacitor://localhost', 'null']) {
    const c = hosted({ parentOrigin, width: parentOrigin === 'null' ? 280 : 320 }); c.start(); c.scripts[0].onload();
    assert.equal(c.options.action, 'login'); assert.equal(c.options['response-field'], false);
    assert.equal(c.options.sitekey, env.TURNSTILE_SITE_KEY);
    assert.equal(c.posts[0].data.height, parentOrigin === 'null' ? 140 : 65);
    const count = c.posts.length; c.options.callback('x'.repeat(2049)); assert.equal(c.posts.length, count);
    c.options.callback('short-lived-response'); assert.equal(c.posts.at(-1).data.token, 'short-lived-response');
    assert.equal(c.posts.at(-1).target, parentOrigin === 'https://localhost' ? parentOrigin : '*');
    c.options['expired-callback'](); assert.equal(c.posts.at(-1).data.status, 'expired');
    c.options['timeout-callback'](); assert.equal(c.posts.at(-1).data.status, 'expired');
    c.options['error-callback'](); assert.equal(c.posts.at(-1).data.status, 'error');
    assert.equal(c.timers.size, 0);
  }
});
await check('hosted SDK network failure and timeout fail visibly and late script loads cannot produce a token', () => {
  for (const timedOut of [false, true]) {
    const c = hosted(); c.start();
    if (timedOut) [...c.timers.values()][0](); else c.scripts[0].onerror();
    assert.equal(c.posts.at(-1).data.status, 'error'); assert.equal(c.timers.size, 0);
    c.scripts[0].onload(); assert.equal(c.options, undefined);
  }
});
await check('only the exact read-only hosted endpoint can be framed; it cannot read sessions, touch D1 or accept mutations', async () => {
  let queries = 0;
  const hooks = loadServerModules({
    'cloudflare:workers': { env: { ...env, DB: { prepare() { queries++; throw Error('No DB access'); } } }, waitUntil() {} },
    '#lib/server/platformDiagnostics.ts': { async recordRequestDiagnostic() {} }
  })('src/hooks.server.ts');
  const event = method => ({ url: new URL(origin + constants.LOGIN_CHALLENGE_PATH), locals: {},
    request: new Request(origin + constants.LOGIN_CHALLENGE_PATH, { method }),
    cookies: { get() { throw Error('No session access'); } } });
  for (const method of ['GET', 'HEAD']) {
    const e = event(method), result = await hooks.handle({ event: e, resolve: async () => route.GET({ locals: e.locals }) });
    assert.equal(result.status, 200); assert.equal(result.headers.get('x-frame-options'), null);
    assert.match(result.headers.get('content-security-policy'), /frame-ancestors https:\/\/localhost capacitor:\/\/localhost/);
    assert.equal(result.headers.get('referrer-policy'), 'no-referrer'); assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(result.headers.has('set-cookie'), false);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const result = await hooks.handle({ event: event(method), resolve: async () => { throw Error('Must reject'); } });
    assert.equal(result.status, 405); assert.equal(result.headers.get('x-frame-options'), 'DENY');
  }
  assert.equal(queries, 0);
});
console.log(`PASS ${passed} hosted security-check groups; real device/Cloudflare challenge acceptance is still required`);
