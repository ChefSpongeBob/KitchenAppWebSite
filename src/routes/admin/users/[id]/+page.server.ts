import type { Actions, PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
  approveUser,
  deleteUser,
  denyUser,
  loadAdminEmployeeProfile,
  loadAdminUsers,
  makeUserAdmin,
  requireAdmin,
  saveEmployeeProfile,
  toggleScheduleDepartmentApproval,
  toggleSpecialsAccess
} from '$lib/server/admin';
import { loadScheduleDepartments } from '$lib/server/schedules';

export const load: PageServerLoad = async ({ locals, params }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    throw error(503, 'Database not configured.');
  }

  if (!locals.businessId) {
    throw error(404, 'Employee not found.');
  }

  const users = await loadAdminUsers(db, locals.businessId);
  const employee = users.find((user) => user.id === params.id);

  if (!employee) {
    throw error(404, 'Employee not found.');
  }

  return {
    employee,
    profile: await loadAdminEmployeeProfile(db, employee.id),
    departments: await loadScheduleDepartments(db)
  };
};

export const actions: Actions = {
  approve_user: ({ request, locals, url, platform }) =>
    approveUser(request, locals, url.origin, platform?.env),
  deny_user: ({ request, locals }) => denyUser(request, locals),
  delete_user: ({ request, locals }) => deleteUser(request, locals),
  make_user_admin: ({ request, locals }) => makeUserAdmin(request, locals),
  toggle_specials_access: ({ request, locals }) => toggleSpecialsAccess(request, locals),
  toggle_schedule_department: ({ request, locals }) => toggleScheduleDepartmentApproval(request, locals),
  save_profile: ({ request, locals }) => saveEmployeeProfile(request, locals)
};
