CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
