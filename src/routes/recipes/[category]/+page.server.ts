import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform }) => {
  try {
    const db = platform?.D1?.DB;
    if (!db) throw new Error('D1 binding not found');

    const category = params.category;

    // Query recipes for this category directly
    const { results } = await db.prepare(
      `SELECT id, title, ingredients, instructions, created_at
       FROM recipes
       WHERE category = ?
       ORDER BY created_at DESC`
    ).bind(category).all();

    // Return to the page
    return { recipes: results, category };
  } catch (err) {
    console.error('Error fetching recipes for category', params.category, err);
    return { recipes: [], category: params.category };
  }
};