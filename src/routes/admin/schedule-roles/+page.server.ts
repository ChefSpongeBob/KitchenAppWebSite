import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import {
  createScheduleDepartment,
  createScheduleRoleDefinition,
  deleteScheduleRoleDefinition,
  loadScheduleDepartments,
  loadScheduleRoleDefinitions
} from '$lib/server/schedules';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return {
      departments: ['General'],
      roles: []
    };
  }

  return {
    departments: await loadScheduleDepartments(db, locals.businessId),
    roles: await loadScheduleRoleDefinitions(db, locals.businessId)
  };
};

export const actions: Actions = {
  create_department: ({ request, locals }) => createScheduleDepartment(request, locals),
  create_role: ({ request, locals }) => createScheduleRoleDefinition(request, locals),
  delete_role: ({ request, locals }) => deleteScheduleRoleDefinition(request, locals)
};
