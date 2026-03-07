-- Hard repair for partially migrated databases.
-- This recreates auth/content/list tables to match current app queries.
-- It intentionally resets data in these tables:
-- users, sessions, devices, documents, whiteboard_posts, list_sections, list_items

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS whiteboard_posts;
DROP TABLE IF EXISTS list_items;
DROP TABLE IF EXISTS list_sections;

-- USERS
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_normalized_unique
  ON users(email_normalized);

CREATE INDEX IF NOT EXISTS idx_users_is_active
  ON users(is_active);

-- DEVICES
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

CREATE INDEX IF NOT EXISTS idx_devices_user_id
  ON devices(user_id);

CREATE INDEX IF NOT EXISTS idx_devices_user_revoked_at
  ON devices(user_id, revoked_at);

-- SESSIONS
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash_unique
  ON sessions(session_token_hash);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
  ON sessions(expires_at);

-- DOCUMENTS
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
);

CREATE INDEX IF NOT EXISTS idx_documents_section_category
  ON documents(section, category);

-- WHITEBOARD
CREATE TABLE whiteboard_posts (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  votes INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_whiteboard_votes
  ON whiteboard_posts(votes DESC, created_at DESC);

-- LISTS
CREATE TABLE list_sections (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL CHECK (domain IN ('inventory', 'orders', 'preplists')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (domain, slug)
);

CREATE INDEX IF NOT EXISTS idx_list_sections_domain
  ON list_sections(domain, slug);

CREATE TABLE list_items (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_checked INTEGER NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  par_count REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (section_id) REFERENCES list_sections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_list_items_section_sort
  ON list_items(section_id, sort_order, created_at);

PRAGMA foreign_keys = ON;
