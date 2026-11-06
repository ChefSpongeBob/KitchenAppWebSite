import type { PageServerLoad } from './$types';
import { requirePlatformStaff } from '#lib/server/platformStaff.ts';
import { loadStaffHealth } from '#lib/server/platformHealth.ts';
import { isEmailConfigured } from '#lib/server/email.ts';
import { loadGatewayAttention, loadRequestDiagnostics } from '#lib/server/platformStaffDashboard.ts';
import { loadStaffDeliveryIssues } from '#lib/server/platformStaffOverview.ts';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
  const staff = await requirePlatformStaff(locals);
  const health = await loadStaffHealth(locals.DB, staff.role, url);
  const view = url.searchParams.get('view') ?? (staff.role === 'equipment' ? 'equipment' : 'application');
  if (!['application', 'equipment', 'delivery'].includes(view)) error(400, 'Choose a health view.');
  if (!health.business && staff.role === 'equipment' && view !== 'equipment') error(403, 'Support access required.');
  return { ...health, view, canViewApplication: staff.role !== 'equipment',
    diagnostics: !health.business && view === 'application' ? await loadRequestDiagnostics(locals.DB, staff.role, url) : null,
    equipment: !health.business && view === 'equipment' ? await loadGatewayAttention(locals.DB, url) : null,
    failures: !health.business && view === 'delivery' ? await loadStaffDeliveryIssues(locals.DB, staff.role, url) : null,
    emailConfigured: health.business && health.canViewDelivery && locals.env
    ? isEmailConfigured(locals.env) : null };
};
