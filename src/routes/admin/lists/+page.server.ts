import type { Actions, PageServerLoad } from './$types';
import {
  addListItem,
  deleteListItem,
  loadAdminSections,
  requireAdmin,
  updateListItem
} from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return { preplists: [], inventory: [], orders: [] };
  }

  return loadAdminSections(db);
};

export const actions: Actions = {
  add_list_item: ({ request, locals }) => addListItem(request, locals),
  update_list_item: ({ request, locals }) => updateListItem(request, locals),
  delete_list_item: ({ request, locals }) => deleteListItem(request, locals)
};
