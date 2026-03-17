UPDATE list_items
SET sort_order = sort_order + 1,
    updated_at = strftime('%s','now')
WHERE section_id IN (
  SELECT id
  FROM list_sections
  WHERE domain = 'preplists' AND slug = 'veg'
)
AND sort_order >= 5
AND NOT EXISTS (
  SELECT 1 FROM list_items WHERE id = 'pli-veg-broads'
);

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-veg-broads', id, 'Broads', 5, 0, 0, 6, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'veg'
  AND NOT EXISTS (
    SELECT 1 FROM list_items WHERE id = 'pli-veg-broads'
  );

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-veg-pickled-shallots', id, 'Pickled Shallots', 12, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'veg'
  AND NOT EXISTS (
    SELECT 1 FROM list_items WHERE id = 'pli-veg-pickled-shallots'
  );
