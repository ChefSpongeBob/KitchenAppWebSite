import type { Actions, PageServerLoad } from './$types';
import { loadAdminUsers, requireAdmin, toggleScheduleDepartmentApproval } from '$lib/server/admin';
import {
  createScheduleRoleDefinition,
  deleteScheduleRoleDefinition,
  loadScheduleRoleDefinitions,
  loadScheduleSettings,
  saveScheduleAutofillPreference
} from '$lib/server/schedules';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return {
      users: [],
      settings: {
        autofillNewWeeks: false,
        roleOptionsByDepartment: {
          FOH: [],
          Sushi: [],
          Kitchen: []
        }
      },
      roles: []
    };
  }

  const [users, settings, roles] = await Promise.all([
    loadAdminUsers(db),
    loadScheduleSettings(db),
    loadScheduleRoleDefinitions(db)
  ]);

  return {
    users,
    settings,
    roles
  };
};

export const actions: Actions = {
  save_autofill: ({ request, locals }) => saveScheduleAutofillPreference(request, locals),
  create_role: ({ request, locals }) => createScheduleRoleDefinition(request, locals),
  delete_role: ({ request, locals }) => deleteScheduleRoleDefinition(request, locals),
  toggle_schedule_department: ({ request, locals }) => toggleScheduleDepartmentApproval(request, locals)
};
