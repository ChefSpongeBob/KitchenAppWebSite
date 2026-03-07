-- Replace Veg prep list items and par counts with current operational set.

DELETE FROM list_items
WHERE section_id IN (
  SELECT id
  FROM list_sections
  WHERE domain = 'preplists' AND slug = 'veg'
);

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-veg-negi', id, 'Negi', 1, 0, 0, 2, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'veg';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-veg-shiraga-negi', id, 'Shiraga Negi', 2, 0, 0, 2, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'veg';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-veg-cucumbers', id, 'Cucumbers', 3, 0, 0, 3, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'veg';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-veg-mangos', id, 'Mangos', 4, 0, 0, 7, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'veg';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-veg-jalapenos', id, 'Jalapenos', 5, 0, 0, 7, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'veg';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-veg-carrots', id, 'Carrots', 6, 0, 0, 5, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'veg';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-veg-creamcheese', id, 'CreamCheese', 7, 0, 0, 2, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'veg';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-veg-wonton-crunchies', id, 'Wonton Crunchies', 8, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'veg';
