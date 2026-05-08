import type { PageServerLoad } from './$types';
import { requireBusinessId } from '$lib/server/tenant';

type DocRow = {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  file_url: string | null;
};

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { menuDocs: [] };
  const businessId = requireBusinessId(locals);

  const result = await db
    .prepare(
      `
      SELECT id, slug, title, content, file_url
      FROM documents
      WHERE is_active = 1
        AND business_id = ?
        AND (
          LOWER(slug) LIKE 'menu%'
          OR LOWER(section) = 'menu'
          OR LOWER(category) = 'menu'
        )
      ORDER BY title ASC
      `
    )
    .bind(businessId)
    .all<DocRow>();

  return {
    menuDocs: result.results ?? []
  };
};
