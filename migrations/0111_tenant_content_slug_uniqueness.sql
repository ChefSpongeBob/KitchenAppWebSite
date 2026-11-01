-- Remove legacy cross-tenant slug constraints; preserve IDs, child items, files, and all existing rows.
PRAGMA defer_foreign_keys = ON;

-- DROP TABLE still cascades under deferred checks; restore both dependent item tables in this transaction.
CREATE TABLE _migration0111_checklist_items AS SELECT * FROM checklist_items;
CREATE TABLE _migration0111_list_items AS SELECT * FROM list_items;

CREATE TABLE _migration0111_checklist_sections (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
, business_id TEXT);
INSERT INTO _migration0111_checklist_sections ("id", "slug", "title", "description", "created_at", "updated_at", "business_id") SELECT "id", "slug", "title", "description", "created_at", "updated_at", "business_id" FROM checklist_sections;
DROP TABLE checklist_sections;
ALTER TABLE _migration0111_checklist_sections RENAME TO checklist_sections;
CREATE INDEX idx_checklist_sections_business_id ON checklist_sections(business_id);
CREATE UNIQUE INDEX idx_checklist_sections_business_slug
ON checklist_sections(business_id, slug);

CREATE TABLE _migration0111_list_sections (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL CHECK (domain IN ('inventory', 'orders', 'preplists')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, business_id TEXT
);
INSERT INTO _migration0111_list_sections ("id", "domain", "slug", "title", "description", "created_at", "updated_at", "business_id") SELECT "id", "domain", "slug", "title", "description", "created_at", "updated_at", "business_id" FROM list_sections;
DROP TABLE list_sections;
ALTER TABLE _migration0111_list_sections RENAME TO list_sections;
CREATE UNIQUE INDEX idx_list_sections_business_domain_slug
ON list_sections(business_id, domain, slug);
CREATE INDEX idx_list_sections_business_id ON list_sections(business_id);
CREATE INDEX idx_list_sections_domain
  ON list_sections(domain, slug);

CREATE TABLE _migration0111_documents (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  section TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
, business_id TEXT);
INSERT INTO _migration0111_documents ("id", "slug", "title", "section", "category", "content", "file_url", "is_active", "created_at", "updated_at", "business_id") SELECT "id", "slug", "title", "section", "category", "content", "file_url", "is_active", "created_at", "updated_at", "business_id" FROM documents;
DROP TABLE documents;
ALTER TABLE _migration0111_documents RENAME TO documents;
CREATE INDEX idx_documents_business_active_group
ON documents(business_id, is_active, section, category, title);
CREATE INDEX idx_documents_business_file_url
ON documents(business_id, file_url);
CREATE INDEX idx_documents_business_id ON documents(business_id);
CREATE UNIQUE INDEX idx_documents_business_slug_active
ON documents(business_id, slug);
CREATE INDEX idx_documents_section_category
  ON documents(section, category);

INSERT INTO checklist_items ("id", "section_id", "content", "sort_order", "is_checked", "created_at", "updated_at", "business_id") SELECT "id", "section_id", "content", "sort_order", "is_checked", "created_at", "updated_at", "business_id" FROM _migration0111_checklist_items;
DROP TABLE _migration0111_checklist_items;

INSERT INTO list_items ("id", "section_id", "content", "sort_order", "is_checked", "amount", "par_count", "created_at", "updated_at", "amount_text", "details", "business_id") SELECT "id", "section_id", "content", "sort_order", "is_checked", "amount", "par_count", "created_at", "updated_at", "amount_text", "details", "business_id" FROM _migration0111_list_items;
DROP TABLE _migration0111_list_items;
