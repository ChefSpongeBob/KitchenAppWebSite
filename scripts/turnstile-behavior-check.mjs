import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createTestD1, loadServerModules } from './helpers/test-d1.mjs';

let passed = 0;
async function check(label, run) { await run(); passed++; console.log('PASS ' + label); }
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function client() {
  const scripts = [], rendered = [], reset = [], removed = [], timers = new Map();
  const window = {};
  const api = { render(element, options) { const id = String(rendered.length); rendered.push({ id, element, options }); return id; },
    reset(id) { reset.push(id); }, remove(id) { removed.push(id); } };
  const document = { querySelector: () => scripts.find(script => !script.removed) ?? null,
    createElement() {
      const listeners = new Map();
      return { dataset: {}, addEventListener(name, fn) { listeners.set(name, fn); },
        removeEventListener(name) { listeners.delete(name); }, remove() { this.removed = true; },
        fire(name) { listeners.get(name)?.(); } };
    }, head: { appendChild(script) { scripts.push(script); } } };
  const exports = {};
  const source = ts.transpileModule(readFileSync('src/lib/client/turnstile.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  runInNewContext(source, { exports, window, document, Promise, Error,
    setTimeout(fn) { const id = Symbol(); timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); } });
  return { mount: exports.mountLoginTurnstile, scripts, rendered, reset, removed, window, timers,
    ready() { window.turnstile = api; scripts.at(-1)?.fire('load'); } };
}

