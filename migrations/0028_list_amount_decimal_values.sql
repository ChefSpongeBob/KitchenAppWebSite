-- Crimini launch: decimal list values are handled by app validation.
-- Trigger-based guards are intentionally not used here because D1 migration execution
-- does not reliably apply multi-statement trigger bodies from the migration runner.

UPDATE list_items
SET amount = COALESCE(amount, 0),
    par_count = COALESCE(par_count, 0),
    is_checked = CASE WHEN COALESCE(is_checked, 0) = 1 THEN 1 ELSE 0 END
WHERE section_id IN (
  SELECT id FROM list_sections WHERE domain IN ('preplists', 'inventory', 'orders')
);
