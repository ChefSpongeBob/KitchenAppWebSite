-- Materialize the former code-level schedule defaults for existing businesses,
-- then let every tenant own and edit its schedule structure independently.

INSERT OR IGNORE INTO schedule_departments (
  id, name, sort_order, is_active, created_at, updated_at, business_id
)
SELECT 'legacy-dept-foh:' || id, 'FOH', 0, 1, unixepoch(), unixepoch(), id
FROM businesses;

INSERT OR IGNORE INTO schedule_departments (
  id, name, sort_order, is_active, created_at, updated_at, business_id
)
SELECT 'legacy-dept-boh:' || id, 'BOH', 1, 1, unixepoch(), unixepoch(), id
FROM businesses;

INSERT OR IGNORE INTO schedule_departments (
  id, name, sort_order, is_active, created_at, updated_at, business_id
)
SELECT 'legacy-dept-management:' || id, 'Management', 2, 1, unixepoch(), unixepoch(), id
FROM businesses;

INSERT OR IGNORE INTO schedule_role_definitions (
  id, department, role_name, sort_order, is_active, created_at, updated_at, business_id
)
SELECT 'legacy-role-server:' || id, 'FOH', 'Server', 0, 1, unixepoch(), unixepoch(), id FROM businesses;
INSERT OR IGNORE INTO schedule_role_definitions (
  id, department, role_name, sort_order, is_active, created_at, updated_at, business_id
)
SELECT 'legacy-role-host:' || id, 'FOH', 'Host', 1, 1, unixepoch(), unixepoch(), id FROM businesses;
INSERT OR IGNORE INTO schedule_role_definitions (
  id, department, role_name, sort_order, is_active, created_at, updated_at, business_id
)
SELECT 'legacy-role-runner:' || id, 'FOH', 'Runner', 2, 1, unixepoch(), unixepoch(), id FROM businesses;

INSERT OR IGNORE INTO schedule_role_definitions (
  id, department, role_name, sort_order, is_active, created_at, updated_at, business_id
)
SELECT 'legacy-role-cook:' || id, 'BOH', 'Cook', 0, 1, unixepoch(), unixepoch(), id FROM businesses;
INSERT OR IGNORE INTO schedule_role_definitions (
  id, department, role_name, sort_order, is_active, created_at, updated_at, business_id
)
SELECT 'legacy-role-prep:' || id, 'BOH', 'Prep', 1, 1, unixepoch(), unixepoch(), id FROM businesses;
INSERT OR IGNORE INTO schedule_role_definitions (
  id, department, role_name, sort_order, is_active, created_at, updated_at, business_id
)
SELECT 'legacy-role-dish:' || id, 'BOH', 'Dish', 2, 1, unixepoch(), unixepoch(), id FROM businesses;

INSERT OR IGNORE INTO schedule_role_definitions (
  id, department, role_name, sort_order, is_active, created_at, updated_at, business_id
)
SELECT 'legacy-role-boh-manager:' || id, 'Management', 'BOH MGR', 0, 1, unixepoch(), unixepoch(), id FROM businesses;
INSERT OR IGNORE INTO schedule_role_definitions (
  id, department, role_name, sort_order, is_active, created_at, updated_at, business_id
)
SELECT 'legacy-role-foh-manager:' || id, 'Management', 'FOH MGR', 1, 1, unixepoch(), unixepoch(), id FROM businesses;
INSERT OR IGNORE INTO schedule_role_definitions (
  id, department, role_name, sort_order, is_active, created_at, updated_at, business_id
)
SELECT 'legacy-role-general-manager:' || id, 'Management', 'GM', 2, 1, unixepoch(), unixepoch(), id FROM businesses;

CREATE TABLE IF NOT EXISTS user_schedule_role_settings (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  restrict_to_selected INTEGER NOT NULL DEFAULT 0 CHECK (restrict_to_selected IN (0, 1)),
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (business_id, user_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_schedule_roles (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_definition_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, user_id, role_definition_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_definition_id) REFERENCES schedule_role_definitions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_schedule_roles_user
ON user_schedule_roles(business_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_schedule_roles_role
ON user_schedule_roles(business_id, role_definition_id);
