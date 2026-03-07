import type { PageServerLoad } from './$types';
import { recipeCategories } from '$lib/assets/recipeCategories';

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) {
    console.log('DB not found');
    return { categories: [] };
  }

  const { results: categories } = await db.prepare(
    `SELECT DISTINCT category FROM recipes ORDER BY category ASC`
  ).all();

  const dbCategories = (categories?.map((c) => String(c.category || '').trim().toLowerCase()) ?? []).filter(Boolean);
  const merged = Array.from(new Set([...recipeCategories, ...dbCategories]));

  return {
    categories: merged
  };
};
