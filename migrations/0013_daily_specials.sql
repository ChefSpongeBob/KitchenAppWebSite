CREATE TABLE IF NOT EXISTS daily_specials (
  category TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS daily_specials_editors (
  user_id TEXT PRIMARY KEY,
  granted_by TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);
