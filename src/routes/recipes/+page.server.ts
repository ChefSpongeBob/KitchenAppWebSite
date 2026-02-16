import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) {
    console.log('DB not found');
    return { categories: [] };
  }

  const { results: categories } = await db.prepare(
    `SELECT DISTINCT category FROM recipes ORDER BY category ASC`
  ).all();

  return {
    categories: categories?.map(c => c.category) ?? []
  };
};