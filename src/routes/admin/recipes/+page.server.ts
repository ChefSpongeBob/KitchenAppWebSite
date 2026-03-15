import type { Actions, PageServerLoad } from './$types';
import { createRecipe, deleteRecipe, loadAdminRecipes, requireAdmin } from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return { recipes: [] };
  }

  return {
    recipes: await loadAdminRecipes(db)
  };
};

export const actions: Actions = {
  create_recipe: ({ request, locals }) => createRecipe(request, locals),
  delete_recipe: ({ request, locals }) => deleteRecipe(request, locals)
};
