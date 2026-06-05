CREATE TABLE IF NOT EXISTS operational_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  actor_user_id TEXT,
  target_user_id TEXT,
  subject_type TEXT NOT NULL DEFAULT '',
  subject_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  dedupe_key TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'processing', 'delivered', 'failed', 'skipped')),
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER,
  last_attempt_at INTEGER,
  delivered_at INTEGER,
  failed_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_operational_events_business_dedupe
ON operational_events(business_id, dedupe_key)
WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_events_business_status_next
ON operational_events(business_id, delivery_status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS idx_operational_events_business_type_created
ON operational_events(business_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_events_business_category_created
ON operational_events(business_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_events_target_created
ON operational_events(business_id, target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_events_retention
ON operational_events(delivery_status, expires_at, created_at);

CREATE TABLE IF NOT EXISTS operational_event_delivery_attempts (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'internal')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id TEXT,
  error_message TEXT,
  attempted_at INTEGER NOT NULL,
  FOREIGN KEY (event_id) REFERENCES operational_events(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_operational_event_attempts_event
ON operational_event_delivery_attempts(event_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_event_attempts_business_status
ON operational_event_delivery_attempts(business_id, status, attempted_at DESC);
