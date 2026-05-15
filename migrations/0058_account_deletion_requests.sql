CREATE TABLE IF NOT EXISTS account_deletion_requests (
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

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status_created
ON account_deletion_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_email_created
ON account_deletion_requests(email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_business_created
ON account_deletion_requests(requester_business_id, created_at DESC);
