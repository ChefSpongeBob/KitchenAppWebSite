-- Scope Daily Highlights editor grants by business and user.
-- Older installs stored one grant per user before tenant hardening added business_id.

CREATE TABLE daily_specials_editors_next (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  granted_by TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, user_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO daily_specials_editors_next (
  business_id,
  user_id,
  granted_by,
  updated_at
)
SELECT
  resolved.business_id,
  resolved.user_id,
  resolved.granted_by,
  resolved.updated_at
FROM (
  SELECT
    COALESCE(
      dse.business_id,
      (
        SELECT bu.business_id
        FROM business_users bu
        WHERE bu.user_id = dse.user_id
        ORDER BY bu.created_at ASC
        LIMIT 1
      )
    ) AS business_id,
    dse.user_id,
    dse.granted_by,
    dse.updated_at
  FROM daily_specials_editors dse
) resolved
WHERE resolved.business_id IS NOT NULL;

DROP TABLE daily_specials_editors;
ALTER TABLE daily_specials_editors_next RENAME TO daily_specials_editors;

CREATE INDEX IF NOT EXISTS idx_daily_specials_editors_business_id
ON daily_specials_editors(business_id);

CREATE INDEX IF NOT EXISTS idx_daily_specials_editors_granted_by
ON daily_specials_editors(granted_by);
