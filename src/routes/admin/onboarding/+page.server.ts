import type { Actions, PageServerLoad } from './$types';
import {
  createEmployeeOnboardingTemplateItem,
  deleteEmployeeOnboardingTemplateItem,
  loadAdminUsers,
  loadEmployeeOnboardingDashboard,
  loadEmployeeOnboardingTemplate,
  requireAdmin,
  sendEmployeeOnboardingPackage,
  updateEmployeeOnboardingTemplateItem
} from '$lib/server/admin';
import { requireBusinessId } from '$lib/server/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return { templateItems: [], onboardingRows: [], users: [] };
  const businessId = requireBusinessId(locals);

  return {
    templateItems: await loadEmployeeOnboardingTemplate(db, businessId),
    onboardingRows: await loadEmployeeOnboardingDashboard(db, businessId),
    users: await loadAdminUsers(db, businessId)
  };
};

export const actions: Actions = {
  send_package: ({ request, locals }) => sendEmployeeOnboardingPackage(request, locals),
  create_item: ({ request, locals }) => createEmployeeOnboardingTemplateItem(request, locals),
  update_item: ({ request, locals }) => updateEmployeeOnboardingTemplateItem(request, locals),
  delete_item: ({ request, locals }) => deleteEmployeeOnboardingTemplateItem(request, locals)
};
