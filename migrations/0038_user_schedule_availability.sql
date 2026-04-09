CREATE TABLE IF NOT EXISTS user_schedule_availability (
  user_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  is_available INTEGER NOT NULL DEFAULT 0,
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, weekday),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_schedule_availability_user
ON user_schedule_availability(user_id, weekday);
