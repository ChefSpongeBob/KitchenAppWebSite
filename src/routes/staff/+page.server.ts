import { requirePlatformStaff } from '#lib/server/platformStaff.ts';
import { loadGatewayAttention, loadRecentStaffActivity, loadRequestDiagnostics } from '#lib/server/platformStaffDashboard.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const staff = await requirePlatformStaff(locals);
  const now = Math.floor(Date.now() / 1000);
  const diagnostics = await loadRequestDiagnostics(locals.DB, staff.role, url, undefined, now);
  const equipment = await loadGatewayAttention(locals.DB, url, undefined, now);
  const activity = staff.role === 'owner' ? await loadRecentStaffActivity(locals.DB, undefined, now) : [];
  return { diagnostics, equipment, activity, canViewActivity: staff.role === 'owner' };
};
