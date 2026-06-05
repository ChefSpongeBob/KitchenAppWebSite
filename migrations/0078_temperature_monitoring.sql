CREATE TABLE IF NOT EXISTS temperature_sensor_settings (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  sensor_id INTEGER NOT NULL,
  high_threshold REAL NOT NULL DEFAULT 42,
  low_threshold REAL NOT NULL DEFAULT 32,
  stale_after_minutes INTEGER NOT NULL DEFAULT 15,
  offline_after_minutes INTEGER NOT NULL DEFAULT 45,
  alert_cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  is_alerting_enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  UNIQUE (business_id, sensor_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS temperature_alert_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  sensor_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  temperature REAL,
  threshold REAL,
  reading_ts INTEGER,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  acknowledged_at INTEGER,
  acknowledged_by TEXT,
  recovered_at INTEGER,
  dedupe_key TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_temp_alert_events_business_dedupe
  ON temperature_alert_events(business_id, dedupe_key);

CREATE INDEX IF NOT EXISTS idx_temp_alert_events_business_status
  ON temperature_alert_events(business_id, status, event_type, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_temp_alert_events_business_sensor_status
  ON temperature_alert_events(business_id, sensor_id, status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_temp_settings_business_sensor
  ON temperature_sensor_settings(business_id, sensor_id);
