import type { PageServerLoad } from './$types';
import { loadAdminRecipeCategories } from '$lib/server/admin';
import { requireBusinessId } from '$lib/server/tenant';

export const load: PageServerLoad = async ({ locals, url }) => {
  const db = locals.DB;
  const query = url.searchParams.get('q')?.trim() ?? '';
  if (!db) {
    return { categories: [], recipeIndex: [], query };
  }
  const businessId = requireBusinessId(locals);
  const categories = await loadAdminRecipeCategories(db, businessId);

  const { results: recipeRows } = await db
    .prepare(
      `
      SELECT id, title, category
      FROM recipes
      WHERE business_id = ?
      ORDER BY title ASC
      `
    )
    .bind(businessId)
    .all<{ id: number; title: string; category: string }>();

  const recipeIndex = (recipeRows ?? []).map((recipe) => ({
    ...recipe,
    category: String(recipe.category ?? '').trim().toLowerCase()
  }));

  return {
    categories,
    recipeIndex,
    query
  };
};
