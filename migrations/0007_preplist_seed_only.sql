-- Seed-only migration for preplist items.
-- Use after hard repair (0006) when amount/par_count columns already exist.

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-rice', 'preplists-kitchen', 'Sushi rice', 1, 0, 0, 2, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'pli-kitchen-rice');

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-stock', 'preplists-kitchen', 'Soup stock', 2, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'pli-kitchen-stock');

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-fish-salmon', 'preplists-fish', 'Salmon fillets', 1, 0, 0, 8, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'pli-fish-salmon');

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-fish-tuna', 'preplists-fish', 'Tuna blocks', 2, 0, 0, 6, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'pli-fish-tuna');

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-veg-avocado', 'preplists-veg', 'Avocados', 1, 0, 0, 12, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'pli-veg-avocado');

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-veg-cucumber', 'preplists-veg', 'Cucumbers', 2, 0, 0, 10, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'pli-veg-cucumber');

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-sushi-nori', 'preplists-sushi', 'Nori packs', 1, 0, 0, 4, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'pli-sushi-nori');

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-sushi-wasabi', 'preplists-sushi', 'Wasabi tubs', 2, 0, 0, 3, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'pli-sushi-wasabi');
