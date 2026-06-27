-- These tables now store only tenant-specific schedule customizations.
-- Built-in defaults live in code, so every persisted row must belong to a
-- concrete business.

PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS schedule_departments_business_required (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT NOT NULL DEFAULT '',
  UNIQUE (business_id, name)
);

INSERT OR IGNORE INTO schedule_departments_business_required (
  id,
  name,
  sort_order,
  is_active,
  created_at,
  updated_at,
  business_id
)
SELECT
  id,
  name,
  sort_order,
  is_active,
  created_at,
  updated_at,
  business_id
FROM schedule_departments
WHERE business_id IS NOT NULL
  AND trim(business_id) <> '';

DROP TABLE schedule_departments;
ALTER TABLE schedule_departments_business_required RENAME TO schedule_departments;

CREATE INDEX IF NOT EXISTS idx_schedule_departments_order
ON schedule_departments(sort_order, name);

CREATE INDEX IF NOT EXISTS idx_schedule_departments_business_active_order
ON schedule_departments(business_id, is_active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_schedule_departments_business_name
ON schedule_departments(business_id, name);

CREATE TABLE IF NOT EXISTS schedule_role_definitions_business_required (
  id TEXT PRIMARY KEY,
  department TEXT NOT NULL,
  role_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT NOT NULL DEFAULT '',
  UNIQUE (business_id, department, role_name)
);

INSERT OR IGNORE INTO schedule_role_definitions_business_required (
  id,
  department,
  role_name,
  sort_order,
  is_active,
  created_at,
  updated_at,
  business_id
)
SELECT
  id,
  department,
  role_name,
  sort_order,
  is_active,
  created_at,
  updated_at,
  business_id
FROM schedule_role_definitions
WHERE business_id IS NOT NULL
  AND trim(business_id) <> '';

DROP TABLE schedule_role_definitions;
ALTER TABLE schedule_role_definitions_business_required RENAME TO schedule_role_definitions;

CREATE INDEX IF NOT EXISTS idx_schedule_role_definitions_department
ON schedule_role_definitions(department, sort_order, role_name);

CREATE INDEX IF NOT EXISTS idx_schedule_role_definitions_business_active_department
ON schedule_role_definitions(business_id, is_active, department, sort_order, role_name);

CREATE INDEX IF NOT EXISTS idx_schedule_role_definitions_business_department_role
ON schedule_role_definitions(business_id, department, role_name);

PRAGMA foreign_keys=ON;
