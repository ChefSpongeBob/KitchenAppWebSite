import type { Actions, PageServerLoad } from './$types';
import {
  createCreatorCategory,
  createListSection,
  deleteCreatorCategory,
  deleteListSection,
  loadAdminCreatorCatalog,
  loadAdminSections,
  requireAdmin,
  updateCreatorCategory,
  updateListSection
} from '$lib/server/admin';
import { requireBusinessId } from '$lib/server/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return {
      sections: {
        preplists: [],
        inventory: [],
        orders: []
      },
      creatorCatalog: {
        preplists: [],
        inventory: [],
        orders: [],
        recipes: [],
        documents: []
      }
    };
  }

  const businessId = requireBusinessId(locals);
  const [sections, creatorCatalog] = await Promise.all([
    loadAdminSections(db, businessId),
    loadAdminCreatorCatalog(db, businessId)
  ]);
  return { sections, creatorCatalog };
};

export const actions: Actions = {
  create_list_section: ({ request, locals }) => createListSection(request, locals),
  update_list_section: ({ request, locals }) => updateListSection(request, locals),
  delete_list_section: ({ request, locals }) => deleteListSection(request, locals),
  create_creator_category: ({ request, locals }) => createCreatorCategory(request, locals),
  update_creator_category: ({ request, locals }) => updateCreatorCategory(request, locals),
  delete_creator_category: ({ request, locals }) => deleteCreatorCategory(request, locals)
};
