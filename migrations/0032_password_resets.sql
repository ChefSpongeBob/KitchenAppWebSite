CREATE TABLE IF NOT EXISTS password_resets (
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

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id
ON password_resets(user_id);

CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash
ON password_resets(token_hash);

CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at
ON password_resets(expires_at);
