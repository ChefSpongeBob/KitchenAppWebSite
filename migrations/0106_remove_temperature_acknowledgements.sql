CREATE TABLE temperature_alert_events_without_acknowledgements (
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
  recovered_at INTEGER,
  notification_ready_at INTEGER,
  dedupe_key TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

INSERT INTO temperature_alert_events_without_acknowledgements (
  id,
  business_id,
  sensor_id,
  event_type,
  status,
  temperature,
  threshold,
  reading_ts,
  first_seen_at,
  last_seen_at,
  recovered_at,
  notification_ready_at,
  dedupe_key,
  metadata_json
)
SELECT
  id,
  business_id,
  sensor_id,
  event_type,
  CASE WHEN status = 'recovered' THEN 'recovered' ELSE 'active' END,
  temperature,
  threshold,
  reading_ts,
  first_seen_at,
  last_seen_at,
  recovered_at,
  notification_ready_at,
  dedupe_key,
  metadata_json
FROM temperature_alert_events;

DROP TABLE temperature_alert_events;
ALTER TABLE temperature_alert_events_without_acknowledgements RENAME TO temperature_alert_events;

CREATE UNIQUE INDEX idx_temp_alert_events_business_dedupe
  ON temperature_alert_events(business_id, dedupe_key);

CREATE INDEX idx_temp_alert_events_business_status
  ON temperature_alert_events(business_id, status, event_type, last_seen_at DESC);

CREATE INDEX idx_temp_alert_events_business_sensor_status
  ON temperature_alert_events(business_id, sensor_id, status, last_seen_at DESC);

CREATE INDEX idx_temperature_alert_events_business_seen
  ON temperature_alert_events(business_id, last_seen_at DESC);

CREATE INDEX idx_temp_alert_events_notification_ready
  ON temperature_alert_events(business_id, status, event_type, notification_ready_at);
