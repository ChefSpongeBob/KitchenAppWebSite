-- 7shifts-style invite structure:
-- access type controls authority, permission template captures restaurant manager profile,
-- departments remain operational schedule areas.

ALTER TABLE business_invites ADD COLUMN permission_template TEXT NOT NULL DEFAULT 'staff';
ALTER TABLE business_invites ADD COLUMN schedule_departments_json TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_business_invites_access_template
ON business_invites(business_id, role, permission_template, created_at);
