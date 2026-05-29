CREATE TABLE IF NOT EXISTS item_attachments (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_item_attachments_unique
ON item_attachments(business_id, source_type, source_item_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_item_attachments_source
ON item_attachments(business_id, source_type, source_item_id);

CREATE INDEX IF NOT EXISTS idx_item_attachments_target
ON item_attachments(business_id, target_type, target_id);
