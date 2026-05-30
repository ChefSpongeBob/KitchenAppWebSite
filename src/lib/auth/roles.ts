export type BusinessRole =
  | 'owner'
  | 'admin'
  | 'general_manager'
  | 'foh_manager'
  | 'boh_manager'
  | 'hourly_manager'
  | 'shift_lead'
  | 'consultant'
  | 'contractor'
  | 'staff'
  | 'user';

export type AppRole = 'admin' | 'user';

const ADMIN_BUSINESS_ROLES = new Set<BusinessRole>([
  'owner',
  'admin',
  'general_manager',
  'foh_manager',
  'boh_manager',
  'hourly_manager'
]);

const REPORT_ACCESS_ROLES = new Set<BusinessRole>([
  ...ADMIN_BUSINESS_ROLES,
  'consultant',
  'contractor'
]);

const VENDOR_ACCESS_ROLES = new Set<BusinessRole>([
  ...ADMIN_BUSINESS_ROLES,
  'consultant',
  'contractor'
]);

export const businessAccessOptions = [
  { value: 'staff', label: 'Employee' },
  { value: 'shift_lead', label: 'Shift Lead' },
  { value: 'hourly_manager', label: 'Hourly Manager' },
  { value: 'foh_manager', label: 'FOH Manager' },
  { value: 'boh_manager', label: 'BOH Manager' },
  { value: 'general_manager', label: 'General Manager' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'contractor', label: 'External Contractor' }
] as const;

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

export function normalizeBusinessRole(role: string | null | undefined): BusinessRole {
  const normalized = String(role ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (normalized === 'manager') return 'general_manager';
  if (
    normalized === 'owner' ||
    normalized === 'admin' ||
    normalized === 'general_manager' ||
    normalized === 'foh_manager' ||
    normalized === 'boh_manager' ||
    normalized === 'hourly_manager' ||
    normalized === 'shift_lead' ||
    normalized === 'consultant' ||
    normalized === 'contractor' ||
    normalized === 'staff'
  ) {
    return normalized;
  }
  return 'user';
}

export function normalizePermissionTemplate(value: string | null | undefined): PermissionTemplate {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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

export function isBusinessAdminRole(role: string | null | undefined) {
  return ADMIN_BUSINESS_ROLES.has(normalizeBusinessRole(role));
}

export function hasReportsAccess(role: string | null | undefined) {
  return REPORT_ACCESS_ROLES.has(normalizeBusinessRole(role));
}

export function hasVendorAccess(role: string | null | undefined) {
  return VENDOR_ACCESS_ROLES.has(normalizeBusinessRole(role));
}

export function hasPrivilegedFeatureAccess(role: string | null | undefined) {
  return ADMIN_BUSINESS_ROLES.has(normalizeBusinessRole(role));
}

export function effectiveAppRoleFromBusinessRole(role: string | null | undefined): AppRole {
  return isBusinessAdminRole(role) ? 'admin' : 'user';
}
