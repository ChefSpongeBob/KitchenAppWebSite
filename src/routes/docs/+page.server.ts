import type { PageServerLoad } from './$types';
import { loadAdminCreatorCatalog } from '$lib/server/admin';

type DocRow = {
  id: string;
  slug: string;
  title: string;
  section: string;
  category: string;
  content: string | null;
  file_url: string | null;
};

function normalizeCategoryKey(value: string) {
  return value.trim().toLowerCase();
}

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { docs: [], categories: [] };
  const businessId = locals.businessId ?? '';

  const docsResult = await db
    .prepare(
      `
        SELECT id, slug, title, section, category, content, file_url
        FROM documents
        WHERE is_active = 1
          AND business_id = ?
        ORDER BY section ASC, category ASC, title ASC
      `
    )
    .bind(businessId)
    .all<DocRow>();

  const creatorCatalog = await loadAdminCreatorCatalog(db, businessId);
  const categories = creatorCatalog.documents;

  const allowedCategoryKeys = new Set(categories.map((category) => normalizeCategoryKey(category)));
  const docs = (docsResult.results ?? []).filter((doc) =>
    allowedCategoryKeys.has(normalizeCategoryKey(String(doc.category ?? '')))
  );

  return {
    docs,
    categories
  };
};
