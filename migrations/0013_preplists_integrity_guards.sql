-- Enforce prep-list numeric integrity at the database layer.
-- For sections in domain='preplists':
--   - amount and par_count must be non-negative integers
--   - is_checked must be 0 or 1

-- Normalize legacy non-integer values before guards are enabled.
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

DROP TRIGGER IF EXISTS trg_preplists_list_items_insert_guard;
CREATE TRIGGER trg_preplists_list_items_insert_guard
BEFORE INSERT ON list_items
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM list_sections s
  WHERE s.id = NEW.section_id
    AND s.domain = 'preplists'
)
BEGIN
  SELECT CASE
    WHEN NEW.amount IS NULL OR NEW.amount < 0 OR NEW.amount != CAST(NEW.amount AS INTEGER)
      THEN RAISE(ABORT, 'preplist amount must be a non-negative integer')
  END;
  SELECT CASE
    WHEN NEW.par_count IS NULL OR NEW.par_count < 0 OR NEW.par_count != CAST(NEW.par_count AS INTEGER)
      THEN RAISE(ABORT, 'preplist par_count must be a non-negative integer')
  END;
  SELECT CASE
    WHEN NEW.is_checked NOT IN (0, 1)
      THEN RAISE(ABORT, 'preplist is_checked must be 0 or 1')
  END;
END;

DROP TRIGGER IF EXISTS trg_preplists_list_items_update_guard;
CREATE TRIGGER trg_preplists_list_items_update_guard
BEFORE UPDATE ON list_items
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM list_sections s
  WHERE s.id = NEW.section_id
    AND s.domain = 'preplists'
)
BEGIN
  SELECT CASE
    WHEN NEW.amount IS NULL OR NEW.amount < 0 OR NEW.amount != CAST(NEW.amount AS INTEGER)
      THEN RAISE(ABORT, 'preplist amount must be a non-negative integer')
  END;
  SELECT CASE
    WHEN NEW.par_count IS NULL OR NEW.par_count < 0 OR NEW.par_count != CAST(NEW.par_count AS INTEGER)
      THEN RAISE(ABORT, 'preplist par_count must be a non-negative integer')
  END;
  SELECT CASE
    WHEN NEW.is_checked NOT IN (0, 1)
      THEN RAISE(ABORT, 'preplist is_checked must be 0 or 1')
  END;
END;
