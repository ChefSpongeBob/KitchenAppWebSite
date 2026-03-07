-- Repair migration for early schema with UNIQUE slug on list_sections

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS list_sections_new;

CREATE TABLE list_sections_new (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL CHECK (domain IN ('inventory', 'orders', 'preplists')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (domain, slug)
);

INSERT OR IGNORE INTO list_sections_new (id, domain, slug, title, description, created_at, updated_at)
SELECT id, domain, slug, title, description, created_at, updated_at
FROM list_sections;

DROP TABLE IF EXISTS list_sections;
ALTER TABLE list_sections_new RENAME TO list_sections;

CREATE INDEX IF NOT EXISTS idx_list_sections_domain
  ON list_sections(domain, slug);

-- Ensure seed sections exist across domains
INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'inventory-foh', 'inventory', 'foh', 'FOH Inventory', 'Front of house supplies and stock.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE domain = 'inventory' AND slug = 'foh');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'inventory-kitchen', 'inventory', 'kitchen', 'Kitchen Inventory', 'Kitchen stock tracking.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE domain = 'inventory' AND slug = 'kitchen');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'inventory-sushi', 'inventory', 'sushi', 'Sushi Inventory', 'Sushi bar inventory.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE domain = 'inventory' AND slug = 'sushi');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'orders-sysco', 'orders', 'sysco', 'Sysco', 'Open Sysco ordering.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE domain = 'orders' AND slug = 'sysco');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'orders-sfotw', 'orders', 'sfotw', 'SFOTW', 'Specials / order of the week.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE domain = 'orders' AND slug = 'sfotw');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'orders-order1', 'orders', 'order1', 'Order Sheet 1', 'Primary order list.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE domain = 'orders' AND slug = 'order1');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'orders-order2', 'orders', 'order2', 'Order Sheet 2', 'Secondary order list.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE domain = 'orders' AND slug = 'order2');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'orders-order3', 'orders', 'order3', 'Order Sheet 3', 'Additional ordering.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE domain = 'orders' AND slug = 'order3');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'preplists-sushi', 'preplists', 'sushi', 'Sushi Prep', 'Full sushi prep checklist.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE domain = 'preplists' AND slug = 'sushi');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'preplists-veg', 'preplists', 'veg', 'Veg Prep', 'Vegetable prep checklist.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE domain = 'preplists' AND slug = 'veg');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'preplists-kitchen', 'preplists', 'kitchen', 'Kitchen Prep', 'Daily kitchen setup and prep tasks.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE domain = 'preplists' AND slug = 'kitchen');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'preplists-fish', 'preplists', 'fish', 'Fish Prep', 'Fish cutting and opener duties.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE domain = 'preplists' AND slug = 'fish');

PRAGMA foreign_keys = ON;
