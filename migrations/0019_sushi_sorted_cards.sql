UPDATE list_items
SET sort_order = sort_order + 2,
    updated_at = strftime('%s','now')
WHERE section_id IN (
  SELECT id
  FROM list_sections
  WHERE domain = 'preplists' AND slug = 'veg'
)
AND NOT EXISTS (
  SELECT 1 FROM list_items WHERE id = 'pli-veg-sort-avocados'
);

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-veg-sort-avocados', id, 'Avocados', 1, 0, 0, 0, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'veg'
  AND NOT EXISTS (
    SELECT 1 FROM list_items WHERE id = 'pli-veg-sort-avocados'
  );

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-veg-sort-mangos', id, 'Mangos', 2, 0, 0, 0, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'veg'
  AND NOT EXISTS (
    SELECT 1 FROM list_items WHERE id = 'pli-veg-sort-mangos'
  );
