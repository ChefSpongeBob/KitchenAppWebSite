type D1 = App.Platform['env']['DB'];

let lastGuardCleanupAt = 0;

export async function ensureIoTIngestGuardSchema(db: D1) {
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
