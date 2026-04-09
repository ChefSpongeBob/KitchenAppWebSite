CREATE TABLE IF NOT EXISTS employee_profiles (
  user_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL DEFAULT '',
  birthday TEXT NOT NULL DEFAULT '',
  address_line_1 TEXT NOT NULL DEFAULT '',
  address_line_2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  emergency_contact_name TEXT NOT NULL DEFAULT '',
  emergency_contact_phone TEXT NOT NULL DEFAULT '',
  emergency_contact_relationship TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_by TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_profiles_updated_at
ON employee_profiles(updated_at);
