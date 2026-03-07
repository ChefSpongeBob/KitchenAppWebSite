import type { PageServerLoad } from './$types';

type DocRow = {
  id: string;
  slug: string;
  title: string;
  section: string;
  category: string;
  content: string | null;
  file_url: string | null;
};

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { docs: [] };

  const result = await db
    .prepare(
      `
      SELECT id, slug, title, section, category, content, file_url
      FROM documents
      WHERE is_active = 1
      ORDER BY section ASC, category ASC, title ASC
    `
    )
    .all<DocRow>();

  return {
    docs: result.results ?? []
  };
};
