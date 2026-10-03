-- Separate employee packet completion from employer I-9 verification and lock accepted records.

ALTER TABLE employee_onboarding_packages ADD COLUMN submitted_at INTEGER;
ALTER TABLE employee_onboarding_packages ADD COLUMN returned_at INTEGER;
ALTER TABLE employee_onboarding_packages ADD COLUMN returned_by TEXT;
ALTER TABLE employee_onboarding_packages ADD COLUMN locked_at INTEGER;
ALTER TABLE employee_onboarding_packages ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE employee_onboarding_packages ADD COLUMN supersedes_package_id TEXT;

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_packages_review
ON employee_onboarding_packages(business_id, status, submitted_at, updated_at);

CREATE TABLE IF NOT EXISTS business_hr_settings (
  business_id TEXT PRIMARY KEY,
  retain_i9_document_copies INTEGER NOT NULL DEFAULT 0,
  everify_participant INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS employee_i9_verifications (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  examination_method TEXT NOT NULL DEFAULT 'physical',
  document_selection TEXT NOT NULL DEFAULT '',
  photo_matching_document_present INTEGER NOT NULL DEFAULT 0,
  employee_first_day TEXT NOT NULL DEFAULT '',
  examined_at TEXT NOT NULL DEFAULT '',
  verifier_user_id TEXT,
  verifier_name TEXT NOT NULL DEFAULT '',
  verifier_title TEXT NOT NULL DEFAULT '',
  attested_at INTEGER,
  completed_i9_file_url TEXT NOT NULL DEFAULT '',
  completed_i9_file_name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES employee_onboarding_packages(id) ON DELETE CASCADE,
  FOREIGN KEY (verifier_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_i9_verifications_package
ON employee_i9_verifications(business_id, package_id);

CREATE INDEX IF NOT EXISTS idx_employee_i9_verifications_user
ON employee_i9_verifications(business_id, user_id, status, updated_at);

CREATE TABLE IF NOT EXISTS employee_i9_document_copies (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  verification_id TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL,
  uploaded_by TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (verification_id) REFERENCES employee_i9_verifications(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_i9_document_copies_verification
ON employee_i9_document_copies(business_id, verification_id, uploaded_at);

-- Preserve each accepted structured submission even when a later packet replaces
-- the employee's editable current-record vault entry.
CREATE TABLE IF NOT EXISTS employee_onboarding_sensitive_snapshots (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  onboarding_item_id TEXT NOT NULL,
  source_vault_id TEXT,
  record_scope TEXT NOT NULL,
  record_type TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  payload_iv TEXT NOT NULL,
  payload_tag TEXT NOT NULL DEFAULT '',
  key_version TEXT NOT NULL,
  encryption_algorithm TEXT NOT NULL,
  display_last_four TEXT NOT NULL DEFAULT '',
  accepted_at INTEGER NOT NULL,
  accepted_by TEXT,
  locked_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES employee_onboarding_packages(id) ON DELETE CASCADE,
  FOREIGN KEY (onboarding_item_id) REFERENCES employee_onboarding_items(id) ON DELETE CASCADE,
  FOREIGN KEY (source_vault_id) REFERENCES employee_sensitive_record_vault(id) ON DELETE SET NULL,
  FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_onboarding_sensitive_snapshot_item
ON employee_onboarding_sensitive_snapshots(business_id, onboarding_item_id);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_sensitive_snapshot_package
ON employee_onboarding_sensitive_snapshots(business_id, package_id, user_id);

-- Legal tax and employment-eligibility forms are official uploaded artifacts, not custom web forms.
UPDATE employee_onboarding_template_items
SET item_type = 'document',
    updated_at = unixepoch()
WHERE form_key IN ('federal_i9', 'federal_w4', 'state_withholding');

UPDATE employee_onboarding_items
SET item_type = 'document',
    status = 'pending',
    form_payload = '',
    signed_name = '',
    manager_note = '',
    submitted_at = NULL,
    reviewed_at = NULL,
    reviewed_by = NULL
WHERE form_key IN ('federal_i9', 'federal_w4', 'state_withholding')
  AND package_id IN (
    SELECT id
    FROM employee_onboarding_packages
    WHERE status <> 'approved'
  );

UPDATE employee_onboarding_packages
SET status = 'in_progress',
    completed_at = NULL,
    approved_at = NULL,
    approved_by = NULL,
    locked_at = NULL,
    manager_note = 'Complete the current official employment forms before resubmitting.',
    updated_at = unixepoch()
WHERE status <> 'approved'
  AND id IN (
    SELECT package_id
    FROM employee_onboarding_items
    WHERE form_key IN ('federal_i9', 'federal_w4', 'state_withholding')
  );
