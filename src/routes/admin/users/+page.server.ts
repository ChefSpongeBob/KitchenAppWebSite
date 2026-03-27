import type { Actions, PageServerLoad } from './$types';
import {
  approveUser,
  deleteUser,
  denyUser,
  loadAdminUsers,
  makeUserAdmin,
  requireAdmin,
  toggleSpecialsAccess
} from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return {
      users: []
    };
  }

  const users = await loadAdminUsers(db);
  return { users };
};

export const actions: Actions = {
  approve_user: ({ request, locals }) => approveUser(request, locals),
  deny_user: ({ request, locals }) => denyUser(request, locals),
  delete_user: ({ request, locals }) => deleteUser(request, locals),
  make_user_admin: ({ request, locals }) => makeUserAdmin(request, locals),
  toggle_specials_access: ({ request, locals }) => toggleSpecialsAccess(request, locals)
};

