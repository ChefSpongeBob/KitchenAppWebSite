ALTER TABLE user_preferences ADD COLUMN push_updates INTEGER NOT NULL DEFAULT 0;

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
  revoked_at INTEGER,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_devices_business_user_token
  ON push_notification_devices(business_id, user_id, token_hash);

CREATE INDEX IF NOT EXISTS idx_push_devices_business_active_user
  ON push_notification_devices(business_id, is_active, user_id);

CREATE INDEX IF NOT EXISTS idx_push_devices_user_active
  ON push_notification_devices(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_push_devices_token_hash
  ON push_notification_devices(token_hash);