await check('unconfigured widget does not load scripts, render or create timers', async () => {
  const c = client(), widget = c.mount({}, '', () => {});
  await flush(); widget.reset(); widget.destroy();
  assert.equal(c.scripts.length, 0); assert.equal(c.rendered.length, 0); assert.equal(c.timers.size, 0);
});
await check('concurrent mounts share one explicit SDK load and have independent widgets', async () => {
  const c = client(), first = c.mount({}, 'isolated-site', () => {}), second = c.mount({}, 'isolated-site', () => {});
  assert.equal(c.scripts.length, 1);
  assert.equal(c.scripts[0].src, 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
  c.ready(); await flush();
  assert.equal(c.rendered.length, 2); assert.equal(c.timers.size, 0);
  assert.equal(c.rendered[0].options.action, 'login'); assert.equal(c.rendered[0].options.theme, 'light');
  first.reset(); second.reset(); assert.deepEqual(c.reset, ['0', '1']);
  first.destroy(); second.destroy(); assert.deepEqual(c.removed, ['0', '1']);
});
await check('leaving before SDK load prevents late mounting; revisiting renders with loaded API', async () => {
  const c = client(), old = c.mount({}, 'isolated-site', () => {});
  old.destroy(); c.ready(); await flush(); assert.equal(c.rendered.length, 0);
  const current = c.mount({}, 'isolated-site', () => {}); await flush();
  assert.equal(c.scripts.length, 1); assert.equal(c.rendered.length, 1); current.destroy();
});
await check('script failure and timeout are visible and can retry without duplicate SDK requests', async () => {
  for (const timeout of [false, true]) {
    const c = client(), states = [], widget = c.mount({}, 'isolated-site', value => states.push(value));
    if (timeout) [...c.timers.values()][0](); else c.scripts[0].fire('error');
    await flush(); assert.equal(states.at(-1), true); assert.equal(c.timers.size, 0);
    widget.reset(); widget.reset(); assert.equal(c.scripts.length, 2);
    c.ready(); await flush(); assert.equal(c.rendered.length, 1); assert.equal(states.at(-1), false);
    widget.destroy();
  }
});
await check('failed verification can reset; destroyed callbacks and retries do nothing', async () => {
  const c = client(), states = [], widget = c.mount({}, 'isolated-site', value => states.push(value));
  c.ready(); await flush(); c.rendered[0].options['error-callback'](); assert.equal(states.at(-1), true);
  widget.reset(); assert.equal(states.at(-1), false); assert.deepEqual(c.reset, ['0']);
  widget.destroy(); const count = states.length;
  c.rendered[0].options.callback('never-log-token'); c.rendered[0].options['error-callback'](); widget.reset();
  assert.equal(states.length, count); assert.deepEqual(c.reset, ['0']);
});

const originalFetch = globalThis.fetch;
const env = { TURNSTILE_SITE_KEY: 'isolated-site', TURNSTILE_SECRET_KEY: 'isolated-secret' };
let calls = [];
const valid = { success: true, action: 'login', hostname: 'criminiops.com' };
function provider(body = valid, status = 200) {
  calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return Response.json(body, { status }); };
}
function submission(overrides = {}) {
  const formData = new FormData(); formData.set('cf-turnstile-response', 'isolated-response');
  return { env, formData, request: new Request('https://criminiops.com/login', { headers: { 'cf-connecting-ip': '192.0.2.10' } }), ...overrides };
}
try {
  const server = loadServerModules()('src/lib/server/turnstile.ts');
  await check('both absent preserves existing configuration; partial configuration fails closed', async () => {
    provider();
    assert.equal((await server.validateTurnstileSubmission(submission({ env: {} }))).required, false);
    for (const config of [{ TURNSTILE_SITE_KEY: 'site' }, { TURNSTILE_SECRET_KEY: 'secret' }]) {
      const result = await server.validateTurnstileSubmission(submission({ env: config }));
      assert.equal(result.ok, false); assert.equal(result.reason, 'incomplete_configuration');
    }
    assert.equal(calls.length, 0);
  });
  await check('missing, oversized and File tokens cannot call the provider or bypass the check', async () => {
    provider();
    for (const value of ['', 'x'.repeat(2049), new File(['token'], 'token')]) {
      const args = submission(); args.formData.set('cf-turnstile-response', value);
      const result = await server.validateTurnstileSubmission(args);
      assert.equal(result.ok, false); assert.equal(result.reason, 'missing_token');
    }
    assert.equal(calls.length, 0);
  });
  await check('valid browser and native tokens use fixed server-only Siteverify endpoint and login action', async () => {
    provider(); assert.equal((await server.validateTurnstileSubmission(submission())).ok, true);
    assert.equal(calls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.body.get('secret'), env.TURNSTILE_SECRET_KEY);
    assert.equal(calls[0].init.body.get('remoteip'), '192.0.2.10');
    assert.match(calls[0].init.body.get('idempotency_key'), /^[a-f\d-]{36}$/);
    provider({ ...valid, hostname: 'localhost' });
    assert.equal((await server.validateTurnstileSubmission(submission())).ok, false);
    assert.equal((await server.validateTurnstileSubmission(submission({ request:
      new Request('https://criminiops.com/login', { headers: { 'x-crimini-native': '1' } }) }))).ok, true);
  });
  await check('wrong host/action, missing fields, provider rejection and malformed responses fail closed', async () => {
    for (const response of [{ ...valid, action: 'other' }, { ...valid, hostname: 'attacker.invalid' },
      { success: true }, { ...valid, success: 'true' }, { success: false, 'error-codes': ['timeout-or-duplicate'] }, null]) {
      provider(response); assert.equal((await server.validateTurnstileSubmission(submission())).ok, false);
    }
    provider(valid, 503); assert.equal((await server.validateTurnstileSubmission(submission())).reason, 'verify_http_error');
    globalThis.fetch = async () => new Response('malformed');
    assert.equal((await server.validateTurnstileSubmission(submission())).ok, false);
    globalThis.fetch = async () => { throw Error('isolated network failure'); };
    assert.equal((await server.validateTurnstileSubmission(submission())).reason, 'verify_unavailable');
  });
  await check('native marker alone never bypasses validation and alias must match verified hostname', async () => {
    provider({ success: false });
    assert.equal((await server.validateTurnstileSubmission(submission({ request:
      new Request('https://criminiops.com/login', { headers: { 'x-crimini-native': '1' } }) }))).ok, false);
    provider({ ...valid, hostname: 'criminikitchenappwebsite.pages.dev' });
    assert.equal((await server.validateTurnstileSubmission(submission({ request:
      new Request('https://criminikitchenappwebsite.pages.dev/login') }))).ok, true);
  });
  await check('actual login action rejects invalid challenge before looking up a user or creating sessions', async () => {
    const db = createTestD1();
    try {
      provider({ success: false });
      const route = loadServerModules()('src/routes/login/+page.server.ts');
      const form = new FormData(); form.set('email', 'isolated@example.invalid'); form.set('password', 'Isolated-password-123!');
      form.set('cf-turnstile-response', 'isolated-response');
      const result = await route.actions.login({ request: new Request('https://criminiops.com/login?/login', { method: 'POST', body: form }),
        locals: { DB: db.db, env }, getClientAddress: () => '192.0.2.10', url: new URL('https://criminiops.com/login?/login'),
        cookies: { set() { throw Error('No session may be created'); }, get() {} } });
      assert.equal(result.status, 400); assert.match(result.data.error, /Security check failed/);
      assert.equal(db.sqlite.prepare('SELECT count(*) n FROM sessions').get().n, 0);
      assert.equal(db.sqlite.prepare("SELECT count(*) n FROM account_audit_logs WHERE action='login_turnstile_failed'").get().n, 1);
      assert.equal(db.sqlite.prepare("SELECT count(*) n FROM security_rate_limits WHERE action='login_email'").get().n, 0);
    } finally { db.close(); }
  });
} finally { globalThis.fetch = originalFetch; }

const page = readFileSync('src/routes/login/+page.svelte', 'utf8');
assert.match(page, /finally\s*\{\s*submitting = false;\s*if \(result.type !== 'redirect'\) securityWidget\?\.reset\(\)/);
assert.ok(page.includes('{#key turnstileSiteKey}') && page.includes('bind:this={securityWidget}'));
console.log(`PASS ${passed} isolated Turnstile groups; no live provider calls, email or production writes`);
