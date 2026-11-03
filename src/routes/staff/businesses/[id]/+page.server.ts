import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requirePlatformStaff } from '#lib/server/platformStaff.ts';
import { loadBusinessSecurity, loadGatewayAttention, loadRecentStaffActivity, loadRequestDiagnostics } from '#lib/server/platformStaffDashboard.ts';

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const staff = await requirePlatformStaff(locals);
  const requestedView = url?.searchParams.get('view') ?? 'overview';
  const activeView = ['overview', 'application', 'equipment', 'security', 'activity'].includes(requestedView) ? requestedView : 'overview';
  if (['security', 'activity'].includes(activeView) && staff.role !== 'owner') error(403, 'Platform owner access required.');
  if (activeView === 'application' && staff.role === 'equipment') error(403, 'Application support access required.');
  if (!params.id || params.id.length > 80) error(404, 'Business not found.');
  const business = await locals.DB.prepare(`
    SELECT id, name, slug, status, plan_tier, contact_email, contact_phone, created_at,
      (SELECT COUNT(*) FROM business_users bu WHERE bu.business_id = b.id AND bu.is_active = 1) AS members,
      (SELECT COUNT(*) FROM iot_devices d WHERE d.business_id = b.id AND d.device_type = 'sensor_gateway' AND d.is_active = 1) AS gateways
    FROM businesses b WHERE id = ? LIMIT 1
  `).bind(params.id).first<{ id: string; name: string; slug: string; status: string; plan_tier: string;
    contact_email: string | null; contact_phone: string | null; created_at: number; members: number; gateways: number }>();
  if (!business) error(404, 'Business not found.');
  const subscriptions = activeView === 'overview' ? await locals.DB.prepare(`
    SELECT store, entitlement_key, status, current_period_end, verified_at
    FROM business_store_entitlements WHERE business_id = ? ORDER BY updated_at DESC LIMIT 20
  `).bind(business.id).all<{ store: string; entitlement_key: string; status: string; current_period_end: number | null; verified_at: number | null }>() : { results: [] };
  const now = Math.floor(Date.now() / 1000);
  return { business, subscriptions: activeView === 'overview' ? subscriptions.results : [], activeView,
    canViewApplication: staff.role !== 'equipment', canViewSecurity: staff.role === 'owner',
    diagnostics: activeView === 'application' ? await loadRequestDiagnostics(locals.DB, staff.role, url, business.id, now) : null,
    equipment: activeView === 'equipment' ? await loadGatewayAttention(locals.DB, url, business.id, now) : null,
    security: activeView === 'security' ? await loadBusinessSecurity(locals.DB, staff.role, business.id, url, now) : null,
    activity: activeView === 'activity' ? await loadRecentStaffActivity(locals.DB, business.id, now) : [] };
};
