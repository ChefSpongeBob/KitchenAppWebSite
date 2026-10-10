import type { Actions, PageServerLoad } from './$types';
import {
  createUserInvite,
  createEmployeeOnboardingTemplateItem,
  deleteEmployeeOnboardingTemplateItem,
  installStandardEmployeeOnboardingTemplate,
  loadBusinessHrSettings,
  loadAdminInvites,
  loadAdminUsers,
  loadEmployeeOnboardingDashboard,
  loadEmployeeOnboardingRecommendations,
  loadEmployeeOnboardingTemplate,
  revokeUserInvite,
  sendEmployeeOnboardingPackage,
  saveBusinessHrSettings,
  updateEmployeeOnboardingTemplateItem
} from '$lib/server/admin';
import { loadScheduleDepartments } from '$lib/server/schedules';
import { ensureDefaultBusinessPositions, loadBusinessPositions } from '$lib/server/business';
import { requireBusinessId } from '$lib/server/tenant';
import { hasBusinessCapability } from '$lib/server/permissions';
import { normalizeBusinessRole } from '$lib/server/permissions';

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  const canReviewOnboarding = hasBusinessCapability(
    locals.businessRole,
    locals.businessPermissionTemplate,
    'review_onboarding',
    locals.businessCapabilities
  );
  const canManageOnboarding = hasBusinessCapability(
    locals.businessRole,
    locals.businessPermissionTemplate,
    'manage_onboarding',
    locals.businessCapabilities
  );
  const canManageHrSetup = hasBusinessCapability(
    locals.businessRole,
    locals.businessPermissionTemplate,
    'manage_hr_setup',
    locals.businessCapabilities
  );
  const canViewSensitive = hasBusinessCapability(
    locals.businessRole,
    locals.businessPermissionTemplate,
    'view_sensitive_employee_data',
    locals.businessCapabilities
  );
  const canManagePermissions = hasBusinessCapability(
    locals.businessRole,
    locals.businessPermissionTemplate,
    'manage_permissions',
    locals.businessCapabilities
  );
  const actorIsOwner = normalizeBusinessRole(locals.businessRole) === 'owner';
  const canManageManagers =
    actorIsOwner ||
    hasBusinessCapability(
      locals.businessRole,
      locals.businessPermissionTemplate,
      'manage_managers',
      locals.businessCapabilities
    );
  if (!db) {
    return {
      templateItems: [],
      onboardingRows: [],
      users: [],
      invites: [],
      positions: [],
      departments: [],
      recommendations: { state: '', items: [] },
      hrSettings: { retain_i9_document_copies: 0, everify_participant: 0 },
      canReviewOnboarding,
      canManageOnboarding,
      canManageHrSetup,
      canViewSensitive,
      canManagePermissions,
      canManageManagers,
      actorIsOwner
    };
  }
  const businessId = requireBusinessId(locals);
  if (canManageOnboarding) await ensureDefaultBusinessPositions(db, businessId, locals.userId ?? null);

  return {
    templateItems: canManageHrSetup ? await loadEmployeeOnboardingTemplate(db, businessId) : [],
    onboardingRows: await loadEmployeeOnboardingDashboard(db, businessId),
    users: canManageOnboarding ? await loadAdminUsers(db, businessId) : [],
    invites: canManageOnboarding ? await loadAdminInvites(db, businessId) : [],
    positions: canManageOnboarding ? await loadBusinessPositions(db, businessId) : [],
    departments: canManageOnboarding ? await loadScheduleDepartments(db, businessId) : [],
    recommendations: canManageHrSetup
      ? await loadEmployeeOnboardingRecommendations(db, businessId)
      : { state: '', items: [] },
    hrSettings: canManageHrSetup
      ? await loadBusinessHrSettings(db, businessId)
      : { retain_i9_document_copies: 0, everify_participant: 0 },
    canReviewOnboarding,
    canManageOnboarding,
    canManageHrSetup,
    canViewSensitive,
    canManagePermissions,
    canManageManagers,
    actorIsOwner
  };
};

export const actions: Actions = {
  create_user_invite: ({ request, locals, url, platform }) =>
    createUserInvite(request, locals, url.origin, platform?.env),
  revoke_user_invite: ({ request, locals }) => revokeUserInvite(request, locals),
  send_package: ({ request, locals }) => sendEmployeeOnboardingPackage(request, locals),
  install_standard_packet: ({ request, locals }) => installStandardEmployeeOnboardingTemplate(request, locals),
  create_item: ({ request, locals }) => createEmployeeOnboardingTemplateItem(request, locals),
  update_item: ({ request, locals }) => updateEmployeeOnboardingTemplateItem(request, locals),
  delete_item: ({ request, locals }) => deleteEmployeeOnboardingTemplateItem(request, locals),
  save_hr_settings: ({ request, locals }) => saveBusinessHrSettings(request, locals)
};
