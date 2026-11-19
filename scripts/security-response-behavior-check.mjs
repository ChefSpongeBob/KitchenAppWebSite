import assert from 'node:assert/strict';
import { createTestD1, loadServerModules, serializeTestCookie } from './helpers/test-d1.mjs';

const fixture = createTestD1();
const load = loadServerModules({
  'cloudflare:workers': { env: { DB: fixture.db }, waitUntil() {} },
  '#lib/server/observability.ts': { logOperationalEvent() {}, logOperationalError() {} },
  '#lib/server/platformDiagnostics.ts': { async recordRequestDiagnostic() {} },
  '#lib/server/operationalEvents.ts': { async processOperationalEvents() { throw Error('No event dispatch during signed-out reads'); } }
});
const hooks = load('src/hooks.server.ts');
function secure(response) {
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('strict-transport-security'), /max-age=31536000/);
  const script = response.headers.get('content-security-policy').split(';').find(directive => directive.trim().startsWith('script-src '));
  assert.ok(script && !script.includes('unsafe-inline') && !script.includes('unsafe-eval'));
}
async function request(path, { token, data = false, enhanced = false, method = 'GET', headers = {}, resolve } = {}) {
  const url = new URL(path, 'https://criminiops.com');
  const jar = new Map(token ? [['__Host-kitchen_session', token]] : []);
  const event = { url, isDataRequest: data, request: new Request(url, { method, headers: { origin: url.origin,
    ...(enhanced ? { 'x-sveltekit-action': 'true' } : {}), ...headers } }), locals: {},
    cookies: { serialize: serializeTestCookie, get: name => jar.get(name), set: (name, value) => jar.set(name, value), delete: name => jar.delete(name) } };
  return hooks.handle({ event, resolve: resolve ?? (async () => { throw Error('Protected content must not resolve'); }) });
}
try {
  for (const path of ['/admin', '/staff', '/onboarding', '/api/documents/media/businesses/a/private.pdf']) {
    const response = await request(path); secure(response); assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), path === '/staff' ? '/login?staff=1' : '/login');
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
  const invalid = await request('/admin', { token: 'invalid-fixture-session' }); secure(invalid);
  assert.equal(invalid.headers.get('location'), '/login?error=session');
  const cookies = invalid.headers.getSetCookie();
  assert.ok(cookies.some(cookie => cookie.startsWith('__Host-kitchen_session=') && /Max-Age=0/i.test(cookie) && /Secure/.test(cookie) && /HttpOnly/.test(cookie)));
  assert.ok(cookies.some(cookie => cookie.startsWith('kitchen_active_business=') && /Max-Age=0/i.test(cookie)));
  for (const options of [{ data: true }, { method: 'POST', enhanced: true }]) {
    const response = await request('/admin', options); secure(response); assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { type: 'redirect', status: 303, location: '/login' });
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
  const policy = "default-src 'self'; script-src 'self' 'nonce-isolated-test'; object-src 'none'";
  const login = await request('/login', { resolve: async () => new Response('Isolated sign-in screen', { headers: { 'content-security-policy': policy } }) });
  assert.equal(login.headers.get('content-security-policy'), policy, 'Never overwrite SvelteKit generated nonces/hashes');
  assert.match(login.headers.get('cache-control'), /no-store/);
  const denied = await request('/admin', { method: 'POST', headers: { origin: 'https://foreign.example.invalid' } });
  secure(denied); assert.equal(denied.status, 403);
  console.log('PASS actual auth hook: browser/data/enhanced-action redirect formats, security/no-store headers, expired-cookie deletion, framework CSP preservation and cross-site denial');
} finally { fixture.close(); }
