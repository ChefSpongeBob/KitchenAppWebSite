const baseUrl = process.env.SMOKE_BASE_URL?.trim() || process.env.APP_BASE_URL?.trim() || '';
const email = process.env.SMOKE_EMAIL?.trim() || '';
const password = process.env.SMOKE_PASSWORD?.trim() || '';
const runAdminChecks = (process.env.SMOKE_ADMIN ?? '').trim() === '1';

if (!baseUrl) {
  console.error('Missing SMOKE_BASE_URL (or APP_BASE_URL).');
  process.exit(1);
}

const origin = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
const cookieJar = new Map();
let failed = false;

function logPass(message) {
  console.log(`OK: ${message}`);
}

function logFail(message) {
  console.error(`FAIL: ${message}`);
  failed = true;
}

function setCookiesFromHeaders(headers) {
  const setCookie =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : headers.get('set-cookie')
        ? [headers.get('set-cookie')]
        : [];

  for (const raw of setCookie) {
    if (!raw) continue;
    const firstChunk = raw.split(';')[0];
    const eqIndex = firstChunk.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = firstChunk.slice(0, eqIndex).trim();
    const value = firstChunk.slice(eqIndex + 1).trim();
    if (!value) cookieJar.delete(key);
    else cookieJar.set(key, value);
  }
}

function cookieHeaderValue() {
  if (cookieJar.size === 0) return '';
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  const cookie = cookieHeaderValue();
  if (cookie) headers.set('cookie', cookie);

  const response = await fetch(`${origin}${path}`, {
    redirect: 'manual',
    ...options,
    headers
  });
  setCookiesFromHeaders(response.headers);
  return response;
}

async function assertGetOk(path, label) {
  const response = await request(path);
  if (response.status >= 200 && response.status < 300) {
    logPass(`${label} (${response.status})`);
    return true;
  }
  logFail(`${label} expected 2xx, got ${response.status}`);
  return false;
}

async function main() {
  await assertGetOk('/login', 'Login page');
  await assertGetOk('/forgot-password', 'Forgot password page');

  if (email && password) {
    const body = new URLSearchParams({ email, password }).toString();
    const loginResponse = await request('/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body
    });
    if (loginResponse.status === 303 || loginResponse.status === 302) {
      logPass(`Login action redirect (${loginResponse.status})`);
    } else {
      logFail(`Login action expected redirect, got ${loginResponse.status}`);
    }

    await assertGetOk('/', 'Homepage after login');
    await assertGetOk('/schedule', 'Team schedule');
    await assertGetOk('/my-schedule', 'My schedule');
    await assertGetOk('/settings', 'My profile/settings');

    const forgotBody = new URLSearchParams({ email }).toString();
    const forgotResponse = await request('/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: forgotBody
    });
    if (forgotResponse.status >= 200 && forgotResponse.status < 400) {
      logPass(`Forgot-password submit (${forgotResponse.status})`);
    } else {
      logFail(`Forgot-password submit expected <400, got ${forgotResponse.status}`);
    }

    if (runAdminChecks) {
      await assertGetOk('/admin', 'Admin dashboard');
      await assertGetOk('/admin/schedule', 'Admin schedule builder');
    }

    const logoutResponse = await request('/logout');
    if (logoutResponse.status === 303 || logoutResponse.status === 302) {
      logPass(`Logout redirect (${logoutResponse.status})`);
    } else {
      logFail(`Logout expected redirect, got ${logoutResponse.status}`);
    }
  } else {
    console.log('Skipping authenticated checks. Set SMOKE_EMAIL and SMOKE_PASSWORD to enable.');
  }

  if (failed) {
    process.exitCode = 1;
    console.error('\nProduction smoke check failed.');
  } else {
    console.log('\nProduction smoke check passed.');
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Smoke check crashed: ${message}`);
  process.exitCode = 1;
});
