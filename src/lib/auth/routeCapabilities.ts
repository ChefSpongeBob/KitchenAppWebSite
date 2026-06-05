import type { BusinessCapability } from '$lib/auth/roles';

const ROUTE_CAPABILITIES: ReadonlyArray<{
  prefix: string;
  capability: BusinessCapability;
}> = [
  { prefix: '/admin/users', capability: 'manage_people' },
  { prefix: '/admin/onboarding', capability: 'manage_onboarding' },
  { prefix: '/admin/schedule', capability: 'manage_schedule' },
  { prefix: '/admin/schedule-roles', capability: 'manage_schedule' },
  { prefix: '/admin/schedule-settings', capability: 'manage_schedule' },
  { prefix: '/admin/camera', capability: 'manage_devices' },
  { prefix: '/admin/sensors', capability: 'manage_devices' },
  { prefix: '/admin/vendors', capability: 'manage_vendors' },
  { prefix: '/admin/app-editor', capability: 'manage_workspace' },
  { prefix: '/admin/creator', capability: 'manage_content' },
  { prefix: '/admin/category-creator', capability: 'manage_content' },
  { prefix: '/admin/documents', capability: 'manage_content' },
  { prefix: '/admin/lists', capability: 'manage_content' },
  { prefix: '/admin/menus', capability: 'manage_content' },
  { prefix: '/admin/recipes', capability: 'manage_content' },
  { prefix: '/reports', capability: 'view_reports' },
  { prefix: '/vendors', capability: 'view_vendors' },
  { prefix: '/billing', capability: 'manage_billing' },
  { prefix: '/admin', capability: 'admin_access' }
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function resolveBusinessCapabilityForPath(pathname: string): BusinessCapability | null {
  return ROUTE_CAPABILITIES.find((route) => matchesPrefix(pathname, route.prefix))?.capability ?? null;
}
