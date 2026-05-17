-- Ensure existing businesses keep the default restaurant schedule departments.
-- This repairs workspaces that only had one department row after early cleanup/testing.

INSERT OR IGNORE INTO schedule_departments (
  id,
  business_id,
  name,
  sort_order,
  is_active,
  created_at,
  updated_at
)
SELECT
  lower(hex(randomblob(4))) || '-' ||
    lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    lower(hex(randomblob(6))),
  b.id,
  defaults.name,
  defaults.sort_order,
  1,
  strftime('%s', 'now'),
  strftime('%s', 'now')
FROM businesses b
CROSS JOIN (
  SELECT 'FOH' AS name, 0 AS sort_order
  UNION ALL SELECT 'BOH', 1
  UNION ALL SELECT 'Management', 2
) defaults;
