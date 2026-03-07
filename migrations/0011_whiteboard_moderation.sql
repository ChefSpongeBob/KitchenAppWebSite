-- Whiteboard moderation workflow (pending / approved / rejected).

CREATE TABLE IF NOT EXISTS whiteboard_review (
  post_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
  reviewed_by TEXT,
  reviewed_at INTEGER,
  FOREIGN KEY (post_id) REFERENCES whiteboard_posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_whiteboard_review_status
  ON whiteboard_review(status);
