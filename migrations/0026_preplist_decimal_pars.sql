-- Allow decimal par counts on prep lists while keeping prep amounts as whole numbers.

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
      THEN RAISE(ABORT, 'preplist amount must be a non-negative whole number')
  END;
  SELECT CASE
    WHEN NEW.par_count IS NULL OR NEW.par_count < 0
      THEN RAISE(ABORT, 'preplist par_count must be a non-negative number')
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
      THEN RAISE(ABORT, 'preplist amount must be a non-negative whole number')
  END;
  SELECT CASE
    WHEN NEW.par_count IS NULL OR NEW.par_count < 0
      THEN RAISE(ABORT, 'preplist par_count must be a non-negative number')
  END;
  SELECT CASE
    WHEN NEW.is_checked NOT IN (0, 1)
      THEN RAISE(ABORT, 'preplist is_checked must be 0 or 1')
  END;
END;
