ALTER TABLE checklist_sections ADD COLUMN last_completed_run_id TEXT;
ALTER TABLE checklist_items ADD COLUMN completed_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE checklist_items ADD COLUMN completed_at INTEGER;
ALTER TABLE list_items ADD COLUMN completed_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE list_items ADD COLUMN completed_at INTEGER;
ALTER TABLE list_submission_batches ADD COLUMN submitted_by_name_snapshot TEXT;
ALTER TABLE list_submission_items ADD COLUMN completed_by_name_snapshot TEXT;
ALTER TABLE list_submission_items ADD COLUMN completed_at INTEGER;

CREATE TABLE checklist_completed_runs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  section_title_snapshot TEXT NOT NULL,
  submitted_by_name_snapshot TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  UNIQUE (id, business_id)
);

CREATE TABLE checklist_completed_run_items (
  run_id TEXT NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_name_snapshot TEXT NOT NULL,
  completed_by_name_snapshot TEXT NOT NULL,
  completed_at INTEGER,
  PRIMARY KEY (run_id, business_id, item_id),
  FOREIGN KEY (run_id, business_id) REFERENCES checklist_completed_runs(id, business_id) ON DELETE CASCADE
);

CREATE INDEX idx_checklist_runs_business_submitted ON checklist_completed_runs(business_id, submitted_at DESC);
CREATE INDEX idx_checklist_runs_expiry ON checklist_completed_runs(submitted_at);
CREATE INDEX idx_checklist_activity_expiry ON list_item_activity_events(occurred_at) WHERE domain = 'checklists';
CREATE INDEX idx_list_submission_batches_business_time ON list_submission_batches(business_id, domain, submitted_at DESC);
CREATE INDEX idx_schedule_availability_requests_business_updated ON user_schedule_availability_requests(business_id, updated_at DESC);
