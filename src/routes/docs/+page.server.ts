import type { PageServerLoad } from './$types';
import { loadAdminDocumentCategories } from '$lib/server/admin';
import { requireBusinessId } from '$lib/server/tenant';

type DocRow = {
  id: string;
  slug: string;
  title: string;
  section: string;
  category: string;
  file_url: string | null;
};

function normalizeCategoryKey(value: string) {
  return value.trim().toLowerCase();
}

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { docs: [], categories: [] };
  const businessId = requireBusinessId(locals);
  const categories = await loadAdminDocumentCategories(db, businessId);

  if (categories.length === 0) {
    return {
      docs: [],
      categories
    };
  }

  const categoryKeys = categories.map((category) => normalizeCategoryKey(category));
  const placeholders = categoryKeys.map(() => '?').join(', ');
  const docsResult = await db
    .prepare(
      `
        SELECT id, slug, title, section, category, file_url
        FROM documents
        WHERE is_active = 1
          AND business_id = ?
          AND LOWER(TRIM(COALESCE(category, ''))) IN (${placeholders})
        ORDER BY section ASC, category ASC, title ASC
      `
    )
    .bind(businessId, ...categoryKeys)
    .all<DocRow>();

  return {
    docs: docsResult.results ?? [],
    categories
  };
};
