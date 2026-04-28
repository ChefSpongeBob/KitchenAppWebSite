import type { Actions, PageServerLoad } from './$types';
import {
  addChecklistItem,
  addListItem,
  createDocument,
  deleteChecklistItem,
  deleteDocument,
  deleteListItem,
  loadAdminChecklists,
  loadAdminDocuments,
  loadAdminSections,
  requireAdmin,
  updateDocument,
  updateChecklistItem,
  updateListItem
} from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return { preplists: [], inventory: [], orders: [], checklists: [], documents: [] };
  }
  const businessId = locals.businessId ?? '';

  const sections = await loadAdminSections(db, businessId);
  const checklists = await loadAdminChecklists(db, businessId);
  const documents = await loadAdminDocuments(db, businessId);
  return { ...sections, checklists, documents };
};

export const actions: Actions = {
  add_list_item: ({ request, locals }) => addListItem(request, locals),
  update_list_item: ({ request, locals }) => updateListItem(request, locals),
  delete_list_item: ({ request, locals }) => deleteListItem(request, locals),
  add_checklist_item: ({ request, locals }) => addChecklistItem(request, locals),
  update_checklist_item: ({ request, locals }) => updateChecklistItem(request, locals),
  delete_checklist_item: ({ request, locals }) => deleteChecklistItem(request, locals),
  create_document: ({ request, locals }) => createDocument(request, locals),
  update_document: ({ request, locals }) => updateDocument(request, locals),
  delete_document: ({ request, locals }) => deleteDocument(request, locals)
};
