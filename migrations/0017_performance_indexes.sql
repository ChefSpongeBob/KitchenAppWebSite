CREATE INDEX IF NOT EXISTS idx_temps_ts_desc
  ON temps(ts DESC);

CREATE INDEX IF NOT EXISTS idx_todo_assignments_todo_id
  ON todo_assignments(todo_id);

CREATE INDEX IF NOT EXISTS idx_todo_log_completed_by_completed_at
  ON todo_completion_log(completed_by, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_whiteboard_votes_user_id
  ON whiteboard_votes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_specials_editors_granted_by
  ON daily_specials_editors(granted_by);
