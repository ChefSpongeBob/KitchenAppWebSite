PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS __repair_todos_data AS
SELECT id, title, description, created_by, completed_by, completed_at, created_at, updated_at, business_id
FROM todos;

CREATE TABLE IF NOT EXISTS __repair_todo_assignments_data AS
SELECT todo_id, user_id, assigned_at, business_id
FROM todo_assignments;

CREATE TABLE IF NOT EXISTS __repair_todo_completion_log_data AS
SELECT id, todo_id, title, completed_by, completed_at, business_id
FROM todo_completion_log;

DROP TABLE IF EXISTS todo_assignments;
DROP TABLE IF EXISTS todo_completion_log;
DROP TABLE IF EXISTS todos;

CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_by TEXT,
  completed_by TEXT,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE todo_assignments (
  todo_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  business_id TEXT,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE todo_completion_log (
  id TEXT PRIMARY KEY,
  todo_id TEXT NOT NULL,
  title TEXT NOT NULL,
  completed_by TEXT,
  completed_at INTEGER NOT NULL,
  business_id TEXT,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

INSERT INTO todos (id, title, description, created_by, completed_by, completed_at, created_at, updated_at, business_id)
SELECT id, title, description, created_by, completed_by, completed_at, created_at, updated_at, business_id
FROM __repair_todos_data;

INSERT INTO todo_assignments (todo_id, user_id, assigned_at, business_id)
SELECT todo_id, user_id, assigned_at, business_id
FROM __repair_todo_assignments_data
WHERE todo_id IN (SELECT id FROM todos)
  AND user_id IN (SELECT id FROM users);

INSERT INTO todo_completion_log (id, todo_id, title, completed_by, completed_at, business_id)
SELECT id, todo_id, title, completed_by, completed_at, business_id
FROM __repair_todo_completion_log_data
WHERE todo_id IN (SELECT id FROM todos);

DROP TABLE IF EXISTS __repair_todos_data;
DROP TABLE IF EXISTS __repair_todo_assignments_data;
DROP TABLE IF EXISTS __repair_todo_completion_log_data;

CREATE INDEX IF NOT EXISTS idx_todos_business_id ON todos(business_id);
CREATE INDEX IF NOT EXISTS idx_todos_completed_at ON todos(completed_at);
CREATE INDEX IF NOT EXISTS idx_todos_business_created ON todos(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_todos_business_completed ON todos(business_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_todo_assignments_business_id ON todo_assignments(business_id);
CREATE INDEX IF NOT EXISTS idx_todo_assignments_todo_id ON todo_assignments(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_assignments_user_id ON todo_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_assignments_business_todo ON todo_assignments(business_id, todo_id, user_id);
CREATE INDEX IF NOT EXISTS idx_todo_assignments_business_user ON todo_assignments(business_id, user_id, todo_id);

CREATE INDEX IF NOT EXISTS idx_todo_completion_log_business_id ON todo_completion_log(business_id);
CREATE INDEX IF NOT EXISTS idx_todo_log_completed_at ON todo_completion_log(completed_at);
CREATE INDEX IF NOT EXISTS idx_todo_log_completed_by_completed_at ON todo_completion_log(completed_by, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_todo_completion_log_business_completed ON todo_completion_log(business_id, completed_at DESC);

PRAGMA foreign_keys = ON;
