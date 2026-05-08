CREATE TABLE IF NOT EXISTS employee_onboarding_packages (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  payroll_classification TEXT NOT NULL DEFAULT 'employee',
  sent_at INTEGER NOT NULL,
  completed_at INTEGER,
  approved_at INTEGER,
  approved_by TEXT,
  created_by TEXT,
  updated_at INTEGER NOT NULL,
  manager_note TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_packages_user
ON employee_onboarding_packages(business_id, user_id, status, updated_at);

CREATE TABLE IF NOT EXISTS employee_onboarding_items (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  business_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'acknowledgement',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  file_url TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  signed_name TEXT NOT NULL DEFAULT '',
  manager_note TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  submitted_at INTEGER,
  reviewed_at INTEGER,
  reviewed_by TEXT,
  FOREIGN KEY (package_id) REFERENCES employee_onboarding_packages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_items_package
ON employee_onboarding_items(package_id, sort_order, status);
