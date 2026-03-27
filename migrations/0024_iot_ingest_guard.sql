CREATE TABLE IF NOT EXISTS iot_ingest_guard (
  guard_key TEXT PRIMARY KEY,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_iot_ingest_guard_expires_at
ON iot_ingest_guard(expires_at);
