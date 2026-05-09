-- Normalize prep-list numeric values before production launch.
-- Trigger-based guards are intentionally not used here because D1 migration execution
-- does not reliably apply multi-statement trigger bodies from the migration runner.

UPDATE list_items
SET amount = CAST(ROUND(COALESCE(amount, 0)) AS INTEGER)
WHERE section_id IN (
  SELECT id FROM list_sections WHERE domain = 'preplists'
);

UPDATE list_items
SET par_count = CAST(ROUND(COALESCE(par_count, 0)) AS INTEGER)
WHERE section_id IN (
  SELECT id FROM list_sections WHERE domain = 'preplists'
);

UPDATE list_items
SET is_checked = CASE WHEN COALESCE(is_checked, 0) = 1 THEN 1 ELSE 0 END
WHERE section_id IN (
  SELECT id FROM list_sections WHERE domain = 'preplists'
);
