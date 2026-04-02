ALTER TABLE list_items ADD COLUMN amount_text TEXT NOT NULL DEFAULT '';

UPDATE list_items
SET amount_text = CASE
  WHEN section_id IN (
    SELECT id FROM list_sections WHERE domain = 'preplists'
  ) THEN CAST(amount AS TEXT)
  ELSE amount_text
END;
