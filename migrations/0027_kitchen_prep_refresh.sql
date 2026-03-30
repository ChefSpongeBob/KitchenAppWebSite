-- Replace placeholder kitchen prep items with the current kitchen prep list.

DELETE FROM list_items
WHERE section_id = (
  SELECT id
  FROM list_sections
  WHERE domain = 'preplists' AND slug = 'kitchen'
  LIMIT 1
);

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-calamari', id, 'calamari', 1, 0, 0, 5, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-panko-chicken', id, 'panko chicken', 2, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-panko-chicken-roll', id, 'panko chicken (roll)', 3, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-wontons', id, 'wontons', 4, 0, 0, 6, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-wonton-filling', id, 'wonton filling', 5, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-ramen-noodles', id, 'ramen noodles', 6, 0, 0, 4, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-soy-egg-bags', id, 'soy egg bags', 7, 0, 0, 4, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-ramen-broth', id, 'ramen broth', 8, 0, 0, 12, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-beef-noodle-pan', id, 'beef noodle 1/3 pan', 9, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-chips', id, 'chips', 10, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-shells', id, 'shells', 11, 0, 0, 2, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-narutomakis-short', id, 'narutomakis short 1/6 pan', 12, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-temp-veggies-each', id, 'temp veggies each', 13, 0, 0, 1.5, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-temp-veggie-bags', id, 'temp veggie bags', 14, 0, 0, 3, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-miso-kits', id, 'miso kits', 15, 0, 0, 2, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-half-miso-kits', id, 'half miso kits', 16, 0, 0, 2, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-miso-balls', id, 'miso balls', 17, 0, 0, 2, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-half-miso-balls', id, 'half miso balls', 18, 0, 0, 2, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-crispy-rice', id, 'crispy rice', 19, 0, 0, 6, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-tofu', id, 'tofu', 20, 0, 0, 2, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-shrimp', id, 'shrimp', 21, 0, 0, 6, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-crab', id, 'crab', 22, 0, 0, 4, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-scallop', id, 'scallop', 23, 0, 0, 2, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-pickled-red-onions', id, 'pickled red onions', 24, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-bok-choy-shallow', id, 'bok choy shallow 1/3', 25, 0, 0, 0.5, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-slaw-veg', id, 'slaw veg', 26, 0, 0, 4, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-limes', id, 'limes', 27, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-lemons', id, 'lemons', 28, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-edamame', id, 'edamame', 29, 0, 0, 10, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-greens', id, 'greens', 30, 0, 0, 7, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-doubanjiang-paste', id, 'doubanjiang paste', 31, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-eel-sauce', id, 'eel sauce', 32, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';

INSERT INTO list_items (id, section_id, content, sort_order, is_checked, amount, par_count, created_at, updated_at)
SELECT 'pli-kitchen-chili-oil', id, 'chili oil', 33, 0, 0, 1, strftime('%s','now'), strftime('%s','now')
FROM list_sections
WHERE domain = 'preplists' AND slug = 'kitchen';
