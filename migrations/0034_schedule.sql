CREATE TABLE IF NOT EXISTS schedule_weeks (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at INTEGER,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS schedule_shifts (
  id TEXT PRIMARY KEY,
  week_id TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  department TEXT NOT NULL,
  role TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL,
  end_label TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedule_weeks_week_start
ON schedule_weeks(week_start, status);

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_week_date
ON schedule_shifts(week_id, shift_date, start_time, sort_order);

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_user_date
ON schedule_shifts(user_id, shift_date, start_time);
