-- Invite employment context plus encryption-ready sensitive record placeholders.
-- Vault records are intentionally encrypted-payload only; no plaintext tax, bank, or identity values.

ALTER TABLE business_invites ADD COLUMN employment_type TEXT NOT NULL DEFAULT 'employee';
ALTER TABLE business_invites ADD COLUMN job_title TEXT NOT NULL DEFAULT '';
ALTER TABLE business_invites ADD COLUMN department TEXT NOT NULL DEFAULT '';
ALTER TABLE business_invites ADD COLUMN primary_schedule_department TEXT NOT NULL DEFAULT '';
ALTER TABLE business_invites ADD COLUMN start_date TEXT NOT NULL DEFAULT '';
ALTER TABLE business_invites ADD COLUMN pay_type TEXT NOT NULL DEFAULT '';
ALTER TABLE business_invites ADD COLUMN manager_user_id TEXT;
ALTER TABLE business_invites ADD COLUMN onboarding_required INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_business_invites_business_context
ON business_invites(business_id, onboarding_required, employment_type, created_at);

CREATE TABLE IF NOT EXISTS employee_sensitive_record_vault (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  record_scope TEXT NOT NULL,
  record_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'empty',
  encrypted_payload TEXT NOT NULL DEFAULT '',
  payload_iv TEXT NOT NULL DEFAULT '',
  payload_tag TEXT NOT NULL DEFAULT '',
  key_version TEXT NOT NULL DEFAULT '',
  encryption_algorithm TEXT NOT NULL DEFAULT '',
  provider_reference TEXT NOT NULL DEFAULT '',
  display_last_four TEXT NOT NULL DEFAULT '',
  expires_at INTEGER,
  retention_until INTEGER,
  locked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_sensitive_record_vault_unique
ON employee_sensitive_record_vault(business_id, user_id, record_scope, record_type);

CREATE INDEX IF NOT EXISTS idx_employee_sensitive_record_vault_business_scope
ON employee_sensitive_record_vault(business_id, record_scope, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_employee_sensitive_record_vault_retention
ON employee_sensitive_record_vault(business_id, retention_until, status);

CREATE TABLE IF NOT EXISTS employee_sensitive_record_audit (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  vault_record_id TEXT,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (vault_record_id) REFERENCES employee_sensitive_record_vault(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_sensitive_record_audit_business_created
ON employee_sensitive_record_audit(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_sensitive_record_audit_record_created
ON employee_sensitive_record_audit(vault_record_id, created_at DESC);

CREATE TABLE IF NOT EXISTS employee_verification_checks (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_reference TEXT NOT NULL DEFAULT '',
  result_summary TEXT NOT NULL DEFAULT '',
  requested_at INTEGER,
  completed_at INTEGER,
  reviewed_at INTEGER,
  reviewed_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_verification_checks_business_user
ON employee_verification_checks(business_id, user_id, check_type, status);

CREATE INDEX IF NOT EXISTS idx_employee_verification_checks_business_status
ON employee_verification_checks(business_id, status, updated_at);
