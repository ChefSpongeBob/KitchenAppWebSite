import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parse } from 'devalue';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

const test = createTestD1();
const { sqlite, db } = test;
const now = Math.floor(Date.now() / 1000);
const load = loadServerModules();
const shared = load('src/lib/workspaceIntent.ts');
function insert(table, row) {
  const keys = Object.keys(row);
  sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
}
try {
  for (const id of ['a', 'b']) insert('businesses', { id, name: id, slug: id, created_at: now, updated_at: now });
  insert('users', { id: 'shared', email: 'shared@example.invalid', email_normalized: 'shared@example.invalid', created_at: now, updated_at: now });
  for (const id of ['a', 'b']) {
    insert('business_users', { business_id: id, user_id: 'shared', role: 'owner', permission_template: 'owner', created_at: now, updated_at: now });
    insert('business_trials', { business_id: id, owner_user_id: 'shared', status: 'active', trial_started_at: now, trial_ends_at: now, created_at: now, updated_at: now });
  }
  const token = 'isolated-workspace-session';
  insert('sessions', { id: 'session', user_id: 'shared', session_token_hash: await load('src/lib/server/auth.ts').hashSessionToken(token), created_at: now, last_seen_at: now, expires_at: now + 3600 });
  const hooks = loadServerModules({ 'cloudflare:workers': { env: { DB: db }, waitUntil() {} },
    '#lib/server/observability.ts': { logOperationalEvent() {}, logOperationalError() {} },
    '#lib/server/platformDiagnostics.ts': { async recordRequestDiagnostic() {} },
    '#lib/server/operationalEvents.ts': { async processOperationalEvents() {} } })('src/hooks.server.ts');
  async function submit({ path = '/admin/creator?/create_recipe', expected, cookie = 'b', method = 'POST', enhanced = false, query, referer } = {}) {
    const url = new URL(path, 'https://criminiops.com');
    if (query !== undefined) url.searchParams.set(shared.WORKSPACE_PARAM, query);
    const headers = { origin: url.origin };
    if (expected !== undefined) headers[shared.WORKSPACE_HEADER] = expected;
    if (enhanced) headers['x-sveltekit-action'] = 'true';
    if (referer) headers.referer = referer;
    const cookies = new Map([['__Host-kitchen_session', token], ['kitchen_active_business', cookie]]);
    let resolved = false;
    const event = { url, request: new Request(url, { method, headers }), locals: {}, cookies: { get: key => cookies.get(key), set: (key, value) => cookies.set(key, value), delete: key => cookies.delete(key) } };
    const response = await hooks.handle({ event, resolve: async () => { resolved = true; return new Response('Saved'); } });
    return { response, resolved, cookies, event };
  }
  const before = sqlite.prepare('SELECT total_changes() n').get().n;
  for (const params of [{ expected: 'a' }, { query: 'a' }, { expected: 'b', query: 'a' }, {}, { expected: '' }]) {
    const result = await submit(params);
    assert.equal(result.response.status, 409); assert.equal(result.resolved, false);
    assert.equal(result.response.headers.get(shared.WORKSPACE_CONFLICT_HEADER), '1');
    assert.equal(result.cookies.get('__Host-kitchen_session'), token, 'A stale tab does not log the person out');
    assert.equal(result.cookies.get('kitchen_active_business'), 'b', 'A stale tab cannot switch the cookie back');
  }
  assert.equal(sqlite.prepare('SELECT total_changes() n').get().n, before, 'Rejected requests cannot write or dispatch business actions');
  const enhanced = await submit({ expected: 'a', enhanced: true });
  const action = await enhanced.response.json();
  assert.equal(action.type, 'failure'); assert.equal(action.status, 409);
  assert.equal(parse(action.data).error, shared.WORKSPACE_CHANGED_MESSAGE, 'Use the installed Svelte serializer, not a guessed response shape');
  assert.equal((await submit({ expected: 'b' })).resolved, true);
  assert.equal((await submit({ query: 'b' })).resolved, true);
  assert.equal((await submit({ path: '/app/__data.json', method: 'GET', expected: 'a' })).response.status, 409);
  assert.equal((await submit({ path: '/app', method: 'GET' })).resolved, true, 'A fresh document reload selects the current restaurant');
  sqlite.exec("UPDATE business_users SET is_active=0 WHERE business_id='a'");
  assert.equal((await submit()).resolved, true, 'Existing single-restaurant clients remain compatible');
  assert.equal((await submit({ cookie: 'a' })).response.status, 409, 'Membership revocation cannot redirect a stale write into the remaining restaurant');
  const switchRequest = formRequest({ business_id: 'b' }, '/workspace/switch');
  const switched = new Map();
  await assert.rejects(load('src/routes/workspace/switch/+server.ts').POST({ locals: { DB: db, userId: 'shared' }, request: switchRequest, cookies: { set(key, value) { switched.set(key, value); } } }), error => error.status === 303);
  assert.equal(switched.get('kitchen_active_business'), 'b');
  console.log('PASS actual request guard: stale/missing/conflicting workspace intent, native-form responses, no writes/logout/cookie reversal, fresh reload and authorized switching');

  const source = ts.transpileModule(fs.readFileSync('src/lib/client/workspaceIntent.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const nativeBridge = [...fs.readFileSync('src/app.html', 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .find(([, script]) => script.includes('__CRIMINI_NATIVE__'))?.[1];
  assert.ok(nativeBridge);
  for (const origin of ['https://criminiops.com', 'https://localhost', 'capacitor://localhost']) {
    const native = origin !== 'https://criminiops.com';
    let businessId = 'a'; let conflicts = 0; let response = new Response('OK');
    const calls = []; const listeners = new Map();
    const originalFetch = async (input, options) => { calls.push(new Request(input instanceof Request ? input : new URL(input, origin), options)); return response; };
    const window = { location: { origin: new URL(origin).origin, href: origin + '/admin/creator' }, fetch: originalFetch, Capacitor: { isNativePlatform: () => native } };
    class Element {
      constructor(attributes) { this.attributes = attributes; }
      getAttribute(key) { return this.attributes[key] ?? null; }
      hasAttribute(key) { return key in this.attributes; }
      setAttribute(key, value) { this.attributes[key] = value; }
    }
    class Form extends Element {}
    const document = { addEventListener(name, listener, capture) { assert.equal(capture, true); listeners.set(name, listener); }, removeEventListener(name) { listeners.delete(name); } };
    const exports = {};
    vm.runInNewContext(nativeBridge, { window, URL, Request, Response, Headers });
    const previousFetch = window.fetch;
    vm.runInNewContext(source, { window, document, exports, URL, Request, Headers, HTMLFormElement: Form, require(name) { assert.equal(name, '#lib/workspaceIntent.ts'); return shared; } });
    const stop = exports.installWorkspaceIntent(() => businessId, () => conflicts++);
    await window.fetch('/admin/creator?/save', { method: 'POST', body: 'unchanged' });
    assert.equal(calls.at(-1).headers.get(shared.WORKSPACE_HEADER), 'a'); assert.equal(await calls.at(-1).text(), 'unchanged');
    if (native) {
      assert.equal(calls.at(-1).url, 'https://criminiops.com/admin/creator?/save');
      assert.equal(calls.at(-1).headers.get('x-crimini-native'), '1');
      assert.equal(calls.at(-1).credentials, 'include');
    }
    businessId = 'b';
    const controller = new AbortController();
    await window.fetch(new Request(origin + '/api/whiteboard', { method: 'POST', body: 'idea', signal: controller.signal }));
    assert.equal(calls.at(-1).headers.get(shared.WORKSPACE_HEADER), 'a', 'Reactive data cannot silently adopt the other tab restaurant');
    controller.abort(); assert.equal(calls.at(-1).signal.aborted, true);
    const form = new Form({ method: 'POST', action: '?/create_recipe' });
    listeners.get('submit')({ target: form });
    const formAction = new URL(form.getAttribute('action'));
    assert.equal(formAction.searchParams.get(shared.WORKSPACE_PARAM), 'a'); assert.equal(formAction.searchParams.has('/create_recipe'), true);
    const button = new Element({ formaction: '?/delete_recipe', formmethod: 'post' });
    listeners.get('submit')({ target: form, submitter: button });
    assert.equal(new URL(button.getAttribute('formaction')).searchParams.get(shared.WORKSPACE_PARAM), 'a');
    for (const path of ['/login', '/logout', '/register', '/staff/security', '/workspace/switch', 'https://external.example.invalid/api/']) {
      await window.fetch(path, { method: 'POST' }); assert.equal(calls.at(-1).headers.has(shared.WORKSPACE_HEADER), false);
    }
    if (native) { await window.fetch('https://criminiops.com/api/whiteboard', { method: 'POST' }); assert.equal(calls.at(-1).headers.get(shared.WORKSPACE_HEADER), 'a'); }
    response = new Response('Conflict', { status: 409, headers: { [shared.WORKSPACE_CONFLICT_HEADER]: '1' } });
    await window.fetch('/api/whiteboard'); await window.fetch('/api/whiteboard'); assert.equal(conflicts, 1);
    response = new Response('Invalid login', { status: 400 });
    await window.fetch('/login?/login', { method: 'POST' });
    await window.fetch('/api/whiteboard');
    assert.equal(calls.at(-1).headers.get(shared.WORKSPACE_HEADER), 'a', 'A failed login cannot silently adopt another workspace');
    stop.beginAuthenticationNavigation();
    response = new Response('Loaded');
    await window.fetch('/app/__data.json');
    assert.equal(calls.at(-1).headers.has(shared.WORKSPACE_HEADER), false, 'Explicit authentication navigation loads a fresh authenticated context');
    stop.finishAuthenticationNavigation();
    await window.fetch('/api/whiteboard', { method: 'POST' });
    assert.equal(calls.at(-1).headers.get(shared.WORKSPACE_HEADER), 'b');
    businessId = 'a';
    await window.fetch('/api/whiteboard', { method: 'POST' });
    assert.equal(calls.at(-1).headers.get(shared.WORKSPACE_HEADER), 'b', 'Sticky protection resumes after deliberate login');
    stop(); assert.equal(window.fetch, previousFetch); assert.equal(listeners.size, 0);
  }
  console.log('PASS actual browser and both native bridges: sticky tab intent, normal/enhanced/button forms, bodies/abort/cookies, auth changes, exclusions, one refresh notice and teardown');
} finally { test.close(); }
