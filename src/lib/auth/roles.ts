export type BusinessRole = 'owner' | 'manager' | 'staff' | 'external' | 'user';

export type AppRole = 'admin' | 'user';

export type BusinessCapability =
  | 'admin_access'
  | 'manage_permissions'
  | 'manage_workspace'
  | 'manage_content'
  | 'manage_people'
  | 'manage_onboarding'
  | 'manage_schedule'
  | 'manage_devices'
  | 'manage_billing'
  | 'manage_vendors'
  | 'manage_announcements'
  | 'manage_specials'
  | 'view_reports'
  | 'view_vendors'
  | 'view_sensitive_employee_data';

export type BusinessCapabilityOverrides = Partial<Record<BusinessCapability, boolean>>;

export const businessAccessOptions = [
  { value: 'staff', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'external', label: 'External' },
  { value: 'owner', label: 'Owner' }
] as const;

export const inviteAccessOptions = businessAccessOptions;

export const permissionTemplateOptions = [
  { value: 'staff', label: 'Staff' },
  { value: 'shift_lead', label: 'Shift Lead' },
  { value: 'hourly_manager', label: 'Hourly Manager' },
  { value: 'foh_manager', label: 'FOH Manager' },
  { value: 'boh_manager', label: 'BOH Manager' },
  { value: 'general_manager', label: 'General Manager' },
  { value: 'owner', label: 'Owner' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'contractor', label: 'External Contractor' }
] as const;

export type PermissionTemplate = (typeof permissionTemplateOptions)[number]['value'];

export const businessCapabilityOptions: ReadonlyArray<{
  value: BusinessCapability;
  label: string;
  group: 'Management' | 'Operations' | 'Visibility';
}> = [
  { value: 'admin_access', label: 'Manager Area', group: 'Management' },
  { value: 'manage_permissions', label: 'Employee Permissions', group: 'Management' },
  { value: 'manage_workspace', label: 'Workspace Settings', group: 'Management' },
  { value: 'manage_people', label: 'Employee Profiles', group: 'Management' },
  { value: 'manage_onboarding', label: 'Employee Onboarding', group: 'Management' },
  { value: 'view_sensitive_employee_data', label: 'Sensitive Employee Data', group: 'Management' },
  { value: 'manage_content', label: 'Lists, Recipes, Docs, and Menus', group: 'Operations' },
  { value: 'manage_schedule', label: 'Scheduling', group: 'Operations' },
  { value: 'manage_announcements', label: 'Announcements', group: 'Operations' },
  { value: 'manage_specials', label: 'Specials', group: 'Operations' },
  { value: 'manage_vendors', label: 'Vendors', group: 'Operations' },
  { value: 'manage_devices', label: 'Temperature Sensors', group: 'Operations' },
  { value: 'view_reports', label: 'Reports and Exports', group: 'Visibility' },
  { value: 'view_vendors', label: 'Vendor Directory', group: 'Visibility' },
  { value: 'manage_billing', label: 'Billing', group: 'Visibility' }
];

export const ALL_BUSINESS_CAPABILITIES = businessCapabilityOptions.map((option) => option.value);

const MANAGER_BUSINESS_CAPABILITIES = ALL_BUSINESS_CAPABILITIES.filter(
  (capability) => capability !== 'manage_billing'
);

const SHIFT_LEAD_CAPABILITIES: BusinessCapability[] = [
  'manage_content',
  'manage_schedule',
  'manage_announcements',
  'manage_specials'
];

const EXTERNAL_BUSINESS_CAPABILITIES: BusinessCapability[] = ['view_reports', 'view_vendors'];

const BUSINESS_ROLE_DEFAULT_CAPABILITIES: Record<BusinessRole, readonly BusinessCapability[]> = {
  owner: ALL_BUSINESS_CAPABILITIES,
  manager: MANAGER_BUSINESS_CAPABILITIES,
  staff: [],
  external: EXTERNAL_BUSINESS_CAPABILITIES,
  user: []
};

const PERMISSION_TEMPLATE_CAPABILITIES: Record<PermissionTemplate, readonly BusinessCapability[]> = {
  owner: ALL_BUSINESS_CAPABILITIES,
  general_manager: MANAGER_BUSINESS_CAPABILITIES,
  foh_manager: MANAGER_BUSINESS_CAPABILITIES,
  boh_manager: MANAGER_BUSINESS_CAPABILITIES,
  hourly_manager: MANAGER_BUSINESS_CAPABILITIES,
  shift_lead: SHIFT_LEAD_CAPABILITIES,
  consultant: EXTERNAL_BUSINESS_CAPABILITIES,
  contractor: EXTERNAL_BUSINESS_CAPABILITIES,
  staff: []
};

