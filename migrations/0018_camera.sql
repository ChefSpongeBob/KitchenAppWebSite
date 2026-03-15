CREATE TABLE IF NOT EXISTS camera_events (
  id TEXT PRIMARY KEY,
  camera_id TEXT,
  camera_name TEXT,
  event_type TEXT,
  payload_json TEXT,
  image_url TEXT,
  clip_url TEXT,
  clip_duration_seconds INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_camera_events_created_at
ON camera_events(created_at DESC);

CREATE TABLE IF NOT EXISTS camera_sources (
  id TEXT PRIMARY KEY,
  camera_id TEXT UNIQUE,
  name TEXT NOT NULL,
  live_url TEXT,
  preview_image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_camera_sources_is_active
ON camera_sources(is_active, updated_at DESC);
