import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createTestD1, loadServerModules } from './helpers/test-d1.mjs';

const source = [...readFileSync('src/app.html', 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .find(([, script]) => script.includes('__CRIMINI_NATIVE__'))?.[1];
assert.ok(source, 'The actual native fetch bridge must be tested');

function bridge({ native = true, origin = 'https://localhost', path = '/login' } = {}) {
  const calls = [];
  const startupPaths = [];
  let response;
  const originalFetch = async (input, init) => {
    calls.push(new Request(input instanceof Request ? input : new URL(input, origin + '/login'), init));
    return response;
  };
  const window = {
    Capacitor: { isNativePlatform: () => native },
    location: { origin: new URL(origin).origin, href: origin + path, pathname: new URL(origin + path).pathname },
    fetch: originalFetch,
    history: { replaceState(state, title, destination) {
      assert.equal(window.location.pathname, '/', 'Non-root startup must not change navigation');
      const url = new URL(destination, origin + '/');
      startupPaths.push(destination); window.location.href = url.href; window.location.pathname = url.pathname;
    } }
  };
  runInNewContext(source, { window, URL, Request, Response, Headers });
  return { calls, startupPaths, window, originalFetch, reply(value) { response = value; } };
}

for (const origin of ['https://localhost', 'capacitor://localhost']) {
  const startup = bridge({ origin, path: '/' });
  assert.deepEqual(startup.startupPaths, ['/app']);
  assert.equal(startup.window.location.pathname, '/app');
  assert.equal(startup.calls.length, 0, 'Startup must rely on the existing server load, not add a second session probe');
  for (const path of ['/login', '/register?invite=FIXTURE-INVITE', '/workspace', '/onboarding', '/app', '/admin/schedule']) {
    const deepLink = bridge({ origin, path });
    assert.deepEqual(deepLink.startupPaths, []);
    assert.equal(deepLink.window.location.href, origin + path);
  }
}
for (const path of ['/', '/login']) {
  const website = bridge({ native: false, origin: 'https://criminiops.com', path });
  assert.deepEqual(website.startupPaths, []);
  assert.equal(website.window.location.href, 'https://criminiops.com' + path);
  assert.equal(website.window.fetch, website.originalFetch);
}
console.log('PASS native-only startup targets the authenticated dashboard; web startup and explicit auth/invite/restaurant/deep links remain unchanged');

for (const origin of ['https://localhost', 'capacitor://localhost']) {
  const transport = bridge({ origin });
  for (const status of [200, 400, 403, 409, 503]) {
    const body = JSON.stringify({ status, message: 'Unchanged payload' });
    const upstream = new Response(body, { status, statusText: 'Status', headers: {
      'content-type': 'application/json', 'cache-control': 'no-store',
      'x-sveltekit-version': 'independent-web-build', 'x-content-type-options': 'nosniff',
      'set-cookie': '__Host-test=fixture; Path=/; Secure; HttpOnly; SameSite=None'
    } });
    Object.defineProperties(upstream, {
      url: { value: 'https://criminiops.com/login/__data.json' },
      redirected: { value: true }, type: { value: 'basic' }
    });
    transport.reply(upstream);
    const response = await transport.window.fetch('/login/__data.json?x-sveltekit-invalidated=11');
    assert.equal(response.headers.has('x-sveltekit-version'), false);
    assert.equal(response.status, status);
    assert.equal(response.statusText, upstream.statusText);
    assert.equal(response.url, upstream.url);
    assert.equal(response.redirected, upstream.redirected);
    assert.equal(response.type, upstream.type);
    const expectedHeaders = new Headers(upstream.headers);
    expectedHeaders.delete('x-sveltekit-version');
    assert.deepEqual([...response.headers], [...expectedHeaders]);
    assert.equal(await response.text(), body);
    const request = transport.calls.at(-1);
    assert.equal(request.url, 'https://criminiops.com/login/__data.json?x-sveltekit-invalidated=11');
    assert.equal(request.headers.get('x-crimini-native'), '1');
    assert.equal(request.credentials, 'include');
  }

  const upstream = new Response('unchanged', { headers: { 'content-type': 'text/plain' } });
  transport.reply(upstream);
  assert.equal(await transport.window.fetch('/api/billing/status'), upstream,
    'Non-versioned responses need no wrapper');

  transport.reply(new Response('failure', { status: 400, headers: { 'x-sveltekit-version': 'web' } }));
  const controller = new AbortController();
  const action = new Request(origin + '/login?/login', { method: 'POST',
    headers: { 'x-sveltekit-action': 'true', accept: 'application/json' },
    body: new URLSearchParams({ email: 'fixture@example.invalid' }), signal: controller.signal });
  const response = await transport.window.fetch(action);
  const request = transport.calls.at(-1);
  assert.equal(request.url, 'https://criminiops.com/login?/login');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.get('x-sveltekit-action'), 'true');
  assert.equal(await request.text(), 'email=fixture%40example.invalid');
  controller.abort();
  assert.equal(request.signal.aborted, true);
  assert.equal(response.status, 400);

  transport.reply(Response.json({ location: '/app' }));
  await transport.window.fetch('/workspace/switch', { method: 'POST', headers: { accept: 'application/json' },
    body: new URLSearchParams({ business_id: 'fixture-b' }) });
  const selection = transport.calls.at(-1);
  assert.equal(selection.url, 'https://criminiops.com/workspace/switch');
  assert.equal(selection.headers.get('x-crimini-native'), '1');
  assert.equal(selection.headers.get('accept'), 'application/json');
  assert.equal(selection.credentials, 'include');
  assert.equal(await selection.text(), 'business_id=fixture-b');
  for (const path of ['/workspace/__data.json', '/register/__data.json?invite=FIXTURE-INVITE']) {
    await transport.window.fetch(path);
    assert.equal(transport.calls.at(-1).url, 'https://criminiops.com' + path);
    assert.equal(transport.calls.at(-1).credentials, 'include');
  }

  const failure = new Error('Network unavailable');
  transport.reply(Promise.reject(failure));
  await assert.rejects(transport.window.fetch('/login/__data.json'), error => error === failure);
  transport.reply(new Response('retry'));
  assert.equal(await (await transport.window.fetch('/login/__data.json')).text(), 'retry');

  for (const path of ['/assets/image.svg', '/_app/version.json', 'https://example.invalid/external',
    'capacitor://other-host/api/documents/media/a.pdf', 'file:///api/temps']) {
    const untouched = new Response('asset', { headers: { 'x-sveltekit-version': 'unchanged' } });
    transport.reply(untouched);
    assert.equal(await transport.window.fetch(new URL(path, origin).href), untouched);
    assert.equal(transport.calls.at(-1).headers.has('x-crimini-native'), false);
  }
  await assert.rejects(transport.window.fetch('https://user:password@localhost/api/temps'), TypeError);
}

const web = bridge({ native: false });
assert.equal(web.window.fetch, web.originalFetch, 'Browser version detection must remain untouched');
assert.equal(web.window.__CRIMINI_NATIVE__, undefined);
console.log('PASS native transport: independent web versions, status/body/headers/metadata, actions, cookies, abort, offline/retry, web and static request isolation');

const fixture = createTestD1();
try {
  const { sqlite, db } = fixture, now = Math.floor(Date.now() / 1000), token = 'isolated-native-resume-session';
  sqlite.prepare("INSERT INTO users(id,email,email_normalized,created_at,updated_at) VALUES('person','person@example.invalid','person@example.invalid',?,?)").run(now, now);
  for (const id of ['a', 'b']) {
    sqlite.prepare("INSERT INTO businesses(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)").run(id, id, id, now, now);
    sqlite.prepare("INSERT INTO business_trials(business_id,owner_user_id,status,trial_started_at,trial_ends_at,created_at,updated_at) VALUES(?,'person','active',?,?,?,?)").run(id, now, now, now, now);
    sqlite.prepare('INSERT INTO business_users(business_id,user_id,role,permission_template,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id, 'person', id === 'a' ? 'owner' : 'staff', id === 'a' ? 'owner' : 'staff', now, now);
  }
  const load = loadServerModules();
  const hashed = await load('src/lib/server/auth.ts').hashSessionToken(token);
  sqlite.prepare("INSERT INTO sessions(id,user_id,session_token_hash,created_at,last_seen_at,expires_at) VALUES('session','person',?,?,?,?)").run(hashed, now, now, now + 3600);
  const hooks = loadServerModules({
    'cloudflare:workers': { env: { DB: db }, waitUntil() {} },
    '#lib/server/observability.ts': { logOperationalEvent() {}, logOperationalError() {} },
    '#lib/server/platformDiagnostics.ts': { async recordRequestDiagnostic() {} },
    '#lib/server/operationalEvents.ts': { async processOperationalEvents() {} }
  })('src/hooks.server.ts');
  async function resume(sessionToken, business = 'b') {
    const cookies = new Map([['kitchen_active_business', business]]);
    if (sessionToken) cookies.set('__Host-kitchen_session', sessionToken);
    const url = new URL(bridge({ path: '/' }).window.location.pathname, 'https://criminiops.com');
    const event = { url, request: new Request(url, { headers: { 'x-crimini-native': '1', origin: 'https://localhost' } }), locals: {},
      cookies: { get: key => cookies.get(key), set: (key, value) => cookies.set(key, value), delete: key => cookies.delete(key) } };
    try {
      await hooks.handle({ event, resolve: async () => new Response('Dashboard authorized') });
      return { location: '/app', businessId: event.locals.businessId, role: event.locals.businessRole };
    } catch (error) {
      if (error.location) return { location: error.location };
      throw error;
    }
  }
  assert.deepEqual(await resume(token), { location: '/app', businessId: 'b', role: 'staff' });
  assert.deepEqual(await resume(token, 'a'), { location: '/app', businessId: 'a', role: 'owner' });
  assert.equal((await resume()).location, '/login');
  assert.equal((await resume('invalid-session')).location, '/login?error=session');
  sqlite.exec('UPDATE sessions SET expires_at=1');
  assert.equal((await resume(token)).location, '/login?error=session');
  sqlite.prepare('UPDATE sessions SET expires_at=?,revoked_at=1').run(now + 3600);
  assert.equal((await resume(token)).location, '/login?error=session');
  sqlite.exec("UPDATE sessions SET revoked_at=NULL; UPDATE business_trials SET status='pending_payment' WHERE business_id='b'");
  assert.equal((await resume(token)).location, '/billing?access=required');
  console.log('PASS native startup uses the actual session/tenant/billing guards: selected restaurant resumes with its own role; absent, invalid, expired and revoked sessions require sign-in');
} finally { fixture.close(); }
