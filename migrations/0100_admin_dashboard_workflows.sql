CREATE TABLE IF NOT EXISTS announcement_history (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_announcement_history_business_created
ON announcement_history(business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_schedule_availability_requests (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  availability_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  manager_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by_user_id TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_schedule_availability_requests_business_status
ON user_schedule_availability_requests(business_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_availability_requests_business_user
ON user_schedule_availability_requests(business_id, user_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_availability_requests_one_pending
ON user_schedule_availability_requests(business_id, user_id)
WHERE status = 'pending';
