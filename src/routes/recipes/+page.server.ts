import type { PageServerLoad } from './$types';
import { requireBusinessId } from '$lib/server/tenant';

export const load: PageServerLoad = async ({ locals, url }) => {
  const db = locals.DB;
  const query = url.searchParams.get('q')?.trim() ?? '';
  if (!db) {
    return { categories: [], recipeIndex: [], query };
  }
  const businessId = requireBusinessId(locals);

  const { results: categories } = await db
    .prepare(`SELECT DISTINCT category FROM recipes WHERE business_id = ? ORDER BY category ASC`)
    .bind(businessId)
    .all();

  const { results: recipeRows } = await db
    .prepare(
      `
      SELECT id, title, category
      FROM recipes
      WHERE business_id = ?
      ORDER BY title ASC
      `
    )
    .bind(businessId)
    .all<{ id: number; title: string; category: string }>();

  const dbCategories = (categories?.map((c) => String(c.category || '').trim().toLowerCase()) ?? [])
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return {
    categories: dbCategories,
    recipeIndex: recipeRows ?? [],
    query
  };
};
