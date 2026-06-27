-- Backfill tenant attribution for login audit rows that already identify a known user.
-- Unknown-user auth attempts intentionally remain businessless.

UPDATE account_audit_logs
SET business_id = (
  SELECT bu.business_id
  FROM business_users bu
  WHERE bu.user_id = account_audit_logs.target_user_id
    AND COALESCE(bu.is_active, 1) = 1
  ORDER BY
    CASE bu.role
      WHEN 'owner' THEN 0
      WHEN 'manager' THEN 1
      WHEN 'admin' THEN 1
      ELSE 2
    END,
    bu.created_at DESC
  LIMIT 1
)
WHERE business_id IS NULL
  AND target_user_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM business_users bu
    WHERE bu.user_id = account_audit_logs.target_user_id
      AND COALESCE(bu.is_active, 1) = 1
  );
