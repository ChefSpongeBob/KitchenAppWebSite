CREATE INDEX idx_events_platform_staff_recent
  ON operational_events(delivery_status, created_at DESC, id DESC, business_id);

CREATE TABLE platform_support_requests (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  requester_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  submission_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('customer', 'staff')),
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 160),
  category TEXT NOT NULL CHECK (category IN ('application', 'accounts', 'billing', 'equipment', 'installation', 'feedback')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting', 'closed')),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (business_id, created_by, submission_id),
  UNIQUE (business_id, id)
);
CREATE INDEX idx_support_status_recent ON platform_support_requests(status, updated_at DESC, id DESC);
CREATE INDEX idx_support_recent ON platform_support_requests(updated_at DESC, id DESC);
CREATE INDEX idx_support_active_recent ON platform_support_requests(updated_at DESC, id DESC) WHERE status IN ('open', 'waiting');
CREATE INDEX idx_support_business_recent ON platform_support_requests(business_id, updated_at DESC, id DESC);
CREATE INDEX idx_support_requester_recent ON platform_support_requests(business_id, requester_user_id, updated_at DESC, id DESC);

CREATE TABLE platform_support_messages (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('customer', 'staff')),
  visibility TEXT NOT NULL CHECK (visibility IN ('customer', 'internal')),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (business_id, request_id) REFERENCES platform_support_requests(business_id, id) ON DELETE CASCADE,
  CHECK (author_type = 'staff' OR visibility = 'customer')
);
CREATE INDEX idx_support_messages_recent ON platform_support_messages(business_id, request_id, created_at DESC, id DESC);
CREATE INDEX idx_support_messages_customer ON platform_support_messages(business_id, request_id, visibility, created_at DESC, id DESC);
