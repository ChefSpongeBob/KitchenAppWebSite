import type { Actions, PageServerLoad } from './$types';
import {
  deleteUser,
  loadAdminUsers,
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
  delete_user: ({ request, locals }) => deleteUser(request, locals),
  toggle_specials_access: ({ request, locals }) => toggleSpecialsAccess(request, locals),
  toggle_schedule_department: ({ request, locals }) => toggleScheduleDepartmentApproval(request, locals)
};
