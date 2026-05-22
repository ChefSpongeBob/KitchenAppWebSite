-- Allow business-scoped non-admin announcement editors.

CREATE TABLE IF NOT EXISTS announcement_editors (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  granted_by TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, user_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_announcement_editors_business_id
ON announcement_editors(business_id);

CREATE INDEX IF NOT EXISTS idx_announcement_editors_granted_by
ON announcement_editors(granted_by);
