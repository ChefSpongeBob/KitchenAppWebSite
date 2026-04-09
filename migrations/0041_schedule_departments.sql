CREATE TABLE IF NOT EXISTS schedule_departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schedule_departments_order
ON schedule_departments(sort_order, name);

INSERT OR IGNORE INTO schedule_departments (
  id, name, sort_order, is_active, created_at, updated_at
)
VALUES
  ('schedule-department-foh', 'FOH', 0, 1, strftime('%s','now'), strftime('%s','now')),
  ('schedule-department-sushi', 'Sushi', 1, 1, strftime('%s','now'), strftime('%s','now')),
  ('schedule-department-kitchen', 'Kitchen', 2, 1, strftime('%s','now'), strftime('%s','now'));
