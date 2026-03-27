import type { Actions, PageServerLoad } from './$types';
import {
  addChecklistItem,
  addListItem,
  deleteChecklistItem,
  deleteListItem,
  loadAdminChecklists,
  loadAdminSections,
  requireAdmin,
  updateChecklistItem,
  updateListItem
} from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return { preplists: [], inventory: [], orders: [], checklists: [] };
  }

  const sections = await loadAdminSections(db);
  const checklists = await loadAdminChecklists(db);
  return { ...sections, checklists };
};

export const actions: Actions = {
  add_list_item: ({ request, locals }) => addListItem(request, locals),
  update_list_item: ({ request, locals }) => updateListItem(request, locals),
  delete_list_item: ({ request, locals }) => deleteListItem(request, locals),
  add_checklist_item: ({ request, locals }) => addChecklistItem(request, locals),
  update_checklist_item: ({ request, locals }) => updateChecklistItem(request, locals),
  delete_checklist_item: ({ request, locals }) => deleteChecklistItem(request, locals)
};
