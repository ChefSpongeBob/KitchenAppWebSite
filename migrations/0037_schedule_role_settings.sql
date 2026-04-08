CREATE TABLE IF NOT EXISTS schedule_role_definitions (
  id TEXT PRIMARY KEY,
  department TEXT NOT NULL,
  role_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (department, role_name)
);

CREATE INDEX IF NOT EXISTS idx_schedule_role_definitions_department
ON schedule_role_definitions(department, sort_order, role_name);

CREATE TABLE IF NOT EXISTS schedule_preferences (
  id TEXT PRIMARY KEY,
  autofill_new_weeks INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
