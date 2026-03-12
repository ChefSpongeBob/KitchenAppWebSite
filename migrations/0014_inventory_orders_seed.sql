INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'inventory-foh-1', 'inventory-foh', 'Takeout chopsticks', 0, 0, 0, 8, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE section_id = 'inventory-foh');
INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'inventory-foh-2', 'inventory-foh', 'Soy sauce bottles', 1, 0, 0, 12, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'inventory-foh-2');
INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'inventory-foh-3', 'inventory-foh', 'Kids cups', 2, 0, 0, 16, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'inventory-foh-3');

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'inventory-kitchen-1', 'inventory-kitchen', 'Panko cases', 0, 0, 0, 4, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE section_id = 'inventory-kitchen');
INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'inventory-kitchen-2', 'inventory-kitchen', 'Tempura flour', 1, 0, 0, 6, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'inventory-kitchen-2');
INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'inventory-kitchen-3', 'inventory-kitchen', 'Rice bags', 2, 0, 0, 10, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'inventory-kitchen-3');

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'inventory-sushi-1', 'inventory-sushi', 'Nori packs', 0, 0, 0, 12, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE section_id = 'inventory-sushi');
INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'inventory-sushi-2', 'inventory-sushi', 'Masago tubs', 1, 0, 0, 6, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'inventory-sushi-2');
INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'inventory-sushi-3', 'inventory-sushi', 'Spicy mayo bottles', 2, 0, 0, 8, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'inventory-sushi-3');

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'orders-sysco-1', 'orders-sysco', 'Chicken cases', 0, 0, 0, 4, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE section_id = 'orders-sysco');
INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'orders-sysco-2', 'orders-sysco', 'Avocado cases', 1, 0, 0, 3, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'orders-sysco-2');

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'orders-sfotw-1', 'orders-sfotw', 'Promo fish cut', 0, 0, 0, 2, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE section_id = 'orders-sfotw');
INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'orders-sfotw-2', 'orders-sfotw', 'Seasonal garnish', 1, 0, 0, 3, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'orders-sfotw-2');

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'orders-order1-1', 'orders-order1', 'Salmon cases', 0, 0, 0, 5, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE section_id = 'orders-order1');
INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'orders-order1-2', 'orders-order1', 'Tuna cases', 1, 0, 0, 4, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'orders-order1-2');

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'orders-order2-1', 'orders-order2', 'Ebi boxes', 0, 0, 0, 2, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE section_id = 'orders-order2');
INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'orders-order2-2', 'orders-order2', 'Seaweed salad tubs', 1, 0, 0, 3, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'orders-order2-2');

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'orders-order3-1', 'orders-order3', 'Disposable lids', 0, 0, 0, 6, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE section_id = 'orders-order3');
INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'orders-order3-2', 'orders-order3', 'Sake bottles', 1, 0, 0, 3, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_items WHERE id = 'orders-order3-2');
