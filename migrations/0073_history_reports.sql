CREATE TABLE IF NOT EXISTS list_submission_batches (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('preplists', 'inventory', 'orders')),
  section_id TEXT NOT NULL,
  section_title_snapshot TEXT NOT NULL,
  submitted_by TEXT,
  submitted_at INTEGER NOT NULL,
  business_day TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS list_submission_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name_snapshot TEXT NOT NULL,
  details_snapshot TEXT,
  submitted_value TEXT NOT NULL DEFAULT '',
  par_count_snapshot REAL NOT NULL DEFAULT 0,
  is_checked_snapshot INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (batch_id) REFERENCES list_submission_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS list_item_activity_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('preplists', 'inventory', 'orders', 'checklists')),
  section_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name_snapshot TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id TEXT,
  occurred_at INTEGER NOT NULL,
  value_snapshot TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS schedule_publish_history (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  schedule_week_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  published_by TEXT,
  published_at INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS schedule_shift_history (
  id TEXT PRIMARY KEY,
  publish_history_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  shift_id_snapshot TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  user_id TEXT,
  employee_name_snapshot TEXT NOT NULL,
  department TEXT NOT NULL,
  role_name TEXT NOT NULL,
  detail TEXT,
  start_time TEXT NOT NULL,
  end_label TEXT,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (publish_history_id) REFERENCES schedule_publish_history(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_list_submission_batches_business_day
ON list_submission_batches(business_id, domain, business_day, submitted_at);

CREATE INDEX IF NOT EXISTS idx_list_submission_items_batch
ON list_submission_items(batch_id, business_id);

CREATE INDEX IF NOT EXISTS idx_list_item_activity_business_time
ON list_item_activity_events(business_id, domain, occurred_at);

CREATE INDEX IF NOT EXISTS idx_schedule_publish_history_week
ON schedule_publish_history(business_id, week_start, version_number);

CREATE INDEX IF NOT EXISTS idx_schedule_shift_history_publish
ON schedule_shift_history(publish_history_id, business_id, shift_date);
