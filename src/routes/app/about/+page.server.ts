import type { PageServerLoad } from './$types';

type DocRow = {
  title: string;
  content: string | null;
  file_url: string | null;
  category: string;
};

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { doc: null };
  const businessId = locals.businessId ?? '';

  const doc = await db
    .prepare(
      `
      SELECT title, content, file_url, category
      FROM documents
      WHERE slug = 'about' AND is_active = 1 AND business_id = ?
      LIMIT 1
      `
    )
    .bind(businessId)
    .first<DocRow>();

  return { doc: doc ?? null };
};
