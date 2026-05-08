import { fail } from '@sveltejs/kit';
import { sha256Hex } from '$lib/server/auth';
import { logOperationalEvent, logOperationalError } from '$lib/server/observability';

type D1 = App.Platform['env']['DB'];

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export type SessionSummary = {
  id: string;
  deviceId: string | null;
  deviceName: string | null;
  platform: string | null;
  userAgent: string | null;
  lastIp: string | null;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  revokedAt: number | null;
  current: boolean;
};

let securitySchemaEnsured = false;

export async function ensureSecuritySchema(db: D1) {
  if (securitySchemaEnsured) return;

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS security_rate_limits (
        key_hash TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL,
        blocked_until INTEGER,
        last_seen_at INTEGER NOT NULL
      )
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS account_audit_logs (
        id TEXT PRIMARY KEY,
        business_id TEXT,
        actor_user_id TEXT,
        target_user_id TEXT,
        action TEXT NOT NULL,
        email_hash TEXT,
        ip_hash TEXT,
        user_agent_hash TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      )
      `
    )
    .run();

  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_security_rate_limits_action_seen ON security_rate_limits(action, last_seen_at)`)
    .run();
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_account_audit_logs_business_created ON account_audit_logs(business_id, created_at DESC)`)
    .run();

  securitySchemaEnsured = true;
}

export function getRequestIpAddress(request: Request, getClientAddress?: (() => string) | null) {
  try {
    const clientAddress = getClientAddress?.();
    if (clientAddress) return clientAddress;
  } catch {
    // Fall through to forwarded headers.
  }

  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function hashedAuditValue(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  return sha256Hex(normalized);
}

export async function checkRateLimit(
  db: D1,
  {
    action,
    identifier,
    limit,
    windowSeconds,
    blockSeconds
  }: {
    action: string;
    identifier: string;
    limit: number;
    windowSeconds: number;
    blockSeconds: number;
  }
): Promise<RateLimitResult> {
  await ensureSecuritySchema(db);

  const now = Math.floor(Date.now() / 1000);
  const keyHash = await sha256Hex(`${action}:${identifier.trim().toLowerCase()}`);
  const existing = await db
    .prepare(
      `
      SELECT window_start, count, blocked_until
      FROM security_rate_limits
      WHERE key_hash = ?
      LIMIT 1
      `
    )
    .bind(keyHash)
    .first<{ window_start: number; count: number; blocked_until: number | null }>();

  if (existing?.blocked_until && existing.blocked_until > now) {
    return { allowed: false, retryAfterSeconds: existing.blocked_until - now };
  }

  if (!existing || now - existing.window_start >= windowSeconds) {
    await db
      .prepare(
        `
        INSERT INTO security_rate_limits (key_hash, action, window_start, count, blocked_until, last_seen_at)
        VALUES (?, ?, ?, 1, NULL, ?)
        ON CONFLICT(key_hash) DO UPDATE SET
          action = excluded.action,
          window_start = excluded.window_start,
          count = excluded.count,
          blocked_until = NULL,
          last_seen_at = excluded.last_seen_at
        `
      )
      .bind(keyHash, action, now, now)
      .run();
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const nextCount = existing.count + 1;
  const blockedUntil = nextCount > limit ? now + blockSeconds : null;
  await db
    .prepare(
      `
      UPDATE security_rate_limits
      SET count = ?, blocked_until = ?, last_seen_at = ?
      WHERE key_hash = ?
      `
    )
    .bind(nextCount, blockedUntil, now, keyHash)
    .run();

  return {
    allowed: nextCount <= limit,
    retryAfterSeconds: blockedUntil ? blockedUntil - now : 0
  };
}

export async function clearRateLimit(db: D1, action: string, identifier: string) {
  await ensureSecuritySchema(db);
  const keyHash = await sha256Hex(`${action}:${identifier.trim().toLowerCase()}`);
  await db.prepare(`DELETE FROM security_rate_limits WHERE key_hash = ?`).bind(keyHash).run();
}

export function rateLimitFailure(message = 'Too many attempts. Try again shortly.') {
  return fail(429, { error: message });
}

export async function writeAuditLog(
  db: D1,
  {
    action,
    request,
    getClientAddress,
    businessId,
    actorUserId,
    targetUserId,
    email,
    metadata = {}
  }: {
    action: string;
    request?: Request;
    getClientAddress?: (() => string) | null;
    businessId?: string | null;
    actorUserId?: string | null;
    targetUserId?: string | null;
    email?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  await ensureSecuritySchema(db);
  const now = Math.floor(Date.now() / 1000);
  const ip = request ? getRequestIpAddress(request, getClientAddress) : null;
  const userAgent = request?.headers.get('user-agent') ?? null;

  await db
    .prepare(
      `
      INSERT INTO account_audit_logs (
        id,
        business_id,
        actor_user_id,
        target_user_id,
        action,
        email_hash,
        ip_hash,
        user_agent_hash,
        metadata_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      crypto.randomUUID(),
      businessId ?? null,
      actorUserId ?? null,
      targetUserId ?? null,
      action,
      await hashedAuditValue(email),
      await hashedAuditValue(ip),
      await hashedAuditValue(userAgent),
      JSON.stringify(metadata),
      now
    )
    .run();

  logOperationalEvent({
    level: 'info',
    event: 'account_audit_log',
    request,
    businessId,
    userId: actorUserId,
    metadata: {
      action,
      target: targetUserId ? 'user' : 'none',
      status: 'recorded'
    }
  });
}

