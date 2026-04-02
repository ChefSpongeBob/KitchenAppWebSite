import type { Actions, PageServerLoad } from './$types';
import {
  approveUser,
  createUserInvite,
  deleteUser,
  denyUser,
  loadAdminInvites,
  loadAdminUsers,
  makeUserAdmin,
  revokeUserInvite,
  requireAdmin,
  toggleSpecialsAccess
} from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return {
      users: [],
      invites: []
    };
  }

  const users = await loadAdminUsers(db);
  const invites = await loadAdminInvites(db);
  return { users, invites };
};

export const actions: Actions = {
  create_user_invite: ({ request, locals }) => createUserInvite(request, locals),
  revoke_user_invite: ({ request, locals }) => revokeUserInvite(request, locals),
  approve_user: ({ request, locals }) => approveUser(request, locals),
  deny_user: ({ request, locals }) => denyUser(request, locals),
  delete_user: ({ request, locals }) => deleteUser(request, locals),
  make_user_admin: ({ request, locals }) => makeUserAdmin(request, locals),
  toggle_specials_access: ({ request, locals }) => toggleSpecialsAccess(request, locals)
};
