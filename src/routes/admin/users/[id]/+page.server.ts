import type { Actions, PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
  approveEmployeeOnboardingItem,
  deleteUser,
  loadEmployeeOnboarding,
  loadAdminEmployeeProfile,
  loadAdminUsers,
  requestEmployeeOnboardingChanges,
  requireAdmin,
  saveEmployeeProfile,
  sendEmployeeOnboardingPackage,
  toggleScheduleDepartmentApproval,
  updateUserBusinessPermissions,
  updateUserCapabilityOverrides
} from '$lib/server/admin';
import { loadScheduleDepartments } from '$lib/server/schedules';
import { canAccessEmployeeSensitiveData } from '$lib/server/sensitive';
import {
  ALL_BUSINESS_CAPABILITIES,
  hasBusinessCapability,
  normalizeBusinessRole
} from '$lib/server/permissions';

type EmployeeProfile = Awaited<ReturnType<typeof loadAdminEmployeeProfile>>;
type EmployeeOnboarding = Awaited<ReturnType<typeof loadEmployeeOnboarding>>;

function hasValues(profile: EmployeeProfile, keys: Array<keyof EmployeeProfile>) {
  return keys.every((key) => String(profile[key] ?? '').trim().length > 0);
}

function onboardingProfilePayload(profile: EmployeeProfile, formKey: string, title: string) {
  const normalizedTitle = title.trim().toLowerCase();
  if (formKey === 'personal_information' || normalizedTitle === 'personal information') {
    if (!hasValues(profile, ['real_name', 'birthday', 'phone', 'address_line_1', 'city', 'state', 'postal_code'])) {
      return null;
    }
    return {
      legal_name: profile.real_name,
      birthday: profile.birthday,
      phone: profile.phone,
      address_line_1: profile.address_line_1,
      address_line_2: profile.address_line_2,
      city: profile.city,
      state: profile.state,
      postal_code: profile.postal_code
    };
  }

  if (formKey === 'emergency_contact' || normalizedTitle === 'emergency contact') {
    if (!hasValues(profile, ['emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship'])) {
      return null;
    }
    return {
      emergency_contact_name: profile.emergency_contact_name,
      emergency_contact_phone: profile.emergency_contact_phone,
      emergency_contact_relationship: profile.emergency_contact_relationship
    };
  }

  return null;
}

function hydrateRegistrationBackedOnboarding(
  onboarding: EmployeeOnboarding,
  profile: EmployeeProfile,
  canReadSensitiveProfile: boolean
): EmployeeOnboarding {
  if (!onboarding.package) return onboarding;
  return {
    ...onboarding,
    items: onboarding.items.map((item) => {
      if (item.status !== 'pending' || item.item_type !== 'form') return item;
      const payload = onboardingProfilePayload(profile, item.form_key, item.title);
      if (!payload) return item;
      return {
        ...item,
        status: 'submitted' as const,
        form_payload: canReadSensitiveProfile ? JSON.stringify(payload) : item.form_payload,
        submitted_at: item.submitted_at ?? onboarding.package?.sent_at ?? item.created_at
      };
    })
  };
}

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
  const onboarding = await loadEmployeeOnboarding(db, employee.id, locals.businessId, {
    env: platform?.env,
    actorUserId: locals.userId,
    actorBusinessRole: locals.businessRole,
    actorPermissionTemplate: locals.businessPermissionTemplate,
    actorCapabilities: locals.businessCapabilities,
    auditSensitiveRead: true
  });

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
    onboarding: hydrateRegistrationBackedOnboarding(onboarding, profile, canReadSensitiveProfile),
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
  delete_user: ({ request, locals }) => deleteUser(request, locals),
  update_permissions: ({ request, locals }) => updateUserBusinessPermissions(request, locals),
  update_capabilities: ({ request, locals }) => updateUserCapabilityOverrides(request, locals),
  toggle_schedule_department: ({ request, locals }) => toggleScheduleDepartmentApproval(request, locals),
  save_profile: ({ request, locals }) => saveEmployeeProfile(request, locals),
  send_onboarding_package: ({ request, locals }) => sendEmployeeOnboardingPackage(request, locals),
  approve_onboarding_item: ({ request, locals }) => approveEmployeeOnboardingItem(request, locals),
  request_onboarding_changes: ({ request, locals }) => requestEmployeeOnboardingChanges(request, locals)
};
