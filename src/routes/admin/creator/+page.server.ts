import type { Actions, PageServerLoad } from './$types';
import {
  addListItem,
  createCreatorCategory,
  createDocument,
  createListSection,
  createRecipe,
  deleteCreatorCategory,
  deleteDocument,
  deleteListItem,
  deleteListSection,
  deleteRecipe,
  loadAdminCreatorCatalog,
  loadAdminDocuments,
  loadAdminRecipes,
  loadAdminSections,
  requireAdmin,
  updateCreatorCategory,
  updateDocument,
  updateListItem,
  updateListSection,
  updateRecipe
} from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals, url }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  const editorParam = url.searchParams.get('editor')?.trim().toLowerCase() ?? '';
  const domainParam = url.searchParams.get('domain')?.trim().toLowerCase() ?? '';

  const initialEditorType: 'category' | 'list' | 'recipe' | 'document' =
    editorParam === 'category' ||
    editorParam === 'recipe' ||
    editorParam === 'document' ||
    editorParam === 'list'
      ? editorParam
      : 'list';

  const initialListDomain: 'preplists' | 'inventory' | 'orders' =
    domainParam === 'inventory' || domainParam === 'orders' || domainParam === 'preplists'
      ? domainParam
      : 'preplists';

  if (!db) {
    return {
      sections: {
        preplists: [],
        inventory: [],
        orders: []
      },
      recipes: [],
      documents: [],
      creatorCatalog: {
        preplists: [],
        inventory: [],
        orders: [],
        recipes: [],
        documents: []
      },
      initialEditorType,
      initialListDomain
    };
  }
  const businessId = locals.businessId ?? '';

  const [sections, recipes, documents, creatorCatalog] = await Promise.all([
    loadAdminSections(db, businessId),
    loadAdminRecipes(db, businessId),
    loadAdminDocuments(db, businessId),
    loadAdminCreatorCatalog(db, businessId)
  ]);

  return { sections, recipes, documents, creatorCatalog, initialEditorType, initialListDomain };
};

export const actions: Actions = {
  add_list_item: ({ request, locals }) => addListItem(request, locals),
  update_list_item: ({ request, locals }) => updateListItem(request, locals),
  delete_list_item: ({ request, locals }) => deleteListItem(request, locals),
  update_list_section: ({ request, locals }) => updateListSection(request, locals),
  delete_list_section: ({ request, locals }) => deleteListSection(request, locals),
  create_creator_category: ({ request, locals }) => createCreatorCategory(request, locals),
  update_creator_category: ({ request, locals }) => updateCreatorCategory(request, locals),
  delete_creator_category: ({ request, locals }) => deleteCreatorCategory(request, locals),
  create_list_section: ({ request, locals }) => createListSection(request, locals),
  create_recipe: ({ request, locals }) => createRecipe(request, locals),
  update_recipe: ({ request, locals }) => updateRecipe(request, locals),
  delete_recipe: ({ request, locals }) => deleteRecipe(request, locals),
  create_document: ({ request, locals }) => createDocument(request, locals),
  update_document: ({ request, locals }) => updateDocument(request, locals),
  delete_document: ({ request, locals }) => deleteDocument(request, locals)
};
