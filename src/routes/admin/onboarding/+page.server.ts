import type { Actions, PageServerLoad } from './$types';
import {
  createUserInvite,
  createEmployeeOnboardingTemplateItem,
  deleteEmployeeOnboardingTemplateItem,
  loadAdminInvites,
  loadAdminUsers,
  loadEmployeeOnboardingDashboard,
  loadEmployeeOnboardingTemplate,
  revokeUserInvite,
  requireAdmin,
  sendEmployeeOnboardingPackage,
  updateEmployeeOnboardingTemplateItem
} from '$lib/server/admin';
import { loadScheduleDepartments } from '$lib/server/schedules';
import { requireBusinessId } from '$lib/server/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return { templateItems: [], onboardingRows: [], users: [], invites: [], departments: [] };
  const businessId = requireBusinessId(locals);

  return {
    templateItems: await loadEmployeeOnboardingTemplate(db, businessId),
    onboardingRows: await loadEmployeeOnboardingDashboard(db, businessId),
    users: await loadAdminUsers(db, businessId),
    invites: await loadAdminInvites(db, businessId),
    departments: await loadScheduleDepartments(db, businessId)
  };
};

export const actions: Actions = {
  create_user_invite: ({ request, locals, url, platform }) =>
    createUserInvite(request, locals, url.origin, platform?.env),
  revoke_user_invite: ({ request, locals }) => revokeUserInvite(request, locals),
  send_package: ({ request, locals }) => sendEmployeeOnboardingPackage(request, locals),
  create_item: ({ request, locals }) => createEmployeeOnboardingTemplateItem(request, locals),
  update_item: ({ request, locals }) => updateEmployeeOnboardingTemplateItem(request, locals),
  delete_item: ({ request, locals }) => deleteEmployeeOnboardingTemplateItem(request, locals)
};
