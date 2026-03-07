-- Todo assignments mapped to users.
-- Keeps schema migration safe without mutating existing todos table.

CREATE TABLE IF NOT EXISTS todo_assignments (
  todo_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_todo_assignments_user_id
  ON todo_assignments(user_id);
