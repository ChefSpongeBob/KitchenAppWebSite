-- Domain content tables: documents, whiteboard, and structured lists

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  section TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_section_category
  ON documents(section, category);

CREATE TABLE IF NOT EXISTS whiteboard_posts (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  votes INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_whiteboard_votes
  ON whiteboard_posts(votes DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS list_sections (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL CHECK (domain IN ('inventory', 'orders', 'preplists')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (domain, slug)
);

CREATE INDEX IF NOT EXISTS idx_list_sections_domain
  ON list_sections(domain, slug);

CREATE TABLE IF NOT EXISTS list_items (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_checked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (section_id) REFERENCES list_sections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_list_items_section_sort
  ON list_items(section_id, sort_order, created_at);

-- Seed starter documents if missing
INSERT INTO documents (id, slug, title, section, category, content, file_url, is_active, created_at, updated_at)
SELECT 'doc-about', 'about', 'About', 'Docs', 'General', 'About this kitchen operations app.', '/docs/about', 1, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM documents WHERE slug = 'about');

INSERT INTO documents (id, slug, title, section, category, content, file_url, is_active, created_at, updated_at)
SELECT 'doc-handbook', 'handbook', 'Handbook', 'Docs', 'Operations', 'Kitchen handbook and team standards.', '/docs/handbook', 1, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM documents WHERE slug = 'handbook');

INSERT INTO documents (id, slug, title, section, category, content, file_url, is_active, created_at, updated_at)
SELECT 'doc-sop', 'sop', 'SOP', 'Docs', 'Standards', 'Standard operating procedures.', '/docs/sop', 1, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM documents WHERE slug = 'sop');

-- Seed whiteboard ideas if empty
INSERT INTO whiteboard_posts (id, content, votes, created_at, updated_at)
SELECT 'idea-late-night', 'Late-night menu', 12, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM whiteboard_posts);

INSERT INTO whiteboard_posts (id, content, votes, created_at, updated_at)
SELECT 'idea-sauce-kits', 'Prep sauce kits', 3, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM whiteboard_posts WHERE id = 'idea-sauce-kits');

INSERT INTO whiteboard_posts (id, content, votes, created_at, updated_at)
SELECT 'idea-mango-crab', 'Mango crab roll', 8, strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM whiteboard_posts WHERE id = 'idea-mango-crab');

-- Seed list sections
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
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE id = 'orders-sysco');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'orders-sfotw', 'orders', 'sfotw', 'SFOTW', 'Specials / order of the week.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE id = 'orders-sfotw');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'orders-order1', 'orders', 'order1', 'Order Sheet 1', 'Primary order list.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE id = 'orders-order1');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'orders-order2', 'orders', 'order2', 'Order Sheet 2', 'Secondary order list.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE id = 'orders-order2');

INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at)
SELECT 'orders-order3', 'orders', 'order3', 'Order Sheet 3', 'Additional ordering.', strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM list_sections WHERE id = 'orders-order3');

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
