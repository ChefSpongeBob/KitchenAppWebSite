import type { Actions, PageServerLoad } from './$types';
import {
  addListItem,
  addChecklistItem,
  createChecklistCategory,
  createCreatorCategory,
  createDocument,
  createListSection,
  createRecipe,
  deleteCreatorCategory,
  deleteChecklistCategory,
  deleteChecklistItem,
  deleteDocument,
  deleteListItem,
  deleteListSection,
  deleteRecipe,
  loadAdminCreatorCatalog,
  loadAdminChecklists,
  loadAdminDocuments,
  loadAdminRecipes,
  loadAdminSections,
  requireAdmin,
  updateCreatorCategory,
  updateChecklistCategory,
  updateChecklistItem,
  updateDocument,
  updateListItem,
  updateListSection,
  updateRecipe
} from '#lib/server/admin.ts';
import { attachTargetToItem, createItemAttachment, deleteItemAttachment } from '#lib/server/itemAttachments.ts';
import { requireBusinessId } from '#lib/server/tenant.ts';
import { error } from '@sveltejs/kit';
import { documentFeatureKey } from '#lib/features/appFeatures.ts';
import { featureAccessForLocals } from '#lib/server/featureAccess.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  const featureAccess = featureAccessForLocals(locals);
  const availableEditors = (['list', 'recipe', 'document', 'menu'] as const)
    .filter((editor) => featureAccess[editor === 'list' ? 'lists' : editor === 'recipe' ? 'recipes' : editor === 'menu' ? 'menus' : 'documents']);
  if (!availableEditors.length) error(403, 'Creator features are disabled for this workspace.');

  const editorParam = url.searchParams.get('editor')?.trim().toLowerCase() ?? '';
  const domainParam = url.searchParams.get('domain')?.trim().toLowerCase() ?? '';
  const typeParam = url.searchParams.get('type')?.trim().toLowerCase() ?? '';

  let initialEditorType: 'category' | 'list' | 'recipe' | 'document' | 'menu' =
    editorParam === 'category' ||
    editorParam === 'recipe' ||
    editorParam === 'document' ||
    editorParam === 'list' ||
    editorParam === 'menu'
      ? editorParam
      : 'list';
  if (initialEditorType !== 'category' && !availableEditors.includes(initialEditorType)) {
    initialEditorType = availableEditors[0];
  }

  const initialListDomain: 'preplists' | 'checklists' | 'inventory' | 'orders' =
    domainParam === 'inventory' || domainParam === 'orders' || domainParam === 'preplists' || domainParam === 'checklists'
      ? domainParam
      : 'preplists';

  let initialCategoryEditorType: 'list' | 'recipe' | 'document' =
    typeParam === 'recipe' || typeParam === 'document' ? typeParam : 'list';
  const availableCategoryEditors = availableEditors.filter((editor) => editor !== 'menu');
  if (!availableCategoryEditors.length && initialEditorType === 'category') initialEditorType = 'menu';
  if (!availableCategoryEditors.includes(initialCategoryEditorType)) initialCategoryEditorType = availableCategoryEditors[0] ?? 'document';

  if (!db) {
    return {
      sections: {
        preplists: [],
        inventory: [],
        orders: []
      },
      checklists: [],
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
      initialListDomain,
      initialCategoryEditorType,
      availableEditors,
      availableCategoryEditors
    };
  }
  const businessId = requireBusinessId(locals);

  const [sections, checklists, recipes, documents, creatorCatalog] = await Promise.all([
    featureAccess.lists ? loadAdminSections(db, businessId) : Promise.resolve({ preplists: [], inventory: [], orders: [] }),
    featureAccess.lists ? loadAdminChecklists(db, businessId) : Promise.resolve([]),
    featureAccess.recipes ? loadAdminRecipes(db, businessId) : Promise.resolve([]),
    featureAccess.documents || featureAccess.menus ? loadAdminDocuments(db, businessId) : Promise.resolve([]),
    loadAdminCreatorCatalog(db, businessId)
  ]);

  return {
    sections,
    checklists,
    recipes,
    documents: documents.filter((document) => featureAccess[documentFeatureKey(document)]),
    creatorCatalog: {
      preplists: featureAccess.lists ? creatorCatalog.preplists : [],
      inventory: featureAccess.lists ? creatorCatalog.inventory : [],
      orders: featureAccess.lists ? creatorCatalog.orders : [],
      recipes: featureAccess.recipes ? creatorCatalog.recipes : [],
      documents: creatorCatalog.documents.filter((category) => featureAccess[documentFeatureKey({ category })])
    },
    initialEditorType,
    initialListDomain,
    initialCategoryEditorType,
    availableEditors,
    availableCategoryEditors
  };
};

export const actions: Actions = {
  add_list_item: ({ request, locals }) => addListItem(request, locals),
  update_list_item: ({ request, locals }) => updateListItem(request, locals),
  delete_list_item: ({ request, locals }) => deleteListItem(request, locals),
  add_checklist_item: ({ request, locals }) => addChecklistItem(request, locals),
  update_checklist_item: ({ request, locals }) => updateChecklistItem(request, locals),
  delete_checklist_item: ({ request, locals }) => deleteChecklistItem(request, locals),
  update_list_section: ({ request, locals }) => updateListSection(request, locals),
  delete_list_section: ({ request, locals }) => deleteListSection(request, locals),
  update_checklist_category: ({ request, locals }) => updateChecklistCategory(request, locals),
  delete_checklist_category: ({ request, locals }) => deleteChecklistCategory(request, locals),
  create_creator_category: ({ request, locals }) => createCreatorCategory(request, locals),
  update_creator_category: ({ request, locals }) => updateCreatorCategory(request, locals),
  delete_creator_category: ({ request, locals }) => deleteCreatorCategory(request, locals),
  create_checklist_category: ({ request, locals }) => createChecklistCategory(request, locals),
  create_list_section: ({ request, locals }) => createListSection(request, locals),
  create_recipe: ({ request, locals }) => createRecipe(request, locals),
  update_recipe: ({ request, locals }) => updateRecipe(request, locals),
  delete_recipe: ({ request, locals }) => deleteRecipe(request, locals),
  create_document: ({ request, locals }) => createDocument(request, locals),
  update_document: ({ request, locals }) => updateDocument(request, locals),
  delete_document: ({ request, locals }) => deleteDocument(request, locals),
  create_item_attachment: ({ request, locals }) => createItemAttachment(request, locals),
  attach_target_to_item: ({ request, locals }) => attachTargetToItem(request, locals),
  delete_item_attachment: ({ request, locals }) => deleteItemAttachment(request, locals)
};
