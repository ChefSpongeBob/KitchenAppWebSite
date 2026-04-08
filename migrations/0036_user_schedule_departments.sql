CREATE TABLE IF NOT EXISTS user_schedule_departments (
  user_id TEXT NOT NULL,
  department TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, department),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_schedule_departments_department
ON user_schedule_departments(department, user_id);

INSERT OR IGNORE INTO user_schedule_departments (user_id, department, updated_at)
SELECT u.id, 'FOH', CAST(strftime('%s', 'now') AS INTEGER)
FROM users u
WHERE COALESCE(u.is_active, 1) = 1;

INSERT OR IGNORE INTO user_schedule_departments (user_id, department, updated_at)
SELECT u.id, 'Sushi', CAST(strftime('%s', 'now') AS INTEGER)
FROM users u
WHERE COALESCE(u.is_active, 1) = 1;

INSERT OR IGNORE INTO user_schedule_departments (user_id, department, updated_at)
SELECT u.id, 'Kitchen', CAST(strftime('%s', 'now') AS INTEGER)
FROM users u
WHERE COALESCE(u.is_active, 1) = 1;
