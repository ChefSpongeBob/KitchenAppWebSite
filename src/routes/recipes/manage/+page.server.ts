import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
  try {
    const db = platform?.D1?.DB;
    if (!db) throw new Error('D1 binding not found');

    // Load all recipes from the database
    const { results: recipes } = await db.prepare(
      `SELECT id, title, category, ingredients, instructions, created_at
       FROM recipes
       ORDER BY created_at DESC`
    ).all();

    return { recipes };
  } catch (err) {
    console.error('Error loading recipes', err);
    return { recipes: [] };
  }
};

export const actions: Actions = {
  // Create a new recipe
  createRecipe: async ({ request, platform }) => {
    const db = platform?.D1?.DB;
    if (!db) throw new Error('D1 binding not found');

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const ingredients = formData.get('ingredients') as string;
    const instructions = formData.get('instructions') as string;

    await db.prepare(
      `INSERT INTO recipes (title, category, ingredients, instructions, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(title, category, ingredients, instructions).run();

    return { success: true };
  },

  // Update an existing recipe
  updateRecipe: async ({ request, platform }) => {
    const db = platform?.D1?.DB;
    if (!db) throw new Error('D1 binding not found');

    const formData = await request.formData();
    const id = formData.get('id') as string;
    const title = formData.get('title') as string;
    const ingredients = formData.get('ingredients') as string;
    const instructions = formData.get('instructions') as string;

    await db.prepare(
      `UPDATE recipes
       SET title = ?, ingredients = ?, instructions = ?
       WHERE id = ?`
    ).bind(title, ingredients, instructions, id).run();

    return { success: true };
  },

  // Delete a recipe
  deleteRecipe: async ({ request, platform }) => {
    const db = platform?.D1?.DB;
    if (!db) throw new Error('D1 binding not found');

    const formData = await request.formData();
    const id = formData.get('id') as string;

    await db.prepare(
      `DELETE FROM recipes WHERE id = ?`
    ).bind(id).run();

    return { success: true };
  }
};