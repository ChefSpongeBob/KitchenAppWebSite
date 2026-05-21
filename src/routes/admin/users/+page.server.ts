import type { Actions, PageServerLoad } from './$types';
import {
  approveUser,
  deleteUser,
  denyUser,
  loadAdminUsers,
  makeUserAdmin,
  requireAdmin,
  toggleScheduleDepartmentApproval,
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

  if (!locals.businessId) {
    return { users: [] };
  }

  return {
    users: await loadAdminUsers(db, locals.businessId)
  };
};

export const actions: Actions = {
  approve_user: ({ request, locals, url, platform }) =>
    approveUser(request, locals, url.origin, platform?.env),
  deny_user: ({ request, locals }) => denyUser(request, locals),
  delete_user: ({ request, locals }) => deleteUser(request, locals),
  make_user_admin: ({ request, locals }) => makeUserAdmin(request, locals),
  toggle_specials_access: ({ request, locals }) => toggleSpecialsAccess(request, locals),
  toggle_schedule_department: ({ request, locals }) => toggleScheduleDepartmentApproval(request, locals)
};
