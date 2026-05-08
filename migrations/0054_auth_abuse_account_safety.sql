-- Auth, abuse, and account safety controls.

CREATE TABLE IF NOT EXISTS security_rate_limits (
  key_hash TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  blocked_until INTEGER,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_action_seen
ON security_rate_limits(action, last_seen_at);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_blocked
ON security_rate_limits(blocked_until);

CREATE TABLE IF NOT EXISTS account_audit_logs (
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

CREATE INDEX IF NOT EXISTS idx_account_audit_logs_business_created
ON account_audit_logs(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_audit_logs_actor_created
ON account_audit_logs(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_audit_logs_target_created
ON account_audit_logs(target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_audit_logs_action_created
ON account_audit_logs(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_user_revoked_seen
ON sessions(user_id, revoked_at, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_devices_user_revoked_seen
ON devices(user_id, revoked_at, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_resets_requested_ip_created
ON password_resets(requested_ip, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_invites_business_created
ON business_invites(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_invites_business_email_active
ON business_invites(business_id, email_normalized, revoked_at, used_at, expires_at);
