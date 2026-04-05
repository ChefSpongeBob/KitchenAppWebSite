CREATE TABLE IF NOT EXISTS employee_spotlight (
  id TEXT PRIMARY KEY,
  employee_name TEXT NOT NULL DEFAULT '',
  shoutout TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
