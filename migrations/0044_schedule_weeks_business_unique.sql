-- Allow each business to have its own schedule for the same week.
-- The original schedule_weeks table made week_start globally unique, which blocks
-- multi-business scheduling. Rebuild only this table so uniqueness is scoped by
-- business_id while preserving existing week ids referenced by shifts/team rows.

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS schedule_weeks_new;

CREATE TABLE schedule_weeks_new (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at INTEGER,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  business_id TEXT NOT NULL DEFAULT '',
  UNIQUE (business_id, week_start),
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO schedule_weeks_new (
  id,
  week_start,
  status,
  published_at,
  updated_at,
  updated_by,
  business_id
)
SELECT
  id,
  week_start,
  status,
  published_at,
  updated_at,
  updated_by,
  ''
FROM schedule_weeks;

DROP TABLE IF EXISTS schedule_weeks;
ALTER TABLE schedule_weeks_new RENAME TO schedule_weeks;

CREATE INDEX IF NOT EXISTS idx_schedule_weeks_week_start
ON schedule_weeks(business_id, week_start, status);

CREATE INDEX IF NOT EXISTS idx_schedule_weeks_business_id
ON schedule_weeks(business_id);

PRAGMA foreign_keys = ON;
