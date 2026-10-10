-- Tenant-owned job positions with reusable permission defaults.

CREATE TABLE IF NOT EXISTS business_positions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  account_type TEXT NOT NULL CHECK (account_type IN ('manager', 'staff', 'external')),
  base_template TEXT NOT NULL DEFAULT 'staff',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (business_id, name),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS business_position_permissions (
  business_id TEXT NOT NULL,
  position_id TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, position_id, permission_key),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (position_id) REFERENCES business_positions(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE business_users ADD COLUMN position_id TEXT;
ALTER TABLE business_invites ADD COLUMN position_id TEXT;

CREATE INDEX IF NOT EXISTS idx_business_positions_business_active
ON business_positions(business_id, is_active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_business_position_permissions_business_position
ON business_position_permissions(business_id, position_id, permission_key);

CREATE INDEX IF NOT EXISTS idx_business_users_business_position
ON business_users(business_id, position_id, is_active);

CREATE INDEX IF NOT EXISTS idx_business_invites_business_position
ON business_invites(business_id, position_id, created_at);

-- Preserve current access by turning each in-use legacy template into a tenant position.
INSERT OR IGNORE INTO business_positions (
  id, business_id, name, description, account_type, base_template,
  is_active, sort_order, created_by, created_at, updated_at
)
SELECT
  bu.business_id || ':position:' || COALESCE(NULLIF(bu.permission_template, ''), bu.role, 'staff'),
  bu.business_id,
  CASE COALESCE(NULLIF(bu.permission_template, ''), bu.role, 'staff')
    WHEN 'general_manager' THEN 'Manager'
    WHEN 'manager' THEN 'Legacy Manager'
    WHEN 'admin' THEN 'Administrator'
    WHEN 'foh_manager' THEN 'FOH Manager'
    WHEN 'boh_manager' THEN 'BOH Manager'
    WHEN 'hourly_manager' THEN 'Hourly Manager'
    WHEN 'shift_lead' THEN 'Shift Lead'
    WHEN 'hr_manager' THEN 'HR Manager'
    WHEN 'hr_consultant' THEN 'HR Consultant'
    WHEN 'consultant' THEN 'Consultant'
    WHEN 'contractor' THEN 'External'
    WHEN 'external' THEN 'External Access'
    WHEN 'employee' THEN 'Employee'
    WHEN 'user' THEN 'User'
    WHEN 'staff' THEN 'Team Member'
    ELSE COALESCE(NULLIF(bu.permission_template, ''), bu.role, 'staff')
  END,
  '',
  CASE
    WHEN COALESCE(NULLIF(bu.permission_template, ''), bu.role, 'staff') IN (
      'manager', 'admin', 'general_manager', 'foh_manager', 'boh_manager', 'hourly_manager', 'hr_manager'
    ) THEN 'manager'
    WHEN COALESCE(NULLIF(bu.permission_template, ''), bu.role, 'staff') IN (
      'external', 'hr_consultant', 'consultant', 'contractor'
    ) THEN 'external'
    ELSE 'staff'
  END,
  COALESCE(NULLIF(bu.permission_template, ''), bu.role, 'staff'),
  1,
  0,
  NULL,
  COALESCE(bu.created_at, unixepoch()),
  unixepoch()
FROM business_users bu
WHERE COALESCE(bu.role, 'staff') <> 'owner';

UPDATE business_users
SET position_id = business_id || ':position:' || COALESCE(NULLIF(permission_template, ''), role, 'staff')
WHERE COALESCE(role, 'staff') <> 'owner'
  AND position_id IS NULL;

INSERT OR IGNORE INTO business_positions (
  id, business_id, name, description, account_type, base_template,
  is_active, sort_order, created_by, created_at, updated_at
)
SELECT
  bi.business_id || ':position:' || COALESCE(NULLIF(bi.permission_template, ''), bi.role, 'staff'),
  bi.business_id,
  CASE COALESCE(NULLIF(bi.permission_template, ''), bi.role, 'staff')
    WHEN 'general_manager' THEN 'Manager'
    WHEN 'manager' THEN 'Legacy Manager'
    WHEN 'admin' THEN 'Administrator'
    WHEN 'foh_manager' THEN 'FOH Manager'
    WHEN 'boh_manager' THEN 'BOH Manager'
    WHEN 'hourly_manager' THEN 'Hourly Manager'
    WHEN 'shift_lead' THEN 'Shift Lead'
    WHEN 'hr_manager' THEN 'HR Manager'
    WHEN 'hr_consultant' THEN 'HR Consultant'
    WHEN 'consultant' THEN 'Consultant'
    WHEN 'contractor' THEN 'External'
    WHEN 'external' THEN 'External Access'
    WHEN 'employee' THEN 'Employee'
    WHEN 'user' THEN 'User'
    WHEN 'staff' THEN 'Team Member'
    ELSE COALESCE(NULLIF(bi.permission_template, ''), bi.role, 'staff')
  END,
  '',
  CASE
    WHEN COALESCE(NULLIF(bi.permission_template, ''), bi.role, 'staff') IN (
      'manager', 'admin', 'general_manager', 'foh_manager', 'boh_manager', 'hourly_manager', 'hr_manager'
    ) THEN 'manager'
    WHEN COALESCE(NULLIF(bi.permission_template, ''), bi.role, 'staff') IN (
      'external', 'hr_consultant', 'consultant', 'contractor'
    ) THEN 'external'
    ELSE 'staff'
  END,
  COALESCE(NULLIF(bi.permission_template, ''), bi.role, 'staff'),
  1,
  0,
  bi.invited_by,
  COALESCE(bi.created_at, unixepoch()),
  unixepoch()
FROM business_invites bi
WHERE COALESCE(bi.role, 'staff') <> 'owner';

UPDATE business_invites
SET position_id = business_id || ':position:' || COALESCE(NULLIF(permission_template, ''), role, 'staff')
WHERE COALESCE(role, 'staff') <> 'owner'
  AND position_id IS NULL;
