import { dev } from '$app/environment';

type D1 = App.Platform['env']['DB'];

let lastGuardCleanupAt = 0;
let iotDeviceSchemaEnsured = false;
let iotIngestGuardSchemaEnsured = false;

export type IoTDeviceType = 'sensor' | 'camera';

export type IoTDeviceRecord = {
  id: string;
  businessId: string;
  deviceType: IoTDeviceType;
  externalDeviceId: string;
  displayName: string;
  keyPrefix: string;
  isActive: number;
  lastSeenAt: number | null;
  revokedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type IoTDeviceRow = {
  id: string;
  business_id: string;
  device_type: IoTDeviceType;
  external_device_id: string;
  display_name: string;
  key_prefix: string;
  is_active: number;
  last_seen_at: number | null;
  revoked_at: number | null;
  created_at: number;
  updated_at: number;
};

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function mapIoTDevice(row: IoTDeviceRow): IoTDeviceRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    deviceType: row.device_type,
    externalDeviceId: row.external_device_id,
    displayName: row.display_name,
    keyPrefix: row.key_prefix,
    isActive: row.is_active,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeDeviceType(value: string): IoTDeviceType {
  return value === 'camera' ? 'camera' : 'sensor';
}

function generateDeviceSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `sknns_iot_${toHex(bytes)}`;
}

export async function ensureIoTDeviceSchema(db: D1) {
  if (!dev) {
    iotDeviceSchemaEnsured = true;
    return;
  }
  if (iotDeviceSchemaEnsured) return;

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS iot_devices (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        device_type TEXT NOT NULL,
        external_device_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        last_seen_at INTEGER,
        revoked_at INTEGER,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (business_id, external_device_id),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_iot_devices_business_active
      ON iot_devices(business_id, is_active, device_type)
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_iot_devices_external
      ON iot_devices(external_device_id, is_active)
      `
    )
    .run();

  iotDeviceSchemaEnsured = true;
}

export async function loadIoTDevices(db: D1, businessId: string) {
  await ensureIoTDeviceSchema(db);
  const rows = await db
    .prepare(
      `
      SELECT
        id,
        business_id,
        device_type,
        external_device_id,
        display_name,
        key_prefix,
        is_active,
        last_seen_at,
        revoked_at,
        created_at,
        updated_at
      FROM iot_devices
      WHERE business_id = ?
      ORDER BY is_active DESC, device_type ASC, display_name ASC
      `
    )
    .bind(businessId)
    .all<IoTDeviceRow>();
  return (rows.results ?? []).map(mapIoTDevice);
}

export async function provisionIoTDevice(
  db: D1,
  options: {
    businessId: string;
    deviceType: IoTDeviceType;
    externalDeviceId: string;
    displayName: string;
    createdBy?: string | null;
  }
) {
  await ensureIoTDeviceSchema(db);

  const now = Math.floor(Date.now() / 1000);
  const deviceKey = generateDeviceSecret();
  const keyHash = await sha256Hex(deviceKey);
  const keyPrefix = deviceKey.slice(0, 18);
  const id = crypto.randomUUID();
  const deviceType = normalizeDeviceType(options.deviceType);

  await db
    .prepare(
      `
      INSERT INTO iot_devices (
        id,
        business_id,
        device_type,
        external_device_id,
        display_name,
        key_hash,
        key_prefix,
        is_active,
        last_seen_at,
        revoked_at,
        created_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, NULL, ?, ?, ?)
      ON CONFLICT(business_id, external_device_id) DO UPDATE SET
        device_type = excluded.device_type,
        display_name = excluded.display_name,
        key_hash = excluded.key_hash,
        key_prefix = excluded.key_prefix,
        is_active = 1,
        revoked_at = NULL,
        created_by = excluded.created_by,
        updated_at = excluded.updated_at
      `
    )
    .bind(
      id,
      options.businessId,
      deviceType,
      options.externalDeviceId,
      options.displayName,
      keyHash,
      keyPrefix,
      options.createdBy ?? null,
      now,
      now
    )
    .run();

  return { deviceKey, keyPrefix };
}

export async function revokeIoTDevice(db: D1, businessId: string, deviceId: string) {
  await ensureIoTDeviceSchema(db);
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      UPDATE iot_devices
      SET is_active = 0,
          revoked_at = ?,
          updated_at = ?
      WHERE id = ? AND business_id = ?
      `
    )
    .bind(now, now, deviceId, businessId)
    .run();
}

