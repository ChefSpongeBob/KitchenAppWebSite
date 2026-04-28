import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const db = locals.DB;
  const query = url.searchParams.get('q')?.trim() ?? '';
  if (!db) return { recipes: [], category: params.category, query };
  const businessId = locals.businessId ?? '';

  const { results } = await db.prepare(`
    SELECT id, title, ingredients, instructions, created_at
    FROM recipes
    WHERE category = ? AND business_id = ?
    ORDER BY title COLLATE NOCASE ASC
  `).bind(params.category, businessId).all();

  return { recipes: results ?? [], category: params.category, query };
};
