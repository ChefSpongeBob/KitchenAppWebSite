-- Scheduling completion tools:
-- - break minutes on assigned shifts
-- - open/unassigned shift pool
-- - open shift requests
-- - reusable schedule templates
-- - labor targets for schedule budget visibility

ALTER TABLE schedule_shifts ADD COLUMN break_minutes INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS schedule_open_shifts (
  id TEXT PRIMARY KEY,
  week_id TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  department TEXT NOT NULL,
  role TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL,
  end_label TEXT NOT NULL DEFAULT '',
  break_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedule_open_shifts_week_date
ON schedule_open_shifts(business_id, week_id, shift_date, start_time, sort_order);

CREATE TABLE IF NOT EXISTS schedule_open_shift_requests (
  id TEXT PRIMARY KEY,
  open_shift_id TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  manager_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by_user_id TEXT,
  business_id TEXT NOT NULL DEFAULT '',
  UNIQUE (open_shift_id, requested_by_user_id),
  FOREIGN KEY (open_shift_id) REFERENCES schedule_open_shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_schedule_open_shift_requests_status
ON schedule_open_shift_requests(business_id, status, updated_at);

CREATE TABLE IF NOT EXISTS schedule_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  labor_target_percent REAL NOT NULL DEFAULT 0,
  projected_sales REAL NOT NULL DEFAULT 0,
  average_hourly_rate REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  business_id TEXT NOT NULL DEFAULT '',
  UNIQUE (business_id, name),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS schedule_template_shifts (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  user_id TEXT,
  is_open INTEGER NOT NULL DEFAULT 0,
  department TEXT NOT NULL,
  role TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL,
  end_label TEXT NOT NULL DEFAULT '',
  break_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  business_id TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (template_id) REFERENCES schedule_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_schedule_template_shifts_template
ON schedule_template_shifts(template_id, weekday, sort_order);

CREATE TABLE IF NOT EXISTS schedule_labor_targets (
  business_id TEXT NOT NULL,
  day_date TEXT NOT NULL,
  week_start TEXT NOT NULL,
  projected_sales REAL NOT NULL DEFAULT 0,
  target_labor_percent REAL NOT NULL DEFAULT 0,
  average_hourly_rate REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (business_id, day_date),
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_schedule_labor_targets_week
ON schedule_labor_targets(business_id, week_start, day_date);