export async function authenticateIoTDevice(
  db: D1,
  request: Request,
  expectedType: IoTDeviceType
) {
  await ensureIoTDeviceSchema(db);

  const externalDeviceId =
    request.headers.get('x-device-id')?.trim() ||
    request.headers.get('x-iot-device-id')?.trim() ||
    '';
  const deviceKey =
    request.headers.get('x-device-key')?.trim() ||
    request.headers.get('x-iot-device-key')?.trim() ||
    '';
  const requestedBusinessId = request.headers.get('x-business-id')?.trim() || '';

  if (!externalDeviceId || !deviceKey) return null;

  const rows = await db
    .prepare(
      `
      SELECT
        id,
        business_id,
        device_type,
        external_device_id,
        display_name,
        key_hash,
        key_prefix,
        is_active,
        last_seen_at,
        revoked_at,
        created_at,
        updated_at
      FROM iot_devices
      WHERE external_device_id = ?
        AND device_type = ?
        AND is_active = 1
        AND revoked_at IS NULL
      `
    )
    .bind(externalDeviceId, expectedType)
    .all<IoTDeviceRow & { key_hash: string }>();

  const incomingHash = await sha256Hex(deviceKey);
  const row = (rows.results ?? []).find((candidate) => {
    if (requestedBusinessId && candidate.business_id !== requestedBusinessId) return false;
    return timingSafeEqual(incomingHash, candidate.key_hash);
  });

  if (!row) return null;

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      UPDATE iot_devices
      SET last_seen_at = ?,
          updated_at = ?
      WHERE id = ?
      `
    )
    .bind(now, now, row.id)
    .run();

  return mapIoTDevice(row);
}

export async function ensureIoTIngestGuardSchema(db: D1) {
  if (!dev) {
    iotIngestGuardSchemaEnsured = true;
    return;
  }
  if (iotIngestGuardSchemaEnsured) return;

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS iot_ingest_guard (
        guard_key TEXT PRIMARY KEY,
        last_seen_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_iot_ingest_guard_expires_at
      ON iot_ingest_guard(expires_at)
      `
    )
    .run();

  iotIngestGuardSchemaEnsured = true;
}

export async function cleanupExpiredIoTIngestGuards(
  db: D1,
  now = Math.floor(Date.now() / 1000)
) {
  if (now - lastGuardCleanupAt < 1800) return;
  lastGuardCleanupAt = now;

  await db
    .prepare(`DELETE FROM iot_ingest_guard WHERE expires_at < ?`)
    .bind(now)
    .run();
}

export async function allowIoTIngest(
  db: D1,
  guardKey: string,
  minIntervalSeconds: number,
  ttlSeconds = 86400,
  now = Math.floor(Date.now() / 1000)
) {
  await ensureIoTIngestGuardSchema(db);
  await cleanupExpiredIoTIngestGuards(db, now);

  const existing = await db
    .prepare(
      `
      SELECT last_seen_at
      FROM iot_ingest_guard
      WHERE guard_key = ?
      LIMIT 1
      `
    )
    .bind(guardKey)
    .first<{ last_seen_at: number }>();

  if (existing && now - existing.last_seen_at < minIntervalSeconds) {
    return false;
  }

  await db
    .prepare(
      `
      INSERT INTO iot_ingest_guard (guard_key, last_seen_at, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(guard_key) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        expires_at = excluded.expires_at
      `
    )
    .bind(guardKey, now, now + ttlSeconds)
    .run();

  return true;
}
