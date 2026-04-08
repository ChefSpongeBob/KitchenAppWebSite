CREATE TABLE IF NOT EXISTS schedule_shift_offers (
  id TEXT PRIMARY KEY,
  shift_id TEXT NOT NULL UNIQUE,
  offered_by_user_id TEXT NOT NULL,
  target_user_id TEXT,
  requested_by_user_id TEXT,
  manager_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (shift_id) REFERENCES schedule_shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (offered_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_schedule_shift_offers_week_request
ON schedule_shift_offers(shift_id, target_user_id, requested_by_user_id, updated_at);
