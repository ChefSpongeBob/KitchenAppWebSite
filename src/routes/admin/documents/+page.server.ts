import type { Actions, PageServerLoad } from './$types';
import {
  createDocument,
  deleteDocument,
  loadAdminDocuments,
  requireAdmin,
  updateDocument
} from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return { documents: [] };
  }

  return {
    documents: await loadAdminDocuments(db)
  };
};

export const actions: Actions = {
  create_document: ({ request, locals }) => createDocument(request, locals),
  update_document: ({ request, locals }) => updateDocument(request, locals),
  delete_document: ({ request, locals }) => deleteDocument(request, locals)
};
