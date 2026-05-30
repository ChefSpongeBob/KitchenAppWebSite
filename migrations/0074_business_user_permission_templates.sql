-- ToastTab-style permission templates for business memberships.
-- role controls authority; permission_template records the restaurant job-style profile.

ALTER TABLE business_users ADD COLUMN permission_template TEXT NOT NULL DEFAULT 'staff';

UPDATE business_users
SET permission_template = CASE
  WHEN role = 'owner' THEN 'owner'
  WHEN role = 'admin' THEN 'general_manager'
  WHEN role = 'manager' THEN 'general_manager'
  WHEN role IN ('general_manager', 'foh_manager', 'boh_manager', 'hourly_manager', 'shift_lead', 'consultant', 'contractor') THEN role
  ELSE 'staff'
END
WHERE permission_template IS NULL OR permission_template = '' OR permission_template = 'staff';

CREATE INDEX IF NOT EXISTS idx_business_users_permission_template
ON business_users(business_id, permission_template, is_active);
