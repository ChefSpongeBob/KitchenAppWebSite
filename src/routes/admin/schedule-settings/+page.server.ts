import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import {
  loadScheduleManagerDepartments,
  loadScheduleSettings,
  saveScheduleAutofillPreference
} from '$lib/server/schedules';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return {
      settings: {
        autofillNewWeeks: false,
        roleOptionsByDepartment: {
          FOH: [],
          Sushi: [],
          Kitchen: []
        }
      }
    };
  }

  const [settings, allowedDepartments] = await Promise.all([
    loadScheduleSettings(db, locals.businessId),
    loadScheduleManagerDepartments(db, locals, locals.businessId ?? '')
  ]);
  const allowedSet = new Set(allowedDepartments);
  return {
    settings: {
      ...settings,
      departments: settings.departments.filter((department) => allowedSet.has(department)),
      roleOptionsByDepartment: Object.fromEntries(
        Object.entries(settings.roleOptionsByDepartment).filter(([department]) => allowedSet.has(department))
      )
    }
  };
};

export const actions: Actions = {
  save_autofill: ({ request, locals }) => saveScheduleAutofillPreference(request, locals)
};
