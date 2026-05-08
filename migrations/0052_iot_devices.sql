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
);

CREATE INDEX IF NOT EXISTS idx_iot_devices_business_active
ON iot_devices(business_id, is_active, device_type);

CREATE INDEX IF NOT EXISTS idx_iot_devices_external
ON iot_devices(external_device_id, is_active);
