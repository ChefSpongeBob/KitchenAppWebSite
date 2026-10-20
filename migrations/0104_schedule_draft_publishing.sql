-- Separate manager-only schedule drafts from the published operational schedule.
-- Existing published tables remain in place so employee views, offers, swaps, and
-- reports continue to reference stable shift IDs.

ALTER TABLE schedule_weeks ADD COLUMN draft_initialized INTEGER NOT NULL DEFAULT 0;
ALTER TABLE schedule_weeks ADD COLUMN draft_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE schedule_weeks ADD COLUMN published_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE schedule_weeks ADD COLUMN has_unpublished_changes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE schedule_weeks ADD COLUMN draft_updated_at INTEGER;
ALTER TABLE schedule_weeks ADD COLUMN draft_updated_by TEXT;

CREATE TABLE IF NOT EXISTS schedule_draft_shifts (
  id TEXT PRIMARY KEY,
  week_id TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  department TEXT NOT NULL,
  role TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL,
  end_label TEXT NOT NULL DEFAULT '',
  break_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT NOT NULL,
  FOREIGN KEY (week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedule_draft_week_team (
  week_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT NOT NULL,
  PRIMARY KEY (business_id, week_id, user_id),
  FOREIGN KEY (week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedule_draft_open_shifts (
  id TEXT PRIMARY KEY,
  week_id TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  department TEXT NOT NULL,
  role TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL,
  end_label TEXT NOT NULL DEFAULT '',
  break_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_id TEXT NOT NULL,
  FOREIGN KEY (week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedule_draft_shifts_business_week_date
ON schedule_draft_shifts(business_id, week_id, shift_date, start_time, sort_order);

CREATE INDEX IF NOT EXISTS idx_schedule_draft_shifts_business_user_date
ON schedule_draft_shifts(business_id, user_id, shift_date, start_time);

CREATE INDEX IF NOT EXISTS idx_schedule_draft_week_team_week_sort
ON schedule_draft_week_team(business_id, week_id, sort_order, user_id);

CREATE INDEX IF NOT EXISTS idx_schedule_draft_open_shifts_business_week_date
ON schedule_draft_open_shifts(business_id, week_id, shift_date, start_time, sort_order);

INSERT OR IGNORE INTO schedule_draft_shifts (
  id, week_id, shift_date, user_id, department, role, detail, start_time,
  end_label, break_minutes, notes, sort_order, created_at, updated_at, business_id
)
SELECT
  id, week_id, shift_date, user_id, department, role, detail, start_time,
  end_label, COALESCE(break_minutes, 0), notes, sort_order, created_at, updated_at, business_id
FROM schedule_shifts;

INSERT OR IGNORE INTO schedule_draft_week_team (
  week_id, user_id, sort_order, created_at, updated_at, business_id
)
SELECT week_id, user_id, sort_order, created_at, updated_at, business_id
FROM schedule_week_team;

INSERT OR IGNORE INTO schedule_draft_open_shifts (
  id, week_id, shift_date, department, role, detail, start_time, end_label,
  break_minutes, notes, sort_order, created_at, updated_at, business_id
)
SELECT
  id, week_id, shift_date, department, role, detail, start_time, end_label,
  COALESCE(break_minutes, 0), notes, sort_order, created_at, updated_at, business_id
FROM schedule_open_shifts;

UPDATE schedule_weeks
SET
  draft_initialized = 1,
  draft_version = CASE
    WHEN EXISTS (
      SELECT 1 FROM schedule_draft_shifts draft
      WHERE draft.week_id = schedule_weeks.id AND draft.business_id = schedule_weeks.business_id
    ) OR EXISTS (
      SELECT 1 FROM schedule_draft_open_shifts draft_open
      WHERE draft_open.week_id = schedule_weeks.id AND draft_open.business_id = schedule_weeks.business_id
    ) THEN 1 ELSE 0 END,
  published_version = CASE WHEN status = 'published' THEN 1 ELSE 0 END,
  has_unpublished_changes = 0,
  draft_updated_at = updated_at,
  draft_updated_by = updated_by;
