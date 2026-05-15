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
  toggleScheduleDepartmentApproval,
  toggleSpecialsAccess
} from '$lib/server/admin';
import { loadScheduleDepartments } from '$lib/server/schedules';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return {
      users: [],
      invites: [],
      departments: []
    };
  }

  if (!locals.businessId) {
    return { users: [], invites: [], departments: [] };
  }

  const [users, invites, departments] = await Promise.all([
    loadAdminUsers(db, locals.businessId),
    loadAdminInvites(db, locals.businessId),
    loadScheduleDepartments(db, locals.businessId)
  ]);
  return { users, invites, departments };
};

export const actions: Actions = {
  create_user_invite: ({ request, locals, url, platform }) =>
    createUserInvite(request, locals, url.origin, platform?.env),
  revoke_user_invite: ({ request, locals }) => revokeUserInvite(request, locals),
  approve_user: ({ request, locals, url, platform }) =>
    approveUser(request, locals, url.origin, platform?.env),
  deny_user: ({ request, locals }) => denyUser(request, locals),
  delete_user: ({ request, locals }) => deleteUser(request, locals),
  make_user_admin: ({ request, locals }) => makeUserAdmin(request, locals),
  toggle_specials_access: ({ request, locals }) => toggleSpecialsAccess(request, locals),
  toggle_schedule_department: ({ request, locals }) => toggleScheduleDepartmentApproval(request, locals)
};
