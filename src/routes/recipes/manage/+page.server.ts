import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) return { recipes: [], categories: [] };

  const { results: recipes } = await db.prepare(
    `SELECT id, title, category, ingredients, instructions, created_at
     FROM recipes
     ORDER BY created_at DESC`
  ).all();

  const { results: categories } = await db.prepare(
    `SELECT DISTINCT category FROM recipes`
  ).all();

  return {
    recipes: recipes ?? [],
    categories: categories?.map(c => c.category) ?? []
  };
};

export const actions: Actions = {
  createRecipe: async ({ request, platform }) => {
    const db = platform?.env.DB;
    if (!db) throw new Error('No DB');

    const f = await request.formData();

    await db.prepare(`
      INSERT INTO recipes (title, category, ingredients, instructions, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(
      f.get('title') ?? '',
      f.get('category') ?? '',
      f.get('ingredients') ?? '',
      f.get('instructions') ?? ''
    ).run();

    return { success: true };
  },

  updateRecipe: async ({ request, platform }) => {
    const db = platform?.env.DB;
    if (!db) throw new Error('No DB');

    const f = await request.formData();

    await db.prepare(`
      UPDATE recipes
      SET title=?, ingredients=?, instructions=?, category=?
      WHERE id=?
    `).bind(
      f.get('title') ?? '',
      f.get('ingredients') ?? '',
      f.get('instructions') ?? '',
      f.get('category') ?? '',
      f.get('id')
    ).run();

    return { success: true };
  },

  deleteRecipe: async ({ request, platform }) => {
    const db = platform?.env.DB;
    if (!db) throw new Error('No DB');

    const f = await request.formData();

    await db.prepare(`DELETE FROM recipes WHERE id=?`)
      .bind(f.get('id'))
      .run();

    return { success: true };
  }
};