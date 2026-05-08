import { json } from '@sveltejs/kit';
import { hashSessionToken } from '$lib/server/auth';
import {
  getSessionCookieDeleteOptions,
  getSessionCookieName,
  getSessionCookieOptions
} from '$lib/server/authCookies';
import { hasColumn } from '$lib/server/dbSchema';

function getSmokeToken(request: Request) {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return request.headers.get('x-smoke-token')?.trim() ?? '';
}

function unauthorized() {
  return json({ error: 'Not found.' }, { status: 404 });
}

function readEnvValue(platform: App.Platform | undefined, key: string) {
  const platformValue = platform?.env?.[key as keyof App.Platform['env']];
  if (typeof platformValue === 'string' && platformValue.trim()) {
    return platformValue.trim();
  }

  const nodeProcess = (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process;
  return nodeProcess?.env?.[key]?.trim() ?? '';
}

async function findUserByEmail(db: App.Platform['env']['DB'], emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  const hasNormalized = await hasColumn(db, 'users', 'email_normalized');
  const sql = hasNormalized
    ? `SELECT id, role, is_active FROM users WHERE email_normalized = ? LIMIT 1`
    : `SELECT id, role, is_active FROM users WHERE lower(email) = ? LIMIT 1`;
  return db
    .prepare(sql)
    .bind(email)
    .first<{ id: string; role: string | null; is_active: number | null }>();
}

export const POST = async ({ request, cookies, locals, platform }) => {
  const configuredToken = readEnvValue(platform, 'SMOKE_INTERNAL_TOKEN');
  const suppliedToken = getSmokeToken(request);
  if (!configuredToken || !suppliedToken || suppliedToken !== configuredToken) {
    return unauthorized();
  }

  const db = locals.DB;
  if (!db) {
    return json({ error: 'Database unavailable.' }, { status: 503 });
  }

  let payload: { email?: string } = {};
  try {
    payload = (await request.json()) as { email?: string };
  } catch {
    payload = {};
  }

  const requestedEmail =
    payload.email?.trim() || readEnvValue(platform, 'SMOKE_DEFAULT_EMAIL');
  if (!requestedEmail) {
    return json({ error: 'Missing email.' }, { status: 400 });
  }

  const user = await findUserByEmail(db, requestedEmail);
  if (!user || (user.is_active ?? 1) !== 1) {
    return json({ error: 'Active user not found.' }, { status: 404 });
  }

  const now = Math.floor(Date.now() / 1000);
  const expires = now + 60 * 60 * 24 * 7;
  const sessionId = crypto.randomUUID();
  const sessionToken = crypto.randomUUID();
  const sessionTokenHash = await hashSessionToken(sessionToken);

  let device = await db
    .prepare(
      `
      SELECT id
      FROM devices
      WHERE user_id = ?
        AND revoked_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 1
    `
    )
    .bind(user.id)
    .first<{ id: string }>();

  if (!device) {
    const deviceId = crypto.randomUUID();
    await db
      .prepare(
        `
        INSERT INTO devices (id, user_id, pin_hash, created_at, updated_at)
        VALUES (?, ?, '', ?, ?)
      `
      )
      .bind(deviceId, user.id, now, now)
      .run();
    device = { id: deviceId };
  }

  await db
    .prepare(
      `
      INSERT INTO sessions (
        id,
        user_id,
        device_id,
        session_token_hash,
        created_at,
        last_seen_at,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    )
    .bind(sessionId, user.id, device.id, sessionTokenHash, now, now, expires)
    .run();

  const cookieName = getSessionCookieName();
  cookies.set(cookieName, sessionToken, getSessionCookieOptions(request));
  cookies.delete('session_id', { path: '/' });
  cookies.delete('session_id_pwa', { path: '/' });

  return json({ ok: true, userId: user.id, role: user.role ?? 'user' });
};

export const DELETE = async ({ request, cookies, locals, platform }) => {
  const configuredToken = readEnvValue(platform, 'SMOKE_INTERNAL_TOKEN');
  const suppliedToken = getSmokeToken(request);
  if (!configuredToken || !suppliedToken || suppliedToken !== configuredToken) {
    return unauthorized();
  }

  const db = locals.DB;
  const cookieName = getSessionCookieName();
  const rawToken =
    cookies.get(cookieName) ?? cookies.get('session_id') ?? cookies.get('session_id_pwa');

  if (db && rawToken) {
    const now = Math.floor(Date.now() / 1000);
    const hashed = await hashSessionToken(rawToken);
    await db
      .prepare(
        `
        UPDATE sessions
        SET revoked_at = ?
        WHERE session_token_hash = ?
           OR session_token_hash = ?
           OR id = ?
      `
      )
      .bind(now, hashed, rawToken, rawToken)
      .run();
  }

  cookies.delete(cookieName, getSessionCookieDeleteOptions(request));
  cookies.delete('session_id', { path: '/' });
  cookies.delete('session_id_pwa', { path: '/' });

  return json({ ok: true });
};
