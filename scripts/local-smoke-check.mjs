const baseUrl =
  process.env.SMOKE_BASE_URL?.trim() ||
  process.env.APP_BASE_URL?.trim() ||
  'http://localhost:5173';
const email = process.env.SMOKE_EMAIL?.trim() || '';
const password = process.env.SMOKE_PASSWORD?.trim() || '';
const internalToken = process.env.SMOKE_INTERNAL_TOKEN?.trim() || '';
const runAdminChecks = (process.env.SMOKE_ADMIN ?? '1').trim() !== '0';

const origin = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
const cookieJar = new Map();
const results = [];

const publicRoutes = [
  ['/', 'Marketing homepage'],
  ['/features', 'Marketing features'],
  ['/how-it-works', 'How it works'],
  ['/pricing', 'Pricing'],
  ['/about', 'Marketing about'],
  ['/login', 'Login'],
  ['/register', 'Register onboarding'],
  ['/forgot-password', 'Forgot password']
];

const privateRoutes = [
  ['/app', 'App homepage'],
  ['/schedule', 'Team schedule'],
  ['/my-schedule', 'My schedule'],
  ['/settings', 'Settings/profile'],
  ['/lists', 'Lists hub'],
  ['/lists/preplists', 'Prep lists'],
  ['/lists/orders', 'Order lists'],
  ['/lists/inventory', 'Inventory lists'],
  ['/lists/checklists', 'Checklists'],
  ['/recipes', 'Recipes'],
  ['/docs', 'Documents'],
  ['/temper', 'Temperatures'],
  ['/todo', 'ToDo'],
  ['/whiteboard', 'Whiteboard'],
  ['/meeting-notes', 'Meeting notes'],
  ['/menu', 'Menu'],
  ['/specials', 'Specials']
];

const adminRoutes = [
  ['/admin', 'Admin dashboard'],
  ['/admin/app-editor', 'App editor'],
  ['/admin/creator', 'Creator'],
  ['/admin/lists', 'Admin lists'],
  ['/admin/documents', 'Admin documents'],
  ['/admin/recipes', 'Admin recipes'],
  ['/admin/schedule', 'Admin schedule builder'],
  ['/admin/schedule-roles', 'Schedule roles'],
  ['/admin/schedule-settings', 'Schedule settings'],
  ['/admin/users', 'Admin users'],
  ['/admin/camera', 'Camera and sensors']
];

function log(status, message) {
  const prefix = status ? 'OK' : 'FAIL';
  const line = `${prefix}: ${message}`;
  results.push({ status, message });
  console[status ? 'log' : 'error'](line);
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
  return [...cookieJar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
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

async function assertReachable(path, label, options = {}) {
  const response = await request(path);
  const ok = response.status >= 200 && response.status < 300;
  if (ok) {
    log(true, `${label} ${path} responded ${response.status}`);
    return true;
  }

  if (options.allowAuthRedirect && response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location') ?? '';
    if (
      location.includes('/login') ||
      location.includes('/billing') ||
      location.includes('/app') ||
      location.includes('/admin')
    ) {
      log(true, `${label} ${path} redirected to ${location}`);
      return true;
    }
  }

  log(false, `${label} ${path} expected 2xx, got ${response.status}`);
  return false;
}

async function createSmokeSession() {
  if (internalToken) {
    const response = await request('/api/internal/smoke/session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-smoke-token': internalToken
      },
      body: JSON.stringify(email ? { email } : {})
    });
    if (response.status >= 200 && response.status < 300) {
      log(true, `Internal smoke session established ${response.status}`);
      return true;
    }
    log(false, `Internal smoke session expected 2xx, got ${response.status}`);
    return false;
  }

  if (email && password) {
    const response = await request('/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, password }).toString()
    });
    if (response.status === 302 || response.status === 303) {
      log(true, `Password smoke login redirected ${response.status}`);
      return true;
    }
    log(false, `Password smoke login expected redirect, got ${response.status}`);
    return false;
  }

  console.log('Skipping authenticated route checks. Set SMOKE_INTERNAL_TOKEN or SMOKE_EMAIL/SMOKE_PASSWORD.');
  return false;
}

async function revokeSmokeSession() {
  if (internalToken) {
    const response = await request('/api/internal/smoke/session', {
      method: 'DELETE',
      headers: { 'x-smoke-token': internalToken }
    });
    if (response.status >= 200 && response.status < 300) {
      log(true, `Internal smoke session revoked ${response.status}`);
    } else {
      log(false, `Internal smoke session revoke expected 2xx, got ${response.status}`);
    }
    return;
  }

  if (email && password) {
    const response = await request('/logout');
    if (response.status === 302 || response.status === 303) {
      log(true, `Logout redirected ${response.status}`);
    } else {
      log(false, `Logout expected redirect, got ${response.status}`);
    }
  }
}

async function main() {
  console.log(`Local smoke target: ${origin}`);

  for (const [path, label] of publicRoutes) {
    await assertReachable(path, label);
  }

  const authenticated = await createSmokeSession();
  if (authenticated) {
    for (const [path, label] of privateRoutes) {
      await assertReachable(path, label, { allowAuthRedirect: true });
    }

    if (runAdminChecks) {
      for (const [path, label] of adminRoutes) {
        await assertReachable(path, label, { allowAuthRedirect: true });
      }
    }

    await revokeSmokeSession();
  }

  const failed = results.some((entry) => !entry.status);
  if (failed) {
    console.error('\nLocal smoke check failed.');
    process.exitCode = 1;
    return;
  }

  console.log('\nLocal smoke check passed.');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Local smoke check crashed: ${message}`);
  process.exitCode = 1;
});