export function normalizeBusinessRole(role: string | null | undefined): BusinessRole {
  const normalized = String(role ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (normalized === 'owner') return 'owner';
  if (
    normalized === 'manager' ||
    normalized === 'admin' ||
    normalized === 'general_manager' ||
    normalized === 'foh_manager' ||
    normalized === 'boh_manager' ||
    normalized === 'hourly_manager'
  ) {
    return 'manager';
  }
  if (normalized === 'external' || normalized === 'consultant' || normalized === 'contractor') {
    return 'external';
  }
  if (normalized === 'staff' || normalized === 'shift_lead' || normalized === 'employee') return 'staff';
  return 'user';
}

export function normalizePermissionTemplate(value: string | null | undefined): PermissionTemplate {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (normalized === 'admin' || normalized === 'manager') return 'general_manager';
  if (normalized === 'external') return 'contractor';
  const match = permissionTemplateOptions.find((option) => option.value === normalized);
  return match?.value ?? 'staff';
}

export function businessRoleLabel(role: string | null | undefined) {
  const normalized = normalizeBusinessRole(role);
  return businessAccessOptions.find((option) => option.value === normalized)?.label ?? 'Employee';
}

export function permissionTemplateLabel(template: string | null | undefined) {
  const normalized = normalizePermissionTemplate(template);
  return permissionTemplateOptions.find((option) => option.value === normalized)?.label ?? 'Staff';
}

export function defaultPermissionTemplateForRole(role: string | null | undefined): PermissionTemplate {
  const normalized = normalizeBusinessRole(role);
  if (normalized === 'owner') return 'owner';
  if (normalized === 'manager') return 'general_manager';
  if (normalized === 'external') return 'contractor';
  return 'staff';
}

export function businessRoleCapabilities(role: string | null | undefined) {
  return [...BUSINESS_ROLE_DEFAULT_CAPABILITIES[normalizeBusinessRole(role)]];
}

export function permissionTemplateCapabilities(template: string | null | undefined) {
  return [...PERMISSION_TEMPLATE_CAPABILITIES[normalizePermissionTemplate(template)]];
}

export function resolveBusinessCapabilities(
  role: string | null | undefined,
  permissionTemplate?: string | null,
  overrides: BusinessCapabilityOverrides = {}
) {
  const normalizedRole = normalizeBusinessRole(role);
  if (normalizedRole === 'owner') return [...ALL_BUSINESS_CAPABILITIES];

  const hasTemplate = Boolean(String(permissionTemplate ?? '').trim());
  const defaults = hasTemplate
    ? permissionTemplateCapabilities(permissionTemplate)
    : businessRoleCapabilities(normalizedRole);
  const resolved = new Set<BusinessCapability>(defaults);

  for (const capability of ALL_BUSINESS_CAPABILITIES) {
    if (overrides[capability] === true) resolved.add(capability);
    if (overrides[capability] === false) resolved.delete(capability);
  }

  if (Array.from(resolved).some((capability) => capability.startsWith('manage_'))) {
    resolved.add('admin_access');
  }

  return ALL_BUSINESS_CAPABILITIES.filter((capability) => resolved.has(capability));
}

export function hasBusinessCapability(
  role: string | null | undefined,
  permissionTemplate: string | null | undefined,
  capability: BusinessCapability,
  effectiveCapabilities?: readonly BusinessCapability[] | null
) {
  if (effectiveCapabilities) return effectiveCapabilities.includes(capability);
  return resolveBusinessCapabilities(role, permissionTemplate).includes(capability);
}

export function isBusinessAdminRole(role: string | null | undefined) {
  const normalized = normalizeBusinessRole(role);
  return normalized === 'owner' || normalized === 'manager';
}

export function hasAdminAccess(
  role: string | null | undefined,
  permissionTemplate?: string | null,
  effectiveCapabilities?: readonly BusinessCapability[] | null
) {
  return hasBusinessCapability(role, permissionTemplate, 'admin_access', effectiveCapabilities);
}

export function hasReportsAccess(
  role: string | null | undefined,
  permissionTemplate?: string | null,
  effectiveCapabilities?: readonly BusinessCapability[] | null
) {
  return hasBusinessCapability(role, permissionTemplate, 'view_reports', effectiveCapabilities);
}

export function hasVendorAccess(
  role: string | null | undefined,
  permissionTemplate?: string | null,
  effectiveCapabilities?: readonly BusinessCapability[] | null
) {
  return hasBusinessCapability(role, permissionTemplate, 'view_vendors', effectiveCapabilities);
}

export function hasPrivilegedFeatureAccess(
  role: string | null | undefined,
  permissionTemplate?: string | null,
  effectiveCapabilities?: readonly BusinessCapability[] | null
) {
  return hasBusinessCapability(role, permissionTemplate, 'admin_access', effectiveCapabilities);
}

export function hasManagementAccess(
  role: string | null | undefined,
  permissionTemplate?: string | null,
  effectiveCapabilities?: readonly BusinessCapability[] | null
) {
  const capabilities = effectiveCapabilities ?? resolveBusinessCapabilities(role, permissionTemplate);
  return capabilities.some((capability) => capability === 'admin_access' || capability.startsWith('manage_'));
}

export function effectiveAppRoleFromBusinessRole(
  role: string | null | undefined,
  permissionTemplate?: string | null,
  effectiveCapabilities?: readonly BusinessCapability[] | null
): AppRole {
  return hasManagementAccess(role, permissionTemplate, effectiveCapabilities) ? 'admin' : 'user';
}
