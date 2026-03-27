CREATE TABLE IF NOT EXISTS checklist_sections (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_checked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (section_id) REFERENCES checklist_sections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_section_sort
  ON checklist_items(section_id, sort_order, created_at);

INSERT INTO checklist_sections (id, slug, title, description, created_at, updated_at)
SELECT 'checklists-sushi-prep', 'sushi-prep', 'Sushi Prep Checklist', 'Opening, mid day, and closing checks.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_sections WHERE slug = 'sushi-prep');

INSERT INTO checklist_sections (id, slug, title, description, created_at, updated_at)
SELECT 'checklists-sushi', 'sushi', 'Sushi Checklist', 'Opening, mid day, and closing checks.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_sections WHERE slug = 'sushi');

INSERT INTO checklist_sections (id, slug, title, description, created_at, updated_at)
SELECT 'checklists-kitchen', 'kitchen', 'Kitchen Checklist', 'Opening, mid day, and closing checks.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_sections WHERE slug = 'kitchen');

INSERT INTO checklist_items (id, section_id, content, sort_order, is_checked, created_at, updated_at)
SELECT 'checklists-sushi-prep-opening', 'checklists-sushi-prep', 'Opening', 0, 0, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_items WHERE id = 'checklists-sushi-prep-opening');

INSERT INTO checklist_items (id, section_id, content, sort_order, is_checked, created_at, updated_at)
SELECT 'checklists-sushi-prep-midday', 'checklists-sushi-prep', 'Mid Day', 1, 0, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_items WHERE id = 'checklists-sushi-prep-midday');

INSERT INTO checklist_items (id, section_id, content, sort_order, is_checked, created_at, updated_at)
SELECT 'checklists-sushi-prep-closing', 'checklists-sushi-prep', 'Closing', 2, 0, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_items WHERE id = 'checklists-sushi-prep-closing');

INSERT INTO checklist_items (id, section_id, content, sort_order, is_checked, created_at, updated_at)
SELECT 'checklists-sushi-opening', 'checklists-sushi', 'Opening', 0, 0, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_items WHERE id = 'checklists-sushi-opening');

INSERT INTO checklist_items (id, section_id, content, sort_order, is_checked, created_at, updated_at)
SELECT 'checklists-sushi-midday', 'checklists-sushi', 'Mid Day', 1, 0, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_items WHERE id = 'checklists-sushi-midday');

INSERT INTO checklist_items (id, section_id, content, sort_order, is_checked, created_at, updated_at)
SELECT 'checklists-sushi-closing', 'checklists-sushi', 'Closing', 2, 0, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_items WHERE id = 'checklists-sushi-closing');

INSERT INTO checklist_items (id, section_id, content, sort_order, is_checked, created_at, updated_at)
SELECT 'checklists-kitchen-opening', 'checklists-kitchen', 'Opening', 0, 0, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_items WHERE id = 'checklists-kitchen-opening');

INSERT INTO checklist_items (id, section_id, content, sort_order, is_checked, created_at, updated_at)
SELECT 'checklists-kitchen-midday', 'checklists-kitchen', 'Mid Day', 1, 0, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_items WHERE id = 'checklists-kitchen-midday');

INSERT INTO checklist_items (id, section_id, content, sort_order, is_checked, created_at, updated_at)
SELECT 'checklists-kitchen-closing', 'checklists-kitchen', 'Closing', 2, 0, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_items WHERE id = 'checklists-kitchen-closing');
