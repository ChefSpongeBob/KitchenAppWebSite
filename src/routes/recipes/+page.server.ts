import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const db = locals.DB;
  const query = url.searchParams.get('q')?.trim() ?? '';
  if (!db) {
    return { categories: [], recipeIndex: [], query };
  }

  const { results: categories } = await db.prepare(
    `SELECT DISTINCT category FROM recipes ORDER BY category ASC`
  ).all();

  const { results: recipeRows } = await db
    .prepare(
      `
      SELECT id, title, category
      FROM recipes
      ORDER BY title ASC
      `
    )
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
