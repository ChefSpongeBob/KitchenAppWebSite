import { dev } from '$app/environment';

type DB = App.Platform['env']['DB'];

export type PushPlatform = 'ios' | 'android' | 'web' | 'unknown';

export type PushDeviceInput = {
  businessId: string;
  userId: string;
  token: string;
  platform?: string | null;
  deviceId?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
};

export type PushNotificationDevice = {
  id: string;
  business_id: string;
  user_id: string;
  platform: PushPlatform;
  device_token: string;
  token_hash: string;
  device_id: string | null;
  user_agent: string;
  app_version: string;
  is_active: number;
  created_at: number;
  updated_at: number;
  last_seen_at: number | null;
  revoked_at: number | null;
};

let pushSchemaEnsured = false;
let pushSchemaPromise: Promise<void> | null = null;

function cleanText(value: string | null | undefined, maxLength: number) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function ensureOptionalColumn(db: DB, tableName: string, columnName: string, definition: string) {
  try {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('duplicate column name') || message.includes('already exists')) return;
    throw error;
  }
}

export async function ensurePushNotificationSchema(db: DB) {
  if (!dev) {
    pushSchemaEnsured = true;
    return;
  }
  if (pushSchemaEnsured) return;
  if (pushSchemaPromise) {
    await pushSchemaPromise;
    return;
  }

  pushSchemaPromise = (async () => {
    await ensureOptionalColumn(db, 'user_preferences', 'push_updates', 'INTEGER NOT NULL DEFAULT 0');
    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS push_notification_devices (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          platform TEXT NOT NULL DEFAULT 'unknown',
          device_token TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          device_id TEXT,
          user_agent TEXT NOT NULL DEFAULT '',
          app_version TEXT NOT NULL DEFAULT '',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          last_seen_at INTEGER,
          revoked_at INTEGER
        )
        `
      )
      .run();
    await db
      .prepare(
        `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_push_devices_business_user_token
        ON push_notification_devices(business_id, user_id, token_hash)
        `
      )
      .run();
    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_push_devices_business_active_user
        ON push_notification_devices(business_id, is_active, user_id)
        `
      )
      .run();
    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_push_devices_user_active
        ON push_notification_devices(user_id, is_active)
        `
      )
      .run();
    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_push_devices_token_hash
        ON push_notification_devices(token_hash)
        `
      )
      .run();
    pushSchemaEnsured = true;
  })();

  await pushSchemaPromise;
}

export function normalizePushPlatform(value: string | null | undefined): PushPlatform {
  const normalized = cleanText(value, 24).toLowerCase();
  if (normalized === 'ios' || normalized === 'android' || normalized === 'web') return normalized;
  return 'unknown';
}

export async function hashPushToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function setPushPreference(db: DB, userId: string, enabled: boolean) {
  await ensurePushNotificationSchema(db);
  const now = nowSeconds();
  await db
    .prepare(
      `
      INSERT INTO user_preferences (user_id, email_updates, push_updates, updated_at)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        push_updates = excluded.push_updates,
        updated_at = excluded.updated_at
      `
    )
    .bind(userId, enabled ? 1 : 0, now)
    .run();
}

export async function registerPushDevice(db: DB, input: PushDeviceInput) {
  await ensurePushNotificationSchema(db);
  const businessId = cleanText(input.businessId, 80);
  const userId = cleanText(input.userId, 80);
  const token = cleanText(input.token, 4096);
  if (!businessId || !userId || !token) {
    throw new Error('Missing push device registration data.');
  }

  const now = nowSeconds();
  const tokenHash = await hashPushToken(token);
  const platform = normalizePushPlatform(input.platform);
  const deviceId = cleanText(input.deviceId, 180) || null;

  await db
    .prepare(
      `
      INSERT INTO push_notification_devices (
        id,
        business_id,
        user_id,
        platform,
        device_token,
        token_hash,
        device_id,
        user_agent,
        app_version,
        is_active,
        created_at,
        updated_at,
        last_seen_at,
        revoked_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, NULL)
      ON CONFLICT(business_id, user_id, token_hash) DO UPDATE SET
        platform = excluded.platform,
        device_token = excluded.device_token,
        device_id = excluded.device_id,
        user_agent = excluded.user_agent,
        app_version = excluded.app_version,
        is_active = 1,
        updated_at = excluded.updated_at,
        last_seen_at = excluded.last_seen_at,
        revoked_at = NULL
      `
    )
    .bind(
      crypto.randomUUID(),
      businessId,
      userId,
      platform,
      token,
      tokenHash,
      deviceId,
      cleanText(input.userAgent, 500),
      cleanText(input.appVersion, 80),
      now,
      now,
      now
    )
    .run();

  await setPushPreference(db, userId, true);
  return tokenHash;
}

export async function revokePushDevice(
  db: DB,
  args: {
    businessId: string;
    userId: string;
    token?: string | null;
    tokenHash?: string | null;
    deviceId?: string | null;
  }
) {
  await ensurePushNotificationSchema(db);
  const businessId = cleanText(args.businessId, 80);
  const userId = cleanText(args.userId, 80);
  const deviceId = cleanText(args.deviceId, 180);
  const tokenHash = cleanText(args.tokenHash, 128) || (args.token ? await hashPushToken(args.token) : '');
  const now = nowSeconds();

  if (!businessId || !userId) return 0;

  if (tokenHash) {
    const result = await db
      .prepare(
        `
        UPDATE push_notification_devices
        SET is_active = 0,
            revoked_at = ?,
            updated_at = ?
        WHERE business_id = ?
          AND user_id = ?
          AND token_hash = ?
        `
      )
      .bind(now, now, businessId, userId, tokenHash)
      .run();
    return Number(result.meta?.changes ?? 0);
  }

  if (deviceId) {
    const result = await db
      .prepare(
        `
        UPDATE push_notification_devices
        SET is_active = 0,
            revoked_at = ?,
            updated_at = ?
        WHERE business_id = ?
          AND user_id = ?
          AND device_id = ?
        `
      )
      .bind(now, now, businessId, userId, deviceId)
      .run();
    return Number(result.meta?.changes ?? 0);
  }

  return revokePushDevicesForUser(db, businessId, userId);
}

export async function revokePushDevicesForUser(db: DB, businessId: string, userId: string) {
  await ensurePushNotificationSchema(db);
  const now = nowSeconds();
  const result = await db
    .prepare(
      `
      UPDATE push_notification_devices
      SET is_active = 0,
          revoked_at = ?,
          updated_at = ?
      WHERE business_id = ?
        AND user_id = ?
        AND is_active = 1
      `
    )
    .bind(now, now, businessId, userId)
    .run();
  await setPushPreference(db, userId, false);
  return Number(result.meta?.changes ?? 0);
}

export async function loadActivePushDevicesForUser(db: DB, businessId: string, userId: string) {
  await ensurePushNotificationSchema(db);
  const rows = await db
    .prepare(
      `
      SELECT *
      FROM push_notification_devices
      WHERE business_id = ?
        AND user_id = ?
        AND is_active = 1
      ORDER BY last_seen_at DESC, updated_at DESC
      `
    )
    .bind(businessId, userId)
    .all<PushNotificationDevice>();
  return rows.results ?? [];
}
