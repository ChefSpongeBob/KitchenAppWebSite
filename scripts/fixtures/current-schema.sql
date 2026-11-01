-- Schema-only test fixture from migrated D1; no users, tenant data, or secrets.
-- Through migration 0110. Update deliberately with schema migrations.
CREATE TABLE account_audit_logs (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  actor_user_id TEXT,
  target_user_id TEXT,
  action TEXT NOT NULL,
  email_hash TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE account_deletion_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  workspace_name TEXT,
  request_scope TEXT NOT NULL DEFAULT 'user',
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requester_user_id TEXT,
  requester_business_id TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT,
  FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (requester_business_id) REFERENCES businesses(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE admin_reminders (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE announcement_editors (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  granted_by TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, user_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE announcement_history (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0, business_id TEXT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE app_feature_flags (
  feature_key TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'all',
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE app_feature_flags_business (
  business_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'all',
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (business_id, feature_key),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE business_hr_settings (
  business_id TEXT PRIMARY KEY,
  retain_i9_document_copies INTEGER NOT NULL DEFAULT 0,
  everify_participant INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE business_invites (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'staff',
  invited_by TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  used_at INTEGER,
  used_by_user_id TEXT,
  revoked_at INTEGER, employment_type TEXT NOT NULL DEFAULT 'employee', job_title TEXT NOT NULL DEFAULT '', department TEXT NOT NULL DEFAULT '', primary_schedule_department TEXT NOT NULL DEFAULT '', start_date TEXT NOT NULL DEFAULT '', pay_type TEXT NOT NULL DEFAULT '', manager_user_id TEXT, onboarding_required INTEGER NOT NULL DEFAULT 1, permission_template TEXT NOT NULL DEFAULT 'staff', schedule_departments_json TEXT NOT NULL DEFAULT '[]', position_id TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE business_lifecycle_snapshots (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  requested_by_user_id TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  table_counts_json TEXT NOT NULL,
  business_json TEXT,
  trial_json TEXT,
  billing_json TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  notes TEXT
);

CREATE TABLE business_position_permissions (
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

CREATE TABLE business_positions (
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

CREATE TABLE business_store_entitlements (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  store TEXT NOT NULL,
  product_id TEXT NOT NULL,
  entitlement_key TEXT NOT NULL,
  plan_tier TEXT,
  addon_temp_monitoring INTEGER NOT NULL DEFAULT 0,
  addon_camera_monitoring INTEGER NOT NULL DEFAULT 0,
  purchase_token_hash TEXT,
  original_transaction_id TEXT,
  latest_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending_verification',
  current_period_start INTEGER,
  current_period_end INTEGER,
  auto_renewing INTEGER NOT NULL DEFAULT 0,
  verified_at INTEGER,
  expires_at INTEGER,
  raw_payload_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(business_id, store, product_id)
);

CREATE TABLE business_trials (
  business_id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'trialing',
  trial_started_at INTEGER NOT NULL,
  trial_ends_at INTEGER NOT NULL,
  converted_at INTEGER,
  canceled_at INTEGER,
  denial_reason TEXT,
  cancellation_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE business_users (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, permission_template TEXT NOT NULL DEFAULT 'staff', position_id TEXT,
  PRIMARY KEY (business_id, user_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan_tier TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  onboarding_completed_at INTEGER,
  onboarding_schedule_template TEXT,
  sidebar_logo_url TEXT,
  legal_business_name TEXT,
  registry_id TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  address_city TEXT,
  address_state TEXT,
  address_postal_code TEXT,
  address_country TEXT,
  addon_temp_monitoring INTEGER NOT NULL DEFAULT 0,
  addon_camera_monitoring INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE checklist_items (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_checked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, business_id TEXT,
  FOREIGN KEY (section_id) REFERENCES checklist_sections(id) ON DELETE CASCADE
);

CREATE TABLE checklist_sections (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
, business_id TEXT);

CREATE TABLE communication_consent_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  business_id TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
  disclosure_version TEXT NOT NULL,
  source TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL
);

CREATE TABLE creator_category_registry (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  editor_type TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE daily_specials (
  category TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0, business_id TEXT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE "daily_specials_editors" (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  granted_by TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, user_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pin_hash TEXT NOT NULL DEFAULT '',
  name TEXT,
  platform TEXT,
  user_agent TEXT,
  last_ip TEXT,
  last_seen_at INTEGER,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  section TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
, business_id TEXT);

CREATE TABLE employee_certifications (
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

CREATE TABLE employee_compliance_documents (
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

CREATE TABLE employee_compliance_requirements (
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

CREATE TABLE employee_document_access_audit (
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

CREATE TABLE employee_employment_records (
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

CREATE TABLE employee_i9_document_copies (
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

CREATE TABLE employee_i9_verifications (
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

CREATE TABLE employee_onboarding_invite_requirements (
  business_id TEXT NOT NULL,
  invite_id TEXT NOT NULL,
  requirement_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, invite_id, requirement_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (invite_id) REFERENCES business_invites(id) ON DELETE CASCADE,
  FOREIGN KEY (requirement_id) REFERENCES employee_compliance_requirements(id) ON DELETE CASCADE
);

CREATE TABLE employee_onboarding_items (
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
  reviewed_by TEXT, source_file_url TEXT NOT NULL DEFAULT '', source_file_name TEXT NOT NULL DEFAULT '', form_key TEXT NOT NULL DEFAULT '', form_payload TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (package_id) REFERENCES employee_onboarding_packages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE employee_onboarding_packages (
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
  manager_note TEXT NOT NULL DEFAULT '', submitted_at INTEGER, returned_at INTEGER, returned_by TEXT, locked_at INTEGER, version INTEGER NOT NULL DEFAULT 1, supersedes_package_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE employee_onboarding_sensitive_snapshots (
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

CREATE TABLE employee_onboarding_template_items (
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
  created_by TEXT, form_key TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE employee_pos_permissions (
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

CREATE TABLE employee_profile_edit_requests (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL,
  requested_real_name TEXT NOT NULL DEFAULT '',
  requested_birthday TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  manager_note TEXT NOT NULL DEFAULT '',
  requested_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE employee_profiles (
  business_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL,
  real_name TEXT NOT NULL DEFAULT '',
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
  PRIMARY KEY (business_id, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE employee_role_permissions (
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

CREATE TABLE employee_sensitive_record_audit (
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

CREATE TABLE employee_sensitive_record_vault (
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

CREATE TABLE employee_spotlight (
  id TEXT PRIMARY KEY,
  employee_name TEXT NOT NULL DEFAULT '',
  shoutout TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0, business_id TEXT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE employee_verification_checks (
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

CREATE TABLE iot_device_inventory (
  serial TEXT PRIMARY KEY,
  device_type TEXT NOT NULL CHECK (device_type IN ('sensor_gateway', 'sensor_node')),
  hardware_model TEXT,
  firmware_version TEXT,
  key_hash TEXT,
  key_prefix TEXT,
  claim_status TEXT NOT NULL DEFAULT 'available' CHECK (claim_status IN ('available', 'claimed', 'revoked')),
  claimed_business_id TEXT,
  claimed_iot_device_id TEXT,
  claimed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (claimed_business_id) REFERENCES businesses(id) ON DELETE SET NULL,
  FOREIGN KEY (claimed_iot_device_id) REFERENCES iot_devices(id) ON DELETE SET NULL
);

CREATE TABLE iot_device_reservations (
  serial TEXT PRIMARY KEY REFERENCES iot_device_inventory(serial) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  reserved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE iot_devices (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  device_type TEXT NOT NULL,
  external_device_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_seen_at INTEGER,
  revoked_at INTEGER,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (business_id, external_device_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE iot_ingest_guard (
  guard_key TEXT PRIMARY KEY,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE item_attachments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('list_item', 'checklist_item')),
  source_item_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('recipe', 'document')),
  target_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE legal_agreements (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  agreement_key TEXT NOT NULL,
  agreement_version TEXT NOT NULL,
  accepted_at INTEGER NOT NULL,
  acceptance_source TEXT NOT NULL DEFAULT 'register',
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE list_item_activity_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('preplists', 'inventory', 'orders', 'checklists')),
  section_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name_snapshot TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id TEXT,
  occurred_at INTEGER NOT NULL,
  value_snapshot TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE list_items (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_checked INTEGER NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  par_count REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, amount_text TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '', business_id TEXT,
  FOREIGN KEY (section_id) REFERENCES list_sections(id) ON DELETE CASCADE
);

CREATE TABLE list_sections (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL CHECK (domain IN ('inventory', 'orders', 'preplists')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, business_id TEXT,
  UNIQUE (domain, slug)
);

CREATE TABLE list_submission_batches (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('preplists', 'inventory', 'orders')),
  section_id TEXT NOT NULL,
  section_title_snapshot TEXT NOT NULL,
  submitted_by TEXT,
  submitted_at INTEGER NOT NULL,
  business_day TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE list_submission_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name_snapshot TEXT NOT NULL,
  details_snapshot TEXT,
  submitted_value TEXT NOT NULL DEFAULT '',
  par_count_snapshot REAL NOT NULL DEFAULT 0,
  is_checked_snapshot INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (batch_id) REFERENCES list_submission_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE operational_event_delivery_attempts (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'internal')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id TEXT,
  error_message TEXT,
  attempted_at INTEGER NOT NULL,
  FOREIGN KEY (event_id) REFERENCES operational_events(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE operational_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  actor_user_id TEXT,
  target_user_id TEXT,
  subject_type TEXT NOT NULL DEFAULT '',
  subject_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  dedupe_key TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'processing', 'delivered', 'failed', 'skipped')),
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER,
  last_attempt_at INTEGER,
  delivered_at INTEGER,
  failed_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  requested_ip TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE platform_staff_audit (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  business_id TEXT,
  device_serial TEXT,
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
, target_user_id TEXT);

CREATE TABLE platform_staff_members (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  staff_role TEXT NOT NULL CHECK (staff_role IN ('owner', 'support', 'equipment')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
, revision INTEGER NOT NULL DEFAULT 1);

CREATE TABLE platform_staff_step_up (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES platform_staff_members(user_id) ON DELETE CASCADE,
  membership_revision INTEGER NOT NULL,
  verified_at INTEGER NOT NULL);

CREATE TABLE push_notification_devices (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  device_token TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  device_id TEXT,
  user_agent TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  revoked_at INTEGER,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  ingredients TEXT NOT NULL,
  instructions TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
, business_id TEXT);

CREATE TABLE "schedule_departments" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT NOT NULL DEFAULT '',
  UNIQUE (business_id, name)
);

CREATE TABLE schedule_draft_open_shifts (
  id TEXT PRIMARY KEY,
  week_id TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  department TEXT NOT NULL,
  role TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL,
  end_label TEXT NOT NULL DEFAULT '',
  break_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT NOT NULL,
  FOREIGN KEY (week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE schedule_draft_shifts (
  id TEXT PRIMARY KEY,
  week_id TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  department TEXT NOT NULL,
  role TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL,
  end_label TEXT NOT NULL DEFAULT '',
  break_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT NOT NULL,
  FOREIGN KEY (week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE schedule_draft_week_team (
  week_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT NOT NULL,
  PRIMARY KEY (business_id, week_id, user_id),
  FOREIGN KEY (week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE schedule_labor_targets (
  business_id TEXT NOT NULL,
  day_date TEXT NOT NULL,
  week_start TEXT NOT NULL,
  projected_sales REAL NOT NULL DEFAULT 0,
  target_labor_percent REAL NOT NULL DEFAULT 0,
  average_hourly_rate REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (business_id, day_date),
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE schedule_open_shift_requests (
  id TEXT PRIMARY KEY,
  open_shift_id TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  manager_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by_user_id TEXT,
  business_id TEXT NOT NULL DEFAULT '',
  UNIQUE (open_shift_id, requested_by_user_id),
  FOREIGN KEY (open_shift_id) REFERENCES schedule_open_shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE schedule_open_shifts (
  id TEXT PRIMARY KEY,
  week_id TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  department TEXT NOT NULL,
  role TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL,
  end_label TEXT NOT NULL DEFAULT '',
  break_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE
);

CREATE TABLE schedule_preferences (
  id TEXT PRIMARY KEY,
  autofill_new_weeks INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT, business_id TEXT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE schedule_publish_history (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  schedule_week_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  published_by TEXT,
  published_at INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE "schedule_role_definitions" (
  id TEXT PRIMARY KEY,
  department TEXT NOT NULL,
  role_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT NOT NULL DEFAULT '',
  UNIQUE (business_id, department, role_name)
);

CREATE TABLE schedule_shift_history (
  id TEXT PRIMARY KEY,
  publish_history_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  shift_id_snapshot TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  user_id TEXT,
  employee_name_snapshot TEXT NOT NULL,
  department TEXT NOT NULL,
  role_name TEXT NOT NULL,
  detail TEXT,
  start_time TEXT NOT NULL,
  end_label TEXT,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (publish_history_id) REFERENCES schedule_publish_history(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE schedule_shift_offers (
  id TEXT PRIMARY KEY,
  shift_id TEXT NOT NULL UNIQUE,
  offered_by_user_id TEXT NOT NULL,
  target_user_id TEXT,
  requested_by_user_id TEXT,
  manager_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, business_id TEXT,
  FOREIGN KEY (shift_id) REFERENCES schedule_shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (offered_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE schedule_shifts (
  id TEXT PRIMARY KEY,
  week_id TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  department TEXT NOT NULL,
  role TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL,
  end_label TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, break_minutes INTEGER NOT NULL DEFAULT 0, business_id TEXT,
  FOREIGN KEY (week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE schedule_template_shifts (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  user_id TEXT,
  is_open INTEGER NOT NULL DEFAULT 0,
  department TEXT NOT NULL,
  role TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL,
  end_label TEXT NOT NULL DEFAULT '',
  break_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  business_id TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (template_id) REFERENCES schedule_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE schedule_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  labor_target_percent REAL NOT NULL DEFAULT 0,
  projected_sales REAL NOT NULL DEFAULT 0,
  average_hourly_rate REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  business_id TEXT NOT NULL DEFAULT '',
  UNIQUE (business_id, name),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE schedule_week_team (
  week_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, business_id TEXT,
  PRIMARY KEY (week_id, user_id),
  FOREIGN KEY (week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE "schedule_weeks" (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at INTEGER,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  business_id TEXT NOT NULL DEFAULT '', draft_initialized INTEGER NOT NULL DEFAULT 0, draft_version INTEGER NOT NULL DEFAULT 0, published_version INTEGER NOT NULL DEFAULT 0, has_unpublished_changes INTEGER NOT NULL DEFAULT 0, draft_updated_at INTEGER, draft_updated_by TEXT, draft_write_token TEXT,
  UNIQUE (business_id, week_start),
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE security_rate_limits (
  key_hash TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  blocked_until INTEGER,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE sensor_nodes (
  sensor_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  updated_at INTEGER NOT NULL
, business_id TEXT);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT,
  session_token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

CREATE TABLE store_billing_placeholders (
  business_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  preferred_store TEXT NOT NULL DEFAULT 'both',
  plan_tier TEXT NOT NULL,
  addon_temp_monitoring INTEGER NOT NULL DEFAULT 0,
  addon_camera_monitoring INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_setup',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE store_products (
  id TEXT PRIMARY KEY,
  store TEXT NOT NULL,
  product_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  entitlement_key TEXT NOT NULL,
  plan_tier TEXT,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  addon_temp_monitoring INTEGER NOT NULL DEFAULT 0,
  addon_camera_monitoring INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(store, product_id)
);

CREATE TABLE store_purchase_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  store TEXT NOT NULL,
  product_id TEXT NOT NULL,
  purchase_token_hash TEXT,
  original_transaction_id TEXT,
  transaction_id TEXT,
  event_type TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  raw_payload_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE store_webhook_events (
  id TEXT PRIMARY KEY,
  store TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_status TEXT NOT NULL DEFAULT 'pending',
  raw_payload_json TEXT,
  created_at INTEGER NOT NULL,
  processed_at INTEGER,
  UNIQUE(store, event_id)
);

CREATE TABLE "temperature_alert_events" (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  sensor_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  temperature REAL,
  threshold REAL,
  reading_ts INTEGER,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  recovered_at INTEGER,
  notification_ready_at INTEGER,
  dedupe_key TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE temperature_sensor_nodes (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  gateway_device_id TEXT NOT NULL,
  node_serial TEXT NOT NULL,
  sensor_id INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  hardware_model TEXT,
  firmware_version TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_seen_at INTEGER,
  battery_mv INTEGER,
  rssi INTEGER,
  revoked_at INTEGER,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, humidity_pct REAL, packet_sequence INTEGER, wake_nonce TEXT, lqi INTEGER,
  UNIQUE (node_serial),
  UNIQUE (business_id, sensor_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (gateway_device_id) REFERENCES iot_devices(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE temperature_sensor_settings (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  sensor_id INTEGER NOT NULL,
  high_threshold REAL NOT NULL DEFAULT 42,
  low_threshold REAL NOT NULL DEFAULT 32,
  stale_after_minutes INTEGER NOT NULL DEFAULT 15,
  offline_after_minutes INTEGER NOT NULL DEFAULT 45,
  alert_cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  is_alerting_enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  UNIQUE (business_id, sensor_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE temps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sensor_id INTEGER NOT NULL,
  temperature REAL NOT NULL,
  ts INTEGER NOT NULL
, business_id TEXT, humidity_pct REAL, packet_sequence INTEGER, wake_nonce TEXT, lqi INTEGER);

CREATE TABLE todo_assignments (
  todo_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  business_id TEXT,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE todo_completion_log (
  id TEXT PRIMARY KEY,
  todo_id TEXT NOT NULL,
  title TEXT NOT NULL,
  completed_by TEXT,
  completed_at INTEGER NOT NULL,
  business_id TEXT,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_by TEXT,
  completed_by TEXT,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE trial_denials (
  id TEXT PRIMARY KEY,
  email_normalized TEXT,
  business_name_normalized TEXT,
  client_fingerprint_hash TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  notes TEXT
);

CREATE TABLE trial_identity_claims (
  identity_key TEXT PRIMARY KEY,
  identity_type TEXT NOT NULL,
  identity_hash TEXT NOT NULL,
  business_id TEXT,
  user_id TEXT,
  source TEXT NOT NULL DEFAULT 'trial_granted',
  status TEXT NOT NULL DEFAULT 'active',
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE user_invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  invited_by TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  used_at INTEGER,
  used_by_user_id TEXT,
  revoked_at INTEGER,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  email_updates INTEGER NOT NULL DEFAULT 1,
  sms_updates INTEGER NOT NULL DEFAULT 0,
  dark_mode INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'en',
  welcome_tour_completed_at INTEGER,
  welcome_tour_variant TEXT,
  user_home_tour_completed_at INTEGER,
  admin_tour_completed_at INTEGER,
  updated_at INTEGER NOT NULL, push_updates INTEGER NOT NULL DEFAULT 0, email_updates_consented_at INTEGER, sms_updates_consented_at INTEGER, communication_consent_version TEXT, communication_consent_source TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE "user_schedule_availability" (
  business_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  is_available INTEGER NOT NULL DEFAULT 0,
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, user_id, weekday),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_schedule_availability_requests (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  availability_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  manager_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by_user_id TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE "user_schedule_departments" (
  business_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL,
  department TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, user_id, department),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_schedule_role_settings (
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

CREATE TABLE user_schedule_roles (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_definition_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, user_id, role_definition_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_definition_id) REFERENCES schedule_role_definitions(id) ON DELETE CASCADE
);

CREATE TABLE user_schedule_time_off_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  manager_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by_user_id TEXT, business_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  password_hash TEXT,
  display_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  email_verified_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  role TEXT DEFAULT 'user'
);

CREATE TABLE vendor_resources (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  website_url TEXT,
  phone TEXT,
  contact_name TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE waste_logs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  submitted_by_user_id TEXT NOT NULL,
  product TEXT NOT NULL,
  amount REAL,
  unit TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE whiteboard_posts (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  votes INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, business_id TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE whiteboard_review (
  post_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
  reviewed_by TEXT,
  reviewed_at INTEGER, business_id TEXT,
  FOREIGN KEY (post_id) REFERENCES whiteboard_posts(id) ON DELETE CASCADE
);

CREATE TABLE whiteboard_votes (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL, business_id TEXT,
  PRIMARY KEY (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES whiteboard_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_account_audit_logs_action_created
ON account_audit_logs(action, created_at DESC);

CREATE INDEX idx_account_audit_logs_actor_created
ON account_audit_logs(actor_user_id, created_at DESC);

CREATE INDEX idx_account_audit_logs_business_created
ON account_audit_logs(business_id, created_at DESC);

CREATE INDEX idx_account_audit_logs_target_created
ON account_audit_logs(target_user_id, created_at DESC);

CREATE INDEX idx_account_deletion_requests_business_created
ON account_deletion_requests(requester_business_id, created_at DESC);

CREATE INDEX idx_account_deletion_requests_email_created
ON account_deletion_requests(email, created_at DESC);

CREATE INDEX idx_account_deletion_requests_status_created
ON account_deletion_requests(status, created_at DESC);

CREATE INDEX idx_admin_reminders_business_updated
ON admin_reminders(business_id, updated_at DESC);

CREATE INDEX idx_announcement_editors_business_id
ON announcement_editors(business_id);

CREATE INDEX idx_announcement_editors_granted_by
ON announcement_editors(granted_by);

CREATE INDEX idx_announcement_history_business_created
ON announcement_history(business_id, created_at DESC);

CREATE INDEX idx_announcements_business_id ON announcements(business_id);

CREATE INDEX idx_business_invites_access_template
ON business_invites(business_id, role, permission_template, created_at);

CREATE INDEX idx_business_invites_business_context
ON business_invites(business_id, onboarding_required, employment_type, created_at);

CREATE INDEX idx_business_invites_business_created
ON business_invites(business_id, created_at DESC);

CREATE INDEX idx_business_invites_business_email_active
ON business_invites(business_id, email_normalized, revoked_at, used_at, expires_at);

CREATE INDEX idx_business_invites_business_position
ON business_invites(business_id, position_id, created_at);

CREATE INDEX idx_business_invites_email
ON business_invites(email_normalized);

CREATE INDEX idx_business_lifecycle_snapshots_business
ON business_lifecycle_snapshots(business_id, created_at DESC);

CREATE INDEX idx_business_lifecycle_snapshots_requested_by
ON business_lifecycle_snapshots(requested_by_user_id, created_at DESC);

CREATE INDEX idx_business_position_permissions_business_position
ON business_position_permissions(business_id, position_id, permission_key);

CREATE INDEX idx_business_positions_business_active
ON business_positions(business_id, is_active, sort_order, name);

CREATE INDEX idx_business_store_entitlements_business_status
  ON business_store_entitlements(business_id, status);

CREATE INDEX idx_business_store_entitlements_latest_transaction
ON business_store_entitlements(store, latest_transaction_id);

CREATE INDEX idx_business_store_entitlements_original_transaction
ON business_store_entitlements(store, original_transaction_id);

CREATE INDEX idx_business_store_entitlements_token
  ON business_store_entitlements(store, purchase_token_hash);

CREATE INDEX idx_business_trials_owner_status
ON business_trials(owner_user_id, status, updated_at DESC);

CREATE INDEX idx_business_trials_status_updated
ON business_trials(status, updated_at DESC);

CREATE INDEX idx_business_users_business_active_role
ON business_users(business_id, is_active, role);

CREATE INDEX idx_business_users_business_position
ON business_users(business_id, position_id, is_active);

CREATE INDEX idx_business_users_permission_template
ON business_users(business_id, permission_template, is_active);

CREATE INDEX idx_business_users_user
ON business_users(user_id, business_id);

CREATE INDEX idx_business_users_user_active
ON business_users(user_id, is_active, business_id);

CREATE INDEX idx_businesses_staff_name ON businesses(name COLLATE NOCASE, id);

CREATE INDEX idx_businesses_status_updated
ON businesses(status, updated_at DESC);

CREATE INDEX idx_checklist_items_business_id ON checklist_items(business_id);

CREATE INDEX idx_checklist_items_business_section_sort
ON checklist_items(business_id, section_id, sort_order, created_at);

CREATE INDEX idx_checklist_items_section_sort
  ON checklist_items(section_id, sort_order, created_at);

CREATE INDEX idx_checklist_sections_business_id ON checklist_sections(business_id);

CREATE INDEX idx_checklist_sections_business_slug
ON checklist_sections(business_id, slug);

CREATE INDEX idx_communication_consent_user_channel
  ON communication_consent_events(user_id, channel, recorded_at DESC);

CREATE UNIQUE INDEX idx_creator_category_registry_business_unique
ON creator_category_registry(business_id, editor_type, category);

CREATE INDEX idx_daily_specials_business_id ON daily_specials(business_id);

CREATE INDEX idx_daily_specials_editors_business_id
ON daily_specials_editors(business_id);

CREATE INDEX idx_daily_specials_editors_granted_by
ON daily_specials_editors(granted_by);

CREATE INDEX idx_devices_user_id
  ON devices(user_id);

CREATE INDEX idx_devices_user_revoked_at
  ON devices(user_id, revoked_at);

CREATE INDEX idx_devices_user_revoked_seen
ON devices(user_id, revoked_at, last_seen_at DESC);

CREATE INDEX idx_documents_business_active_group
ON documents(business_id, is_active, section, category, title);

CREATE INDEX idx_documents_business_file_url
ON documents(business_id, file_url);

CREATE INDEX idx_documents_business_id ON documents(business_id);

CREATE INDEX idx_documents_business_slug_active
ON documents(business_id, slug, is_active);

CREATE INDEX idx_documents_section_category
  ON documents(section, category);

CREATE INDEX idx_employee_certifications_business_user
ON employee_certifications(business_id, user_id, status, expires_at);

CREATE INDEX idx_employee_certifications_expiring
ON employee_certifications(business_id, expires_at, status);

CREATE INDEX idx_employee_compliance_documents_business_user
ON employee_compliance_documents(business_id, user_id, status, updated_at);

CREATE UNIQUE INDEX idx_employee_compliance_documents_onboarding_item
ON employee_compliance_documents(business_id, onboarding_item_id);

CREATE INDEX idx_employee_compliance_documents_requirement
ON employee_compliance_documents(business_id, requirement_id, status);

CREATE INDEX idx_employee_compliance_documents_retention
ON employee_compliance_documents(business_id, retention_until, status);

CREATE INDEX idx_employee_compliance_requirements_business_active
ON employee_compliance_requirements(business_id, is_active, category, title);

CREATE UNIQUE INDEX idx_employee_compliance_requirements_unique
ON employee_compliance_requirements(business_id, requirement_key);

CREATE INDEX idx_employee_document_access_audit_actor_created
ON employee_document_access_audit(actor_user_id, created_at DESC);

CREATE INDEX idx_employee_document_access_audit_business_created
ON employee_document_access_audit(business_id, created_at DESC);

CREATE INDEX idx_employee_document_access_audit_document_created
ON employee_document_access_audit(document_id, created_at DESC);

CREATE INDEX idx_employee_employment_records_business_status
ON employee_employment_records(business_id, employment_status, updated_at);

CREATE INDEX idx_employee_employment_records_manager
ON employee_employment_records(business_id, manager_user_id, employment_status);

CREATE INDEX idx_employee_i9_document_copies_verification
ON employee_i9_document_copies(business_id, verification_id, uploaded_at);

CREATE UNIQUE INDEX idx_employee_i9_verifications_package
ON employee_i9_verifications(business_id, package_id);

CREATE INDEX idx_employee_i9_verifications_user
ON employee_i9_verifications(business_id, user_id, status, updated_at);

CREATE INDEX idx_employee_onboarding_invite_requirements_invite
ON employee_onboarding_invite_requirements(business_id, invite_id);

CREATE INDEX idx_employee_onboarding_items_business_file
ON employee_onboarding_items(business_id, file_url);

CREATE INDEX idx_employee_onboarding_items_business_package
ON employee_onboarding_items(business_id, package_id, sort_order);

CREATE INDEX idx_employee_onboarding_items_business_source
ON employee_onboarding_items(business_id, source_file_url);

CREATE INDEX idx_employee_onboarding_items_business_user_status
ON employee_onboarding_items(business_id, user_id, status, sort_order);

CREATE INDEX idx_employee_onboarding_items_package
ON employee_onboarding_items(package_id, sort_order, status);

CREATE INDEX idx_employee_onboarding_packages_business_updated
ON employee_onboarding_packages(business_id, updated_at DESC);

CREATE INDEX idx_employee_onboarding_packages_business_user
ON employee_onboarding_packages(business_id, user_id, status, updated_at);

CREATE INDEX idx_employee_onboarding_packages_review
ON employee_onboarding_packages(business_id, status, submitted_at, updated_at);

CREATE INDEX idx_employee_onboarding_packages_user
ON employee_onboarding_packages(business_id, user_id, status, updated_at);

CREATE UNIQUE INDEX idx_employee_onboarding_sensitive_snapshot_item
ON employee_onboarding_sensitive_snapshots(business_id, onboarding_item_id);

CREATE INDEX idx_employee_onboarding_sensitive_snapshot_package
ON employee_onboarding_sensitive_snapshots(business_id, package_id, user_id);

CREATE INDEX idx_employee_onboarding_template_business
ON employee_onboarding_template_items(business_id, is_active, sort_order);

CREATE INDEX idx_employee_onboarding_template_business_active
ON employee_onboarding_template_items(business_id, is_active, sort_order);

CREATE INDEX idx_employee_onboarding_template_business_source
ON employee_onboarding_template_items(business_id, source_file_url, is_active);

CREATE INDEX idx_employee_pos_permissions_business_pos
ON employee_pos_permissions(business_id, can_use_pos, can_manager_override);

CREATE INDEX idx_employee_profile_edit_requests_business
ON employee_profile_edit_requests(business_id, status, requested_at);

CREATE INDEX idx_employee_profiles_business
ON employee_profiles(business_id, updated_at);

CREATE UNIQUE INDEX idx_employee_profiles_business_user
ON employee_profiles(business_id, user_id);

CREATE INDEX idx_employee_profiles_updated_at
ON employee_profiles(updated_at);

CREATE INDEX idx_employee_role_permissions_business_permission
ON employee_role_permissions(business_id, permission_key, is_enabled);

CREATE INDEX idx_employee_sensitive_record_audit_business_created
ON employee_sensitive_record_audit(business_id, created_at DESC);

CREATE INDEX idx_employee_sensitive_record_audit_record_created
ON employee_sensitive_record_audit(vault_record_id, created_at DESC);

CREATE INDEX idx_employee_sensitive_record_vault_business_scope
ON employee_sensitive_record_vault(business_id, record_scope, status, updated_at);

CREATE INDEX idx_employee_sensitive_record_vault_retention
ON employee_sensitive_record_vault(business_id, retention_until, status);

CREATE UNIQUE INDEX idx_employee_sensitive_record_vault_unique
ON employee_sensitive_record_vault(business_id, user_id, record_scope, record_type);

CREATE INDEX idx_employee_spotlight_business_id ON employee_spotlight(business_id);

CREATE INDEX idx_employee_verification_checks_business_status
ON employee_verification_checks(business_id, status, updated_at);

CREATE INDEX idx_employee_verification_checks_business_user
ON employee_verification_checks(business_id, user_id, check_type, status);

CREATE INDEX idx_iot_devices_business_active
ON iot_devices(business_id, is_active, device_type);

CREATE INDEX idx_iot_devices_external
ON iot_devices(external_device_id, is_active);

CREATE UNIQUE INDEX idx_iot_devices_external_device_unique
ON iot_devices(external_device_id);

CREATE INDEX idx_iot_ingest_guard_expires_at
ON iot_ingest_guard(expires_at);

CREATE INDEX idx_iot_inventory_claimed_business
  ON iot_device_inventory(claimed_business_id, device_type);

CREATE INDEX idx_iot_inventory_type_status
  ON iot_device_inventory(device_type, claim_status);

CREATE INDEX idx_iot_reservations_business ON iot_device_reservations(business_id, serial);

CREATE INDEX idx_item_attachments_source
ON item_attachments(business_id, source_type, source_item_id);

CREATE INDEX idx_item_attachments_target
ON item_attachments(business_id, target_type, target_id);

CREATE UNIQUE INDEX idx_item_attachments_unique
ON item_attachments(business_id, source_type, source_item_id, target_type, target_id);

CREATE INDEX idx_legal_agreements_business_user
ON legal_agreements(business_id, user_id, agreement_key, agreement_version);

CREATE UNIQUE INDEX idx_legal_agreements_unique
ON legal_agreements (
  business_id,
  user_id,
  agreement_key,
  agreement_version
);

CREATE INDEX idx_list_item_activity_business_time
ON list_item_activity_events(business_id, domain, occurred_at);

CREATE INDEX idx_list_item_activity_lookup
ON list_item_activity_events(business_id, domain, item_id, occurred_at);

CREATE INDEX idx_list_items_business_id ON list_items(business_id);

CREATE INDEX idx_list_items_business_section_sort
ON list_items(business_id, section_id, sort_order, created_at);

CREATE INDEX idx_list_items_section_sort
  ON list_items(section_id, sort_order, created_at);

CREATE INDEX idx_list_sections_business_domain_slug
ON list_sections(business_id, domain, slug);

CREATE INDEX idx_list_sections_business_id ON list_sections(business_id);

CREATE INDEX idx_list_sections_domain
  ON list_sections(domain, slug);

CREATE INDEX idx_list_submission_batches_business_day
ON list_submission_batches(business_id, domain, business_day, submitted_at);

CREATE INDEX idx_list_submission_items_batch
ON list_submission_items(batch_id, business_id);

CREATE INDEX idx_operational_attempts_staff_recent
  ON operational_event_delivery_attempts(business_id, attempted_at DESC, id DESC);

CREATE INDEX idx_operational_event_attempts_business_status
ON operational_event_delivery_attempts(business_id, status, attempted_at DESC);

CREATE INDEX idx_operational_event_attempts_event
ON operational_event_delivery_attempts(event_id, attempted_at DESC);

CREATE INDEX idx_operational_events_business_category_created
ON operational_events(business_id, category, created_at DESC);

CREATE UNIQUE INDEX idx_operational_events_business_dedupe
ON operational_events(business_id, dedupe_key)
WHERE dedupe_key IS NOT NULL;

CREATE INDEX idx_operational_events_business_status_next
ON operational_events(business_id, delivery_status, next_attempt_at, created_at);

CREATE INDEX idx_operational_events_business_type_created
ON operational_events(business_id, event_type, created_at DESC);

CREATE INDEX idx_operational_events_retention
ON operational_events(delivery_status, expires_at, created_at);

CREATE INDEX idx_operational_events_staff_queue
  ON operational_events(business_id, delivery_status, created_at DESC, id DESC);

CREATE INDEX idx_operational_events_target_created
ON operational_events(business_id, target_user_id, created_at DESC);

CREATE INDEX idx_password_resets_expires_at
ON password_resets(expires_at);

CREATE INDEX idx_password_resets_requested_ip_created
ON password_resets(requested_ip, created_at DESC);

CREATE INDEX idx_password_resets_token_hash
ON password_resets(token_hash);

CREATE INDEX idx_password_resets_user_id
ON password_resets(user_id);

CREATE INDEX idx_platform_staff_audit_created ON platform_staff_audit(created_at DESC, id);

CREATE INDEX idx_platform_staff_step_up_user ON platform_staff_step_up(user_id);

CREATE INDEX idx_push_devices_business_active_user
  ON push_notification_devices(business_id, is_active, user_id);

CREATE UNIQUE INDEX idx_push_devices_business_user_token
  ON push_notification_devices(business_id, user_id, token_hash);

CREATE INDEX idx_push_devices_token_hash
  ON push_notification_devices(token_hash);

CREATE INDEX idx_push_devices_user_active
  ON push_notification_devices(user_id, is_active);

CREATE INDEX idx_recipes_business_category_title
ON recipes(business_id, category, title);

CREATE INDEX idx_recipes_business_created
ON recipes(business_id, created_at DESC);

CREATE INDEX idx_recipes_business_id ON recipes(business_id);

CREATE INDEX idx_recipes_category
  ON recipes(category);

CREATE INDEX idx_schedule_availability_requests_business_status
ON user_schedule_availability_requests(business_id, status, updated_at DESC);

CREATE INDEX idx_schedule_availability_requests_business_user
ON user_schedule_availability_requests(business_id, user_id, status, updated_at DESC);

CREATE UNIQUE INDEX idx_schedule_availability_requests_one_pending
ON user_schedule_availability_requests(business_id, user_id)
WHERE status = 'pending';

CREATE INDEX idx_schedule_departments_business_active_order
ON schedule_departments(business_id, is_active, sort_order, name);

CREATE INDEX idx_schedule_departments_business_name
ON schedule_departments(business_id, name);

CREATE INDEX idx_schedule_departments_order
ON schedule_departments(sort_order, name);

CREATE INDEX idx_schedule_draft_open_shifts_business_week_date
ON schedule_draft_open_shifts(business_id, week_id, shift_date, start_time, sort_order);

CREATE INDEX idx_schedule_draft_shifts_business_user_date
ON schedule_draft_shifts(business_id, user_id, shift_date, start_time);

CREATE INDEX idx_schedule_draft_shifts_business_week_date
ON schedule_draft_shifts(business_id, week_id, shift_date, start_time, sort_order);

CREATE INDEX idx_schedule_draft_week_team_week_sort
ON schedule_draft_week_team(business_id, week_id, sort_order, user_id);

CREATE INDEX idx_schedule_labor_targets_business_week
ON schedule_labor_targets(business_id, week_start, day_date);

CREATE INDEX idx_schedule_labor_targets_week
ON schedule_labor_targets(business_id, week_start, day_date);

CREATE INDEX idx_schedule_open_shift_requests_business_open_user
ON schedule_open_shift_requests(business_id, open_shift_id, requested_by_user_id, status);

CREATE INDEX idx_schedule_open_shift_requests_business_status
ON schedule_open_shift_requests(business_id, status, updated_at);

CREATE INDEX idx_schedule_open_shift_requests_business_updated
ON schedule_open_shift_requests(business_id, updated_at DESC);

CREATE INDEX idx_schedule_open_shift_requests_status
ON schedule_open_shift_requests(business_id, status, updated_at);

CREATE INDEX idx_schedule_open_shifts_business_week
ON schedule_open_shifts(business_id, week_id, shift_date, start_time, sort_order);

CREATE INDEX idx_schedule_open_shifts_week_date
ON schedule_open_shifts(business_id, week_id, shift_date, start_time, sort_order);

CREATE INDEX idx_schedule_preferences_business
ON schedule_preferences(business_id, id);

CREATE INDEX idx_schedule_preferences_business_id ON schedule_preferences(business_id);

CREATE INDEX idx_schedule_publish_history_week
ON schedule_publish_history(business_id, week_start, version_number);

CREATE INDEX idx_schedule_role_definitions_business_active_department
ON schedule_role_definitions(business_id, is_active, department, sort_order, role_name);

CREATE INDEX idx_schedule_role_definitions_business_department_role
ON schedule_role_definitions(business_id, department, role_name);

CREATE INDEX idx_schedule_role_definitions_department
ON schedule_role_definitions(department, sort_order, role_name);

CREATE INDEX idx_schedule_shift_history_publish
ON schedule_shift_history(publish_history_id, business_id, shift_date);

CREATE INDEX idx_schedule_shift_offers_business_id ON schedule_shift_offers(business_id);

CREATE INDEX idx_schedule_shift_offers_business_shift
ON schedule_shift_offers(business_id, shift_id, requested_by_user_id);

CREATE INDEX idx_schedule_shift_offers_business_updated
ON schedule_shift_offers(business_id, updated_at DESC);

CREATE INDEX idx_schedule_shift_offers_week_request
ON schedule_shift_offers(shift_id, target_user_id, requested_by_user_id, updated_at);

CREATE INDEX idx_schedule_shifts_business_date
ON schedule_shifts(business_id, shift_date, user_id);

CREATE INDEX idx_schedule_shifts_business_id ON schedule_shifts(business_id);

CREATE INDEX idx_schedule_shifts_business_user_date
ON schedule_shifts(business_id, user_id, shift_date, start_time);

CREATE INDEX idx_schedule_shifts_business_week_date
ON schedule_shifts(business_id, week_id, shift_date, start_time, sort_order);

CREATE INDEX idx_schedule_shifts_user_date
ON schedule_shifts(user_id, shift_date, start_time);

CREATE INDEX idx_schedule_shifts_week_date
ON schedule_shifts(week_id, shift_date, start_time, sort_order);

CREATE INDEX idx_schedule_template_shifts_business_template
ON schedule_template_shifts(business_id, template_id, weekday, sort_order);

CREATE INDEX idx_schedule_template_shifts_template
ON schedule_template_shifts(template_id, weekday, sort_order);

CREATE INDEX idx_schedule_templates_business_name
ON schedule_templates(business_id, name);

CREATE INDEX idx_schedule_templates_business_updated
ON schedule_templates(business_id, updated_at DESC, name);

CREATE INDEX idx_schedule_week_team_business_id ON schedule_week_team(business_id);

CREATE INDEX idx_schedule_week_team_business_week
ON schedule_week_team(business_id, week_id, sort_order);

CREATE INDEX idx_schedule_week_team_week_sort
ON schedule_week_team(week_id, sort_order, user_id);

CREATE INDEX idx_schedule_weeks_business_id
ON schedule_weeks(business_id);

CREATE INDEX idx_schedule_weeks_week_start
ON schedule_weeks(business_id, week_start, status);

CREATE INDEX idx_security_rate_limits_action_seen
ON security_rate_limits(action, last_seen_at);

CREATE INDEX idx_security_rate_limits_blocked
ON security_rate_limits(blocked_until);

CREATE INDEX idx_sensor_nodes_business_id ON sensor_nodes(business_id);

CREATE INDEX idx_sensor_nodes_business_sensor
ON sensor_nodes(business_id, sensor_id);

CREATE INDEX idx_sessions_expires_at
  ON sessions(expires_at);

CREATE UNIQUE INDEX idx_sessions_token_hash_unique
  ON sessions(session_token_hash);

CREATE INDEX idx_sessions_user_id
  ON sessions(user_id);

CREATE INDEX idx_sessions_user_revoked_seen
ON sessions(user_id, revoked_at, last_seen_at DESC);

CREATE INDEX idx_store_billing_placeholders_status
ON store_billing_placeholders(status, updated_at);

CREATE INDEX idx_store_products_store_active
  ON store_products(store, active);

CREATE INDEX idx_store_purchase_events_business
  ON store_purchase_events(business_id, created_at);

CREATE INDEX idx_store_purchase_events_business_status_created
ON store_purchase_events(business_id, verification_status, created_at DESC);

CREATE INDEX idx_store_purchase_events_token
  ON store_purchase_events(store, purchase_token_hash);

CREATE INDEX idx_store_webhook_events_processed_created
ON store_webhook_events(processed_status, created_at);

CREATE INDEX idx_store_webhook_events_status
  ON store_webhook_events(store, processed_status, created_at);

CREATE INDEX idx_store_webhook_events_status_created
ON store_webhook_events(processed_status, created_at);

CREATE UNIQUE INDEX idx_temp_alert_events_business_dedupe
  ON temperature_alert_events(business_id, dedupe_key);

CREATE INDEX idx_temp_alert_events_business_sensor_status
  ON temperature_alert_events(business_id, sensor_id, status, last_seen_at DESC);

CREATE INDEX idx_temp_alert_events_business_status
  ON temperature_alert_events(business_id, status, event_type, last_seen_at DESC);

CREATE INDEX idx_temp_alert_events_notification_ready
  ON temperature_alert_events(business_id, status, event_type, notification_ready_at);

CREATE INDEX idx_temp_sensor_nodes_business_active
  ON temperature_sensor_nodes(business_id, is_active, gateway_device_id);

CREATE INDEX idx_temp_sensor_nodes_business_sensor
  ON temperature_sensor_nodes(business_id, sensor_id);

CREATE INDEX idx_temp_sensor_nodes_gateway_active
  ON temperature_sensor_nodes(gateway_device_id, is_active);

CREATE INDEX idx_temp_settings_business_sensor
  ON temperature_sensor_settings(business_id, sensor_id);

CREATE INDEX idx_temperature_alert_events_business_seen
  ON temperature_alert_events(business_id, last_seen_at DESC);

CREATE INDEX idx_temps_business_id ON temps(business_id);

CREATE INDEX idx_temps_business_sensor_nonce
  ON temps(business_id, sensor_id, wake_nonce);

CREATE UNIQUE INDEX idx_temps_business_sensor_packet_unique ON temps(business_id, sensor_id, packet_sequence, wake_nonce) WHERE packet_sequence IS NOT NULL AND wake_nonce IS NOT NULL;

CREATE INDEX idx_temps_business_sensor_sequence
  ON temps(business_id, sensor_id, packet_sequence);

CREATE INDEX idx_temps_business_sensor_ts
ON temps(business_id, sensor_id, ts DESC);

CREATE INDEX idx_temps_business_ts
ON temps(business_id, ts DESC);

CREATE INDEX idx_temps_sensor_ts
  ON temps(sensor_id, ts DESC);

CREATE INDEX idx_temps_sensor_ts_desc
  ON temps(sensor_id, ts DESC);

CREATE INDEX idx_temps_ts_desc
  ON temps(ts DESC);

CREATE INDEX idx_todo_assignments_business_id ON todo_assignments(business_id);

CREATE INDEX idx_todo_assignments_business_todo ON todo_assignments(business_id, todo_id, user_id);

CREATE INDEX idx_todo_assignments_business_user ON todo_assignments(business_id, user_id, todo_id);

CREATE INDEX idx_todo_assignments_todo_id ON todo_assignments(todo_id);

CREATE INDEX idx_todo_assignments_user_id ON todo_assignments(user_id);

CREATE INDEX idx_todo_completion_log_business_completed ON todo_completion_log(business_id, completed_at DESC);

CREATE INDEX idx_todo_completion_log_business_id ON todo_completion_log(business_id);

CREATE INDEX idx_todo_log_completed_at ON todo_completion_log(completed_at);

CREATE INDEX idx_todo_log_completed_by_completed_at ON todo_completion_log(completed_by, completed_at DESC);

CREATE INDEX idx_todos_business_completed ON todos(business_id, completed_at DESC);

CREATE INDEX idx_todos_business_created ON todos(business_id, created_at DESC);

CREATE INDEX idx_todos_business_id ON todos(business_id);

CREATE INDEX idx_todos_completed_at ON todos(completed_at);

CREATE INDEX idx_trial_denials_business
ON trial_denials(business_name_normalized);

CREATE INDEX idx_trial_denials_email
ON trial_denials(email_normalized);

CREATE INDEX idx_trial_denials_fingerprint
ON trial_denials(client_fingerprint_hash);

CREATE INDEX idx_trial_denials_ip
ON trial_denials(ip_hash);

CREATE INDEX idx_trial_identity_claims_business
ON trial_identity_claims(business_id, status, last_seen_at DESC);

CREATE INDEX idx_trial_identity_claims_type_hash
ON trial_identity_claims(identity_type, identity_hash, status);

CREATE INDEX idx_user_invites_active
ON user_invites(email_normalized, revoked_at, used_at, expires_at);

CREATE INDEX idx_user_invites_email_normalized
ON user_invites(email_normalized);

CREATE INDEX idx_user_schedule_availability_business_user
ON user_schedule_availability(business_id, user_id, weekday);

CREATE INDEX idx_user_schedule_availability_user
ON user_schedule_availability(user_id, weekday);

CREATE INDEX idx_user_schedule_departments_business_user
ON user_schedule_departments(business_id, user_id, department);

CREATE INDEX idx_user_schedule_departments_department
ON user_schedule_departments(department, user_id);

CREATE INDEX idx_user_schedule_roles_role
ON user_schedule_roles(business_id, role_definition_id);

CREATE INDEX idx_user_schedule_roles_user
ON user_schedule_roles(business_id, user_id);

CREATE INDEX idx_user_schedule_time_off_business_status
ON user_schedule_time_off_requests(business_id, status, start_date);

CREATE INDEX idx_user_schedule_time_off_business_user_status
ON user_schedule_time_off_requests(business_id, user_id, status, start_date);

CREATE INDEX idx_user_schedule_time_off_requests_business_id ON user_schedule_time_off_requests(business_id);

CREATE INDEX idx_user_schedule_time_off_requests_business_updated
ON user_schedule_time_off_requests(business_id, updated_at DESC);

CREATE INDEX idx_user_schedule_time_off_requests_user
ON user_schedule_time_off_requests(user_id, start_date, end_date, status);

CREATE UNIQUE INDEX idx_users_email_normalized_unique
  ON users(email_normalized);

CREATE INDEX idx_users_is_active
  ON users(is_active);

CREATE INDEX idx_vendor_resources_business_active_name
ON vendor_resources(business_id, is_active, name);

CREATE INDEX idx_waste_logs_business_created
  ON waste_logs(business_id, created_at DESC);

CREATE INDEX idx_waste_logs_business_user_created
  ON waste_logs(business_id, submitted_by_user_id, created_at DESC);

CREATE INDEX idx_whiteboard_posts_business_created
ON whiteboard_posts(business_id, created_at DESC);

CREATE INDEX idx_whiteboard_posts_business_id ON whiteboard_posts(business_id);

CREATE INDEX idx_whiteboard_posts_business_votes
ON whiteboard_posts(business_id, votes DESC, created_at DESC);

CREATE INDEX idx_whiteboard_review_business_id ON whiteboard_review(business_id);

CREATE INDEX idx_whiteboard_review_business_status
ON whiteboard_review(business_id, status, post_id);

CREATE INDEX idx_whiteboard_review_status
  ON whiteboard_review(status);

CREATE INDEX idx_whiteboard_votes
  ON whiteboard_posts(votes DESC, created_at DESC);

CREATE INDEX idx_whiteboard_votes_business_id ON whiteboard_votes(business_id);

CREATE INDEX idx_whiteboard_votes_user_id
  ON whiteboard_votes(user_id, created_at DESC);

CREATE TRIGGER iot_gateway_reservation_insert
BEFORE INSERT ON iot_devices
WHEN NEW.device_type = 'sensor_gateway' AND EXISTS (
  SELECT 1 FROM iot_device_reservations r
  WHERE r.serial = NEW.external_device_id AND r.business_id <> NEW.business_id
)
BEGIN SELECT RAISE(ABORT, 'Gateway is reserved for another business.'); END;

CREATE TRIGGER iot_gateway_reservation_update
BEFORE UPDATE OF business_id, external_device_id, is_active ON iot_devices
WHEN NEW.device_type = 'sensor_gateway' AND EXISTS (
  SELECT 1 FROM iot_device_reservations r
  WHERE r.serial = NEW.external_device_id AND r.business_id <> NEW.business_id
)
BEGIN SELECT RAISE(ABORT, 'Gateway is reserved for another business.'); END;

CREATE TRIGGER iot_reservation_available_insert
BEFORE INSERT ON iot_device_reservations
WHEN NOT EXISTS (
  SELECT 1 FROM iot_device_inventory i
  WHERE i.serial = NEW.serial AND i.device_type = 'sensor_gateway'
    AND i.claim_status = 'available' AND i.claimed_business_id IS NULL
    AND i.claimed_iot_device_id IS NULL
) OR EXISTS (SELECT 1 FROM iot_devices d WHERE d.external_device_id = NEW.serial)
BEGIN SELECT RAISE(ABORT, 'Only unclaimed gateways can be reserved.'); END;

CREATE TRIGGER iot_reservation_no_reassignment
BEFORE UPDATE OF serial, business_id ON iot_device_reservations
BEGIN SELECT RAISE(ABORT, 'Release the reservation before reassigning it.'); END;

CREATE TRIGGER platform_staff_access_changed
AFTER UPDATE OF staff_role, is_active, revision ON platform_staff_members
WHEN OLD.staff_role <> NEW.staff_role OR OLD.is_active <> NEW.is_active OR OLD.revision <> NEW.revision
BEGIN
  DELETE FROM platform_staff_step_up WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER platform_staff_account_inactive
AFTER UPDATE OF is_active ON users
WHEN COALESCE(OLD.is_active, 1) <> COALESCE(NEW.is_active, 1)
BEGIN
  DELETE FROM platform_staff_step_up WHERE user_id = NEW.id;
END;

CREATE TRIGGER platform_staff_last_owner_account_delete
BEFORE DELETE ON users
WHEN EXISTS (SELECT 1 FROM platform_staff_members s WHERE s.user_id = OLD.id AND s.staff_role = 'owner' AND s.is_active = 1)
  AND NOT EXISTS (
    SELECT 1 FROM platform_staff_members s JOIN users u ON u.id = s.user_id
    WHERE s.user_id <> OLD.id AND s.staff_role = 'owner' AND s.is_active = 1 AND COALESCE(u.is_active, 1) = 1
  )
BEGIN SELECT RAISE(ABORT, 'At least one active platform owner must remain.'); END;

CREATE TRIGGER platform_staff_last_owner_account_inactive
BEFORE UPDATE OF is_active ON users
WHEN COALESCE(OLD.is_active, 1) = 1 AND NEW.is_active = 0
  AND EXISTS (SELECT 1 FROM platform_staff_members s WHERE s.user_id = OLD.id AND s.staff_role = 'owner' AND s.is_active = 1)
  AND NOT EXISTS (
    SELECT 1 FROM platform_staff_members s JOIN users u ON u.id = s.user_id
    WHERE s.user_id <> OLD.id AND s.staff_role = 'owner' AND s.is_active = 1 AND COALESCE(u.is_active, 1) = 1
  )
BEGIN SELECT RAISE(ABORT, 'At least one active platform owner must remain.'); END;

CREATE TRIGGER platform_staff_last_owner_delete
BEFORE DELETE ON platform_staff_members
WHEN OLD.staff_role = 'owner' AND OLD.is_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM platform_staff_members s JOIN users u ON u.id = s.user_id
    WHERE s.user_id <> OLD.user_id AND s.staff_role = 'owner' AND s.is_active = 1
      AND COALESCE(u.is_active, 1) = 1
  )
BEGIN SELECT RAISE(ABORT, 'At least one active platform owner must remain.'); END;

CREATE TRIGGER platform_staff_last_owner_update
BEFORE UPDATE OF staff_role, is_active ON platform_staff_members
WHEN OLD.staff_role = 'owner' AND OLD.is_active = 1
  AND (NEW.staff_role <> 'owner' OR NEW.is_active <> 1)
  AND NOT EXISTS (
    SELECT 1 FROM platform_staff_members s JOIN users u ON u.id = s.user_id
    WHERE s.user_id <> OLD.user_id AND s.staff_role = 'owner' AND s.is_active = 1
      AND COALESCE(u.is_active, 1) = 1
  )
BEGIN SELECT RAISE(ABORT, 'At least one active platform owner must remain.'); END;

CREATE TRIGGER platform_staff_members_insert_audit
AFTER INSERT ON platform_staff_members
WHEN NEW.granted_by IS NULL AND NEW.staff_role = 'owner'
BEGIN
  INSERT INTO platform_staff_audit (id, actor_user_id, target_user_id, action, reason, created_at)
  VALUES (lower(hex(randomblob(16))), NEW.user_id, NEW.user_id, 'platform_owner_bootstrapped',
    'Explicit operator-approved platform membership', NEW.created_at);
END;

CREATE TRIGGER platform_staff_password_changed
AFTER UPDATE OF password_hash ON users
WHEN OLD.password_hash IS NOT NEW.password_hash
BEGIN
  DELETE FROM platform_staff_step_up WHERE user_id = NEW.id;
END;
