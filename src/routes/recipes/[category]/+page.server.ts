import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, params }) => {
  const db = platform?.env.DB;
  if (!db) return { recipes: [], category: params.category };

  const { results } = await db.prepare(`
    SELECT id, title, ingredients, instructions, created_at
    FROM recipes
    WHERE category = ?
    ORDER BY created_at DESC
  `).bind(params.category).all();

  return { recipes: results ?? [], category: params.category };
};