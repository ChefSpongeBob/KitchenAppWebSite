import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import {
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

  return {
    settings: await loadScheduleSettings(db)
  };
};

export const actions: Actions = {
  save_autofill: ({ request, locals }) => saveScheduleAutofillPreference(request, locals)
};
