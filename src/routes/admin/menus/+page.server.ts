import type { Actions, PageServerLoad } from './$types';
import {
  createDocument,
  deleteDocument,
  loadAdminDocuments,
  requireAdmin,
  updateDocument,
  type AdminDocument
} from '$lib/server/admin';
import { requireBusinessId } from '$lib/server/tenant';

function normalizeKey(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function isMenuDocument(document: AdminDocument) {
  return (
    normalizeKey(document.category) === 'menu' ||
    normalizeKey(document.section) === 'menu' ||
    normalizeKey(document.slug).startsWith('menu')
  );
}

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return { menus: [] };

  const menus = (await loadAdminDocuments(db, requireBusinessId(locals))).filter(isMenuDocument);
  return { menus };
};

export const actions: Actions = {
  create_menu: ({ request, locals }) => createDocument(request, locals),
  update_menu: ({ request, locals }) => updateDocument(request, locals),
  delete_menu: ({ request, locals }) => deleteDocument(request, locals)
};
