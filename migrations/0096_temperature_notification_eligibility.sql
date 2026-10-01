ALTER TABLE temperature_alert_events ADD COLUMN notification_ready_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_temp_alert_events_notification_ready
  ON temperature_alert_events(business_id, status, event_type, notification_ready_at);
