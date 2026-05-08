ALTER TABLE employee_onboarding_items ADD COLUMN source_file_url TEXT NOT NULL DEFAULT '';
ALTER TABLE employee_onboarding_items ADD COLUMN source_file_name TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS employee_onboarding_template_items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL DEFAULT '',
  item_type TEXT NOT NULL DEFAULT 'acknowledgement',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_file_url TEXT NOT NULL DEFAULT '',
  source_file_name TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_template_business
ON employee_onboarding_template_items(business_id, is_active, sort_order);
