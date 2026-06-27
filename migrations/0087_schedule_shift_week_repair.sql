-- Repairs schedule shifts that were saved under a week_id whose week_start does
-- not contain the shift_date. This preserves non-duplicate shifts by moving them
-- to the correct business/week and removes only exact duplicates.

INSERT OR IGNORE INTO schedule_weeks (
  id,
  week_start,
  status,
  published_at,
  updated_at,
  updated_by,
  business_id
)
SELECT
  lower(hex(randomblob(16))) AS id,
  repaired.target_week_start,
  'draft',
  NULL,
  unixepoch(),
  NULL,
  repaired.business_id
FROM (
  SELECT DISTINCT
    s.business_id,
    date(s.shift_date, printf('-%d days', (CAST(strftime('%w', s.shift_date) AS INTEGER) + 6) % 7)) AS target_week_start
  FROM schedule_shifts s
  JOIN schedule_weeks current_week
    ON current_week.id = s.week_id
   AND current_week.business_id = s.business_id
  WHERE s.shift_date < current_week.week_start
     OR s.shift_date > date(current_week.week_start, '+6 day')
) repaired
LEFT JOIN schedule_weeks existing_week
  ON existing_week.business_id = repaired.business_id
 AND existing_week.week_start = repaired.target_week_start
WHERE existing_week.id IS NULL;

DELETE FROM schedule_shifts
WHERE id IN (
  SELECT corrupt.id
  FROM schedule_shifts corrupt
  JOIN schedule_weeks current_week
    ON current_week.id = corrupt.week_id
   AND current_week.business_id = corrupt.business_id
  JOIN schedule_weeks target_week
    ON target_week.business_id = corrupt.business_id
   AND target_week.week_start = date(corrupt.shift_date, printf('-%d days', (CAST(strftime('%w', corrupt.shift_date) AS INTEGER) + 6) % 7))
  JOIN schedule_shifts duplicate
    ON duplicate.week_id = target_week.id
   AND duplicate.business_id = corrupt.business_id
   AND duplicate.shift_date = corrupt.shift_date
   AND duplicate.user_id = corrupt.user_id
   AND duplicate.department = corrupt.department
   AND duplicate.role = corrupt.role
   AND COALESCE(duplicate.detail, '') = COALESCE(corrupt.detail, '')
   AND duplicate.start_time = corrupt.start_time
   AND COALESCE(duplicate.end_label, '') = COALESCE(corrupt.end_label, '')
   AND COALESCE(duplicate.break_minutes, 0) = COALESCE(corrupt.break_minutes, 0)
   AND COALESCE(duplicate.notes, '') = COALESCE(corrupt.notes, '')
   AND duplicate.id <> corrupt.id
  WHERE corrupt.shift_date < current_week.week_start
     OR corrupt.shift_date > date(current_week.week_start, '+6 day')
);

UPDATE schedule_shifts
SET
  week_id = (
    SELECT target_week.id
    FROM schedule_weeks target_week
    WHERE target_week.business_id = schedule_shifts.business_id
      AND target_week.week_start = date(schedule_shifts.shift_date, printf('-%d days', (CAST(strftime('%w', schedule_shifts.shift_date) AS INTEGER) + 6) % 7))
    LIMIT 1
  ),
  updated_at = unixepoch()
WHERE id IN (
  SELECT corrupt.id
  FROM schedule_shifts corrupt
  JOIN schedule_weeks current_week
    ON current_week.id = corrupt.week_id
   AND current_week.business_id = corrupt.business_id
  WHERE corrupt.shift_date < current_week.week_start
     OR corrupt.shift_date > date(current_week.week_start, '+6 day')
);

INSERT OR IGNORE INTO schedule_week_team (
  week_id,
  user_id,
  sort_order,
  created_at,
  updated_at,
  business_id
)
SELECT DISTINCT
  s.week_id,
  s.user_id,
  0,
  unixepoch(),
  unixepoch(),
  s.business_id
FROM schedule_shifts s
WHERE NOT EXISTS (
  SELECT 1
  FROM schedule_week_team team
  WHERE team.week_id = s.week_id
    AND team.user_id = s.user_id
    AND team.business_id = s.business_id
);
