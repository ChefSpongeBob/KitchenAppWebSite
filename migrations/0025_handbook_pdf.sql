INSERT INTO documents (id, slug, title, section, category, content, file_url, is_active, created_at, updated_at)
VALUES (
  'doc-handbook',
  'handbook',
  'Handbook',
  'Docs',
  'Operations',
  'Kitchen handbook and team standards.',
  '/files/employee-handbook-2026.pdf',
  1,
  strftime('%s','now'),
  strftime('%s','now')
)
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  section = excluded.section,
  category = excluded.category,
  file_url = excluded.file_url,
  is_active = excluded.is_active,
  updated_at = strftime('%s','now');
