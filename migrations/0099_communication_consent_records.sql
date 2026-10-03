ALTER TABLE user_preferences ADD COLUMN email_updates_consented_at INTEGER;
ALTER TABLE user_preferences ADD COLUMN sms_updates_consented_at INTEGER;
ALTER TABLE user_preferences ADD COLUMN communication_consent_version TEXT;
ALTER TABLE user_preferences ADD COLUMN communication_consent_source TEXT;

CREATE TABLE IF NOT EXISTS communication_consent_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  business_id TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
  disclosure_version TEXT NOT NULL,
  source TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_communication_consent_user_channel
  ON communication_consent_events(user_id, channel, recorded_at DESC);
