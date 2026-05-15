-- HR/compliance foundation for business-scoped employee onboarding.
-- This intentionally does not collect full SSNs, full bank details, or tax IDs.
-- Sensitive record capture should be added only after encrypted vault/access controls exist.

CREATE TABLE IF NOT EXISTS employee_employment_records (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  employment_status TEXT NOT NULL DEFAULT 'onboarding',
  employment_type TEXT NOT NULL DEFAULT 'employee',
  job_title TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  primary_schedule_department TEXT NOT NULL DEFAULT '',
  hire_date TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  termination_date TEXT NOT NULL DEFAULT '',
  pay_type TEXT NOT NULL DEFAULT '',
  manager_user_id TEXT,
  onboarding_package_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (business_id, user_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (onboarding_package_id) REFERENCES employee_onboarding_packages(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_employment_records_business_status
ON employee_employment_records(business_id, employment_status, updated_at);

CREATE INDEX IF NOT EXISTS idx_employee_employment_records_manager
ON employee_employment_records(business_id, manager_user_id, employment_status);

CREATE TABLE IF NOT EXISTS employee_compliance_requirements (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  requirement_key TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  applies_to_type TEXT NOT NULL DEFAULT 'employee',
  is_required INTEGER NOT NULL DEFAULT 1,
  requires_document INTEGER NOT NULL DEFAULT 0,
  requires_signature INTEGER NOT NULL DEFAULT 0,
  default_due_days INTEGER,
  renewal_interval_days INTEGER,
  retention_years INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_compliance_requirements_unique
ON employee_compliance_requirements(business_id, requirement_key);

CREATE INDEX IF NOT EXISTS idx_employee_compliance_requirements_business_active
ON employee_compliance_requirements(business_id, is_active, category, title);

CREATE TABLE IF NOT EXISTS employee_compliance_documents (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  requirement_id TEXT,
  onboarding_item_id TEXT,
  document_type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending',
  file_url TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  signed_name TEXT NOT NULL DEFAULT '',
  submitted_at INTEGER,
  reviewed_at INTEGER,
  reviewed_by TEXT,
  expires_at INTEGER,
  retention_until INTEGER,
  locked_at INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (requirement_id) REFERENCES employee_compliance_requirements(id) ON DELETE SET NULL,
  FOREIGN KEY (onboarding_item_id) REFERENCES employee_onboarding_items(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_compliance_documents_business_user
ON employee_compliance_documents(business_id, user_id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_employee_compliance_documents_requirement
ON employee_compliance_documents(business_id, requirement_id, status);

CREATE INDEX IF NOT EXISTS idx_employee_compliance_documents_retention
ON employee_compliance_documents(business_id, retention_until, status);

CREATE TABLE IF NOT EXISTS employee_document_access_audit (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  document_id TEXT,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES employee_compliance_documents(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_document_access_audit_business_created
ON employee_document_access_audit(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_document_access_audit_document_created
ON employee_document_access_audit(document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_document_access_audit_actor_created
ON employee_document_access_audit(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS employee_onboarding_invite_requirements (
  business_id TEXT NOT NULL,
  invite_id TEXT NOT NULL,
  requirement_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, invite_id, requirement_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (invite_id) REFERENCES business_invites(id) ON DELETE CASCADE,
  FOREIGN KEY (requirement_id) REFERENCES employee_compliance_requirements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_invite_requirements_invite
ON employee_onboarding_invite_requirements(business_id, invite_id);

CREATE TABLE IF NOT EXISTS employee_role_permissions (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  granted_by TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, user_id, permission_key),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_role_permissions_business_permission
ON employee_role_permissions(business_id, permission_key, is_enabled);

CREATE TABLE IF NOT EXISTS employee_pos_permissions (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  pos_external_id TEXT NOT NULL DEFAULT '',
  can_clock_in INTEGER NOT NULL DEFAULT 1,
  can_use_pos INTEGER NOT NULL DEFAULT 0,
  can_open_cash_drawer INTEGER NOT NULL DEFAULT 0,
  can_refund INTEGER NOT NULL DEFAULT 0,
  can_void INTEGER NOT NULL DEFAULT 0,
  can_manager_override INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (business_id, user_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_pos_permissions_business_pos
ON employee_pos_permissions(business_id, can_use_pos, can_manager_override);

CREATE TABLE IF NOT EXISTS employee_certifications (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  certification_type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  issuer TEXT NOT NULL DEFAULT '',
  certificate_number TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  issued_at INTEGER,
  expires_at INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at INTEGER,
  reviewed_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_certifications_business_user
ON employee_certifications(business_id, user_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_employee_certifications_expiring
ON employee_certifications(business_id, expires_at, status);
