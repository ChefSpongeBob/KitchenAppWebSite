INSERT INTO checklist_sections (id, slug, title, description, created_at, updated_at)
SELECT 'checklists-sushi-prep-opening', 'sushi-prep-opening', 'Sushi Prep Opening Checklist', 'Opening checklist tasks.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_sections WHERE slug = 'sushi-prep-opening');

INSERT INTO checklist_sections (id, slug, title, description, created_at, updated_at)
SELECT 'checklists-sushi-prep-midday', 'sushi-prep-midday', 'Sushi Prep Mid Day Checklist', 'Mid day checklist tasks.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_sections WHERE slug = 'sushi-prep-midday');

INSERT INTO checklist_sections (id, slug, title, description, created_at, updated_at)
SELECT 'checklists-sushi-prep-closing', 'sushi-prep-closing', 'Sushi Prep Closing Checklist', 'Closing checklist tasks.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_sections WHERE slug = 'sushi-prep-closing');

INSERT INTO checklist_sections (id, slug, title, description, created_at, updated_at)
SELECT 'checklists-sushi-opening', 'sushi-opening', 'Sushi Opening Checklist', 'Opening checklist tasks.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_sections WHERE slug = 'sushi-opening');

INSERT INTO checklist_sections (id, slug, title, description, created_at, updated_at)
SELECT 'checklists-sushi-midday', 'sushi-midday', 'Sushi Mid Day Checklist', 'Mid day checklist tasks.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_sections WHERE slug = 'sushi-midday');

INSERT INTO checklist_sections (id, slug, title, description, created_at, updated_at)
SELECT 'checklists-sushi-closing', 'sushi-closing', 'Sushi Closing Checklist', 'Closing checklist tasks.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_sections WHERE slug = 'sushi-closing');

INSERT INTO checklist_sections (id, slug, title, description, created_at, updated_at)
SELECT 'checklists-kitchen-opening', 'kitchen-opening', 'Kitchen Opening Checklist', 'Opening checklist tasks.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_sections WHERE slug = 'kitchen-opening');

INSERT INTO checklist_sections (id, slug, title, description, created_at, updated_at)
SELECT 'checklists-kitchen-midday', 'kitchen-midday', 'Kitchen Mid Day Checklist', 'Mid day checklist tasks.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_sections WHERE slug = 'kitchen-midday');

INSERT INTO checklist_sections (id, slug, title, description, created_at, updated_at)
SELECT 'checklists-kitchen-closing', 'kitchen-closing', 'Kitchen Closing Checklist', 'Closing checklist tasks.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM checklist_sections WHERE slug = 'kitchen-closing');
