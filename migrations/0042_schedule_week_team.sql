CREATE TABLE IF NOT EXISTS schedule_week_team (
  week_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (week_id, user_id),
  FOREIGN KEY (week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedule_week_team_week_sort
ON schedule_week_team(week_id, sort_order, user_id);
