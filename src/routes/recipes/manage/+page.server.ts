import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) return { recipes: [] };

  const { results } = await db
    .prepare(`SELECT * FROM recipes ORDER BY created_at DESC`)
    .all();

  return { recipes: results ?? [] };
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
      String(f.get('title') ?? ''),
      String(f.get('category') ?? ''),
      String(f.get('ingredients') ?? ''),
      String(f.get('instructions') ?? '')
    ).run();

    return { success: true };
  },

  updateRecipe: async ({ request, platform }) => {
    const db = platform?.env.DB;
    if (!db) throw new Error('No DB');

    const f = await request.formData();

    await db.prepare(`
      UPDATE recipes
      SET title=?, ingredients=?, instructions=?
      WHERE id=?
    `).bind(
      String(f.get('title') ?? ''),
      String(f.get('ingredients') ?? ''),
      String(f.get('instructions') ?? ''),
      Number(f.get('id'))
    ).run();

    return { success: true };
  },

  deleteRecipe: async ({ request, platform }) => {
    const db = platform?.env.DB;
    if (!db) throw new Error('No DB');

    const f = await request.formData();

    await db
      .prepare(`DELETE FROM recipes WHERE id=?`)
      .bind(Number(f.get('id')))
      .run();

    return { success: true };
  }
};