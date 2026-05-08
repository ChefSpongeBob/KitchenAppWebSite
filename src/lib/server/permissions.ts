export type BusinessRole = 'owner' | 'admin' | 'manager' | 'staff' | 'user';
export type AppRole = 'admin' | 'user';

export function normalizeBusinessRole(role: string | null | undefined): BusinessRole {
  const normalized = String(role ?? '').trim().toLowerCase();
  if (normalized === 'owner' || normalized === 'admin' || normalized === 'manager' || normalized === 'staff') {
    return normalized;
  }
  return 'user';
}

export function isBusinessAdminRole(role: string | null | undefined) {
  const normalized = normalizeBusinessRole(role);
  return normalized === 'owner' || normalized === 'admin' || normalized === 'manager';
}

export function effectiveAppRoleFromBusinessRole(role: string | null | undefined): AppRole {
  return isBusinessAdminRole(role) ? 'admin' : 'user';
}
