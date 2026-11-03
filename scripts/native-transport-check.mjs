import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = [...readFileSync('src/app.html', 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .find(([, script]) => script.includes('__CRIMINI_NATIVE__'))?.[1];
assert.ok(source, 'The actual native fetch bridge must be tested');

function bridge({ native = true, origin = 'https://localhost' } = {}) {
  const calls = [];
  let response;
  const originalFetch = async (input, init) => {
    calls.push(new Request(input instanceof Request ? input : new URL(input, origin + '/login'), init));
    return response;
  };
  const window = {
    Capacitor: { isNativePlatform: () => native },
    location: { origin: new URL(origin).origin, href: origin + '/login', pathname: '/login' },
    fetch: originalFetch,
    history: { replaceState() { throw Error('Non-root startup must not change navigation'); } }
  };
  runInNewContext(source, { window, URL, Request, Response, Headers });
  return { calls, window, originalFetch, reply(value) { response = value; } };
}

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

  const failure = new Error('Network unavailable');
  transport.reply(Promise.reject(failure));
  await assert.rejects(transport.window.fetch('/login/__data.json'), error => error === failure);
  transport.reply(new Response('retry'));
  assert.equal(await (await transport.window.fetch('/login/__data.json')).text(), 'retry');

  for (const path of ['/assets/image.svg', '/_app/version.json', 'https://example.invalid/external']) {
    const untouched = new Response('asset', { headers: { 'x-sveltekit-version': 'unchanged' } });
    transport.reply(untouched);
    assert.equal(await transport.window.fetch(new URL(path, origin).href), untouched);
    assert.equal(transport.calls.at(-1).headers.has('x-crimini-native'), false);
  }
}

const web = bridge({ native: false });
assert.equal(web.window.fetch, web.originalFetch, 'Browser version detection must remain untouched');
assert.equal(web.window.__CRIMINI_NATIVE__, undefined);
console.log('PASS native transport: independent web versions, status/body/headers/metadata, actions, cookies, abort, offline/retry, web and static request isolation');
