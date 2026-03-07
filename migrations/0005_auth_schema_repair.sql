-- Repair legacy auth schema (users/sessions) to match current app expectations.
-- Use this only if errors mention missing auth columns like email_normalized.

PRAGMA foreign_keys = OFF;

-- Rebuild users table in current format
ALTER TABLE users RENAME TO users_legacy;

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

INSERT INTO users (
  id,
  email,
  email_normalized,
  password_hash,
  display_name,
  is_active,
  email_verified_at,
  created_at,
  updated_at,
  role
)
SELECT
  id,
  email,
  lower(email),
  password_hash,
  username,
  1,
  NULL,
  created_at,
  created_at,
  CASE WHEN role = 'admin' THEN 'admin' ELSE 'user' END
FROM users_legacy;

DROP TABLE users_legacy;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_normalized_unique
  ON users(email_normalized);

CREATE INDEX IF NOT EXISTS idx_users_is_active
  ON users(is_active);

-- Ensure devices table exists for current auth/session flow
CREATE TABLE IF NOT EXISTS devices (
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

CREATE INDEX IF NOT EXISTS idx_devices_user_id
  ON devices(user_id);

CREATE INDEX IF NOT EXISTS idx_devices_user_revoked_at
  ON devices(user_id, revoked_at);

-- Rebuild sessions table in current format
ALTER TABLE sessions RENAME TO sessions_legacy;

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

INSERT INTO sessions (
  id,
  user_id,
  device_id,
  session_token_hash,
  created_at,
  last_seen_at,
  expires_at,
  revoked_at,
  ip_address,
  user_agent
)
SELECT
  id,
  user_id,
  NULL,
  id,
  created_at,
  created_at,
  expires_at,
  NULL,
  NULL,
  NULL
FROM sessions_legacy;

DROP TABLE sessions_legacy;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash_unique
  ON sessions(session_token_hash);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
  ON sessions(expires_at);

PRAGMA foreign_keys = ON;
