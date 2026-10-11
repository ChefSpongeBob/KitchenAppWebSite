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

const onboardingViews = new Set(['invites', 'packets', 'forms']);

export const load: PageServerLoad = async ({ locals, url }) => {
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
  const requestedView = String(url.searchParams.get('view') ?? 'packets').trim().toLowerCase();
  const allowedViews = [
    canReviewOnboarding ? 'packets' : '',
    canManageOnboarding ? 'invites' : '',
    canManageHrSetup ? 'forms' : ''
  ].filter(Boolean);
  const activeView =
    onboardingViews.has(requestedView) && allowedViews.includes(requestedView)
      ? requestedView
      : allowedViews[0] ?? 'packets';
  if (!db) {
    return {
      activeView,
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
  if (activeView === 'invites' && canManageOnboarding) {
    await ensureDefaultBusinessPositions(db, businessId, locals.userId ?? null);
  }

  const [templateItems, onboardingRows, users, invites, positions, departments, recommendations, hrSettings] =
    await Promise.all([
      activeView === 'forms' && canManageHrSetup
        ? loadEmployeeOnboardingTemplate(db, businessId)
        : [],
      activeView === 'packets' && canReviewOnboarding
        ? loadEmployeeOnboardingDashboard(db, businessId)
        : [],
      activeView === 'packets' && canManageOnboarding ? loadAdminUsers(db, businessId) : [],
      activeView === 'invites' && canManageOnboarding ? loadAdminInvites(db, businessId) : [],
      activeView === 'invites' && canManageOnboarding
        ? loadBusinessPositions(db, businessId)
        : [],
      activeView === 'invites' && canManageOnboarding ? loadScheduleDepartments(db, businessId) : [],
      activeView === 'forms' && canManageHrSetup
        ? loadEmployeeOnboardingRecommendations(db, businessId)
        : { state: '', items: [] },
      activeView === 'forms' && canManageHrSetup
        ? loadBusinessHrSettings(db, businessId)
        : { retain_i9_document_copies: 0, everify_participant: 0 }
    ]);

  return {
    activeView,
    templateItems,
    onboardingRows,
    users,
    invites,
    positions,
    departments,
    recommendations,
    hrSettings,
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
