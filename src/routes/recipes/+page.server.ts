// src/routes/recipes/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
  try {
    const db = platform?.D1?.DB;
    if (!db) throw new Error('D1 binding not found');

    // Fetch all distinct categories from your recipes table
    const { results } = await db.prepare(
      `SELECT DISTINCT category
       FROM recipes
       ORDER BY category ASC`
    ).all();

    // Return as-is; frontend can consume results directly
    return { categories: results };
  } catch (err) {
    console.error('Error fetching categories', err);
    return { categories: [] };
  }
};