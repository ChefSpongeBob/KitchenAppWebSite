PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS schedule_departments_business_scoped (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT,
  UNIQUE (business_id, name)
);

INSERT OR IGNORE INTO schedule_departments_business_scoped (
  id, name, sort_order, is_active, created_at, updated_at, business_id
)
SELECT id, name, sort_order, is_active, created_at, updated_at, business_id
FROM schedule_departments;

DROP TABLE schedule_departments;
ALTER TABLE schedule_departments_business_scoped RENAME TO schedule_departments;

CREATE INDEX IF NOT EXISTS idx_schedule_departments_order
ON schedule_departments(sort_order, name);

CREATE INDEX IF NOT EXISTS idx_schedule_departments_business_active_order
ON schedule_departments(business_id, is_active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_schedule_departments_business_name
ON schedule_departments(business_id, name);

CREATE TABLE IF NOT EXISTS schedule_role_definitions_business_scoped (
  id TEXT PRIMARY KEY,
  department TEXT NOT NULL,
  role_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT,
  UNIQUE (business_id, department, role_name)
);

INSERT OR IGNORE INTO schedule_role_definitions_business_scoped (
  id, department, role_name, sort_order, is_active, created_at, updated_at, business_id
)
SELECT id, department, role_name, sort_order, is_active, created_at, updated_at, business_id
FROM schedule_role_definitions;

DROP TABLE schedule_role_definitions;
ALTER TABLE schedule_role_definitions_business_scoped RENAME TO schedule_role_definitions;

CREATE INDEX IF NOT EXISTS idx_schedule_role_definitions_department
ON schedule_role_definitions(department, sort_order, role_name);

CREATE INDEX IF NOT EXISTS idx_schedule_role_definitions_business_active_department
ON schedule_role_definitions(business_id, is_active, department, sort_order, role_name);

CREATE INDEX IF NOT EXISTS idx_schedule_role_definitions_business_department_role
ON schedule_role_definitions(business_id, department, role_name);

CREATE TABLE IF NOT EXISTS user_schedule_departments_business_scoped (
  business_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL,
  department TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, user_id, department),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO user_schedule_departments_business_scoped (
  business_id, user_id, department, updated_at
)
SELECT COALESCE(business_id, ''), user_id, department, updated_at
FROM user_schedule_departments;

DROP TABLE user_schedule_departments;
ALTER TABLE user_schedule_departments_business_scoped RENAME TO user_schedule_departments;

CREATE INDEX IF NOT EXISTS idx_user_schedule_departments_department
ON user_schedule_departments(department, user_id);

CREATE INDEX IF NOT EXISTS idx_user_schedule_departments_business_user
ON user_schedule_departments(business_id, user_id, department);

CREATE TABLE IF NOT EXISTS user_schedule_availability_business_scoped (
  business_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  is_available INTEGER NOT NULL DEFAULT 0,
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, user_id, weekday),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO user_schedule_availability_business_scoped (
  business_id, user_id, weekday, is_available, start_time, end_time, updated_at
)
SELECT COALESCE(business_id, ''), user_id, weekday, is_available, start_time, end_time, updated_at
FROM user_schedule_availability;

DROP TABLE user_schedule_availability;
ALTER TABLE user_schedule_availability_business_scoped RENAME TO user_schedule_availability;

CREATE INDEX IF NOT EXISTS idx_user_schedule_availability_user
ON user_schedule_availability(user_id, weekday);

CREATE INDEX IF NOT EXISTS idx_user_schedule_availability_business_user
ON user_schedule_availability(business_id, user_id, weekday);

PRAGMA foreign_keys=ON;