export async function writeAuditLogSafe(
  db: D1,
  args: Parameters<typeof writeAuditLog>[1]
) {
  try {
    await writeAuditLog(db, args);
  } catch (error) {
    logOperationalError({
      event: 'account_audit_log_failed',
      request: args.request,
      businessId: args.businessId,
      userId: args.actorUserId,
      error,
      metadata: {
        action: args.action
      }
    });
  }
}

export async function revokeUserSessions(
  db: D1,
  userId: string,
  { revokeDevices = false }: { revokeDevices?: boolean } = {}
) {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
    .bind(now, userId)
    .run();

  if (revokeDevices) {
    await db
      .prepare(`UPDATE devices SET revoked_at = ?, updated_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
      .bind(now, now, userId)
      .run();
  }
}

export async function listUserSessions(db: D1, userId: string, currentSessionTokenHash?: string | null) {
  const rows = await db
    .prepare(
      `
      SELECT
        s.id,
        s.device_id,
        s.session_token_hash,
        s.created_at,
        s.last_seen_at,
        s.expires_at,
        s.revoked_at,
        d.name,
        d.platform,
        d.user_agent,
        d.last_ip
      FROM sessions s
      LEFT JOIN devices d ON d.id = s.device_id
      WHERE s.user_id = ?
      ORDER BY COALESCE(s.revoked_at, 0) ASC, s.last_seen_at DESC
      LIMIT 20
      `
    )
    .bind(userId)
    .all<{
      id: string;
      device_id: string | null;
      session_token_hash: string;
      created_at: number;
      last_seen_at: number;
      expires_at: number;
      revoked_at: number | null;
      name: string | null;
      platform: string | null;
      user_agent: string | null;
      last_ip: string | null;
    }>();

  return (rows.results ?? []).map((row) => ({
    id: row.id,
    deviceId: row.device_id,
    deviceName: row.name,
    platform: row.platform,
    userAgent: row.user_agent,
    lastIp: row.last_ip,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    current: Boolean(currentSessionTokenHash && row.session_token_hash === currentSessionTokenHash)
  })) satisfies SessionSummary[];
}

export async function revokeSessionById(db: D1, userId: string, sessionId: string) {
  await db
    .prepare(`UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`)
    .bind(Math.floor(Date.now() / 1000), sessionId, userId)
    .run();
}

export async function revokeOtherUserSessions(db: D1, userId: string, currentSessionTokenHash: string | null) {
  if (!currentSessionTokenHash) {
    await revokeUserSessions(db, userId, { revokeDevices: false });
    return;
  }

  await db
    .prepare(
      `
      UPDATE sessions
      SET revoked_at = ?
      WHERE user_id = ?
        AND session_token_hash != ?
        AND revoked_at IS NULL
      `
    )
    .bind(Math.floor(Date.now() / 1000), userId, currentSessionTokenHash)
    .run();
}
