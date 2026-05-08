-- Platform/workspace schema readiness.
-- This migration moves tables that were previously protected by runtime ensure*
-- guards into the forward migration path for clean local and launch databases.

CREATE TABLE IF NOT EXISTS businesses (
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

CREATE TABLE IF NOT EXISTS business_users (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, user_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_business_users_user
ON business_users(user_id, business_id);

CREATE TABLE IF NOT EXISTS business_invites (
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
  revoked_at INTEGER,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_invites_email
ON business_invites(email_normalized);

CREATE TABLE IF NOT EXISTS business_trials (
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

CREATE TABLE IF NOT EXISTS trial_denials (
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

CREATE INDEX IF NOT EXISTS idx_trial_denials_email
ON trial_denials(email_normalized);

CREATE INDEX IF NOT EXISTS idx_trial_denials_business
ON trial_denials(business_name_normalized);

CREATE INDEX IF NOT EXISTS idx_trial_denials_fingerprint
ON trial_denials(client_fingerprint_hash);

CREATE INDEX IF NOT EXISTS idx_trial_denials_ip
ON trial_denials(ip_hash);

CREATE TABLE IF NOT EXISTS store_billing_placeholders (
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

CREATE TABLE IF NOT EXISTS legal_agreements (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_agreements_unique
ON legal_agreements (
  business_id,
  user_id,
  agreement_key,
  agreement_version
);

CREATE TABLE IF NOT EXISTS app_feature_flags_business (
  business_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'all',
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (business_id, feature_key),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_feature_flags (
  feature_key TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'all',
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO app_feature_flags (feature_key, mode, updated_at, updated_by)
VALUES
  ('scheduling', 'all', strftime('%s','now'), NULL),
  ('todo', 'all', strftime('%s','now'), NULL),
  ('whiteboard', 'all', strftime('%s','now'), NULL),
  ('temps', 'all', strftime('%s','now'), NULL),
  ('announcements', 'all', strftime('%s','now'), NULL),
  ('employee_spotlight', 'all', strftime('%s','now'), NULL),
  ('daily_specials', 'all', strftime('%s','now'), NULL),
  ('lists', 'all', strftime('%s','now'), NULL),
  ('recipes', 'all', strftime('%s','now'), NULL),
  ('documents', 'all', strftime('%s','now'), NULL),
  ('menus', 'all', strftime('%s','now'), NULL),
  ('meeting_notes', 'all', strftime('%s','now'), NULL)
ON CONFLICT(feature_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  email_updates INTEGER NOT NULL DEFAULT 1,
  sms_updates INTEGER NOT NULL DEFAULT 0,
  dark_mode INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'en',
  welcome_tour_completed_at INTEGER,
  welcome_tour_variant TEXT,
  user_home_tour_completed_at INTEGER,
  admin_tour_completed_at INTEGER,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_profile_edit_requests (
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

CREATE INDEX IF NOT EXISTS idx_employee_profile_edit_requests_business
ON employee_profile_edit_requests(business_id, status, requested_at);

CREATE TABLE IF NOT EXISTS creator_category_registry (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  editor_type TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

DROP INDEX IF EXISTS idx_creator_category_registry_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_category_registry_business_unique
ON creator_category_registry(business_id, editor_type, category);
