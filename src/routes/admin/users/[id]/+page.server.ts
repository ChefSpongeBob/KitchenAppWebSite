import type { Actions, PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
  approveEmployeeOnboardingItem,
  approveUser,
  deleteUser,
  denyUser,
  loadEmployeeOnboarding,
  loadAdminEmployeeProfile,
  loadAdminUsers,
  requestEmployeeOnboardingChanges,
  requireAdmin,
  revokeEmployeeSessions,
  saveEmployeeProfile,
  sendEmployeeOnboardingPackage,
  toggleScheduleDepartmentApproval,
  updateUserBusinessPermissions,
  updateUserCapabilityOverrides
} from '$lib/server/admin';
import { loadScheduleDepartments } from '$lib/server/schedules';
import { listUserSessions } from '$lib/server/security';
import { canAccessEmployeeSensitiveData } from '$lib/server/sensitive';
import {
  ALL_BUSINESS_CAPABILITIES,
  hasBusinessCapability,
  normalizeBusinessRole
} from '$lib/server/permissions';

export const load: PageServerLoad = async ({ locals, params, platform }) => {
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

  const canReadSensitiveProfile = await canAccessEmployeeSensitiveData(
    db,
    locals.businessId,
    locals.userId,
    locals.businessRole,
    employee.id,
    locals.businessPermissionTemplate,
    locals.businessCapabilities
  );
  const profile = await loadAdminEmployeeProfile(db, employee.id, locals.businessId);
  const actorIsOwner = normalizeBusinessRole(locals.businessRole) === 'owner';
  const targetRole = normalizeBusinessRole(employee.role);
  const canEditPermissions =
    hasBusinessCapability(
      locals.businessRole,
      locals.businessPermissionTemplate,
      'manage_permissions',
      locals.businessCapabilities
    ) &&
    targetRole !== 'owner' &&
    (actorIsOwner || (targetRole !== 'manager' && employee.id !== locals.userId));

  return {
    employee,
    profile: canReadSensitiveProfile
      ? profile
      : {
          ...profile,
          birthday: '',
          address_line_1: '',
          address_line_2: '',
          city: '',
          state: '',
          postal_code: '',
          emergency_contact_name: '',
          emergency_contact_phone: '',
          emergency_contact_relationship: ''
        },
    onboarding: await loadEmployeeOnboarding(db, employee.id, locals.businessId, {
      env: platform?.env,
      actorUserId: locals.userId,
      actorBusinessRole: locals.businessRole,
      actorPermissionTemplate: locals.businessPermissionTemplate,
      actorCapabilities: locals.businessCapabilities,
      auditSensitiveRead: true
    }),
    sessions: await listUserSessions(db, employee.id),
    departments: await loadScheduleDepartments(db, locals.businessId),
    canEditPermissions,
    canManageManagerAccess: actorIsOwner,
    editableCapabilities: actorIsOwner
      ? ALL_BUSINESS_CAPABILITIES
      : (locals.businessCapabilities ?? []).filter(
          (capability) => capability !== 'admin_access' && capability !== 'manage_permissions'
        )
  };
};

export const actions: Actions = {
  approve_user: ({ request, locals, url, platform }) =>
    approveUser(request, locals, url.origin, platform?.env),
  deny_user: ({ request, locals }) => denyUser(request, locals),
  delete_user: ({ request, locals }) => deleteUser(request, locals),
  update_permissions: ({ request, locals }) => updateUserBusinessPermissions(request, locals),
  update_capabilities: ({ request, locals }) => updateUserCapabilityOverrides(request, locals),
  toggle_schedule_department: ({ request, locals }) => toggleScheduleDepartmentApproval(request, locals),
  save_profile: ({ request, locals }) => saveEmployeeProfile(request, locals),
  send_onboarding_package: ({ request, locals }) => sendEmployeeOnboardingPackage(request, locals),
  approve_onboarding_item: ({ request, locals }) => approveEmployeeOnboardingItem(request, locals),
  request_onboarding_changes: ({ request, locals }) => requestEmployeeOnboardingChanges(request, locals),
  revoke_employee_sessions: ({ request, locals }) => revokeEmployeeSessions(request, locals)
};
