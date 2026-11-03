import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requirePlatformStaff } from '#lib/server/platformStaff.ts';

export const load: PageServerLoad = async ({ locals, params }) => {
  await requirePlatformStaff(locals);
  if (!params.id || params.id.length > 80) error(404, 'Business not found.');
  const business = await locals.DB.prepare(`
    SELECT id, name, slug, status, plan_tier, contact_email, contact_phone, created_at,
      (SELECT COUNT(*) FROM business_users bu WHERE bu.business_id = b.id AND bu.is_active = 1) AS members,
      (SELECT COUNT(*) FROM iot_devices d WHERE d.business_id = b.id AND d.device_type = 'sensor_gateway' AND d.is_active = 1) AS gateways
    FROM businesses b WHERE id = ? LIMIT 1
  `).bind(params.id).first<{ id: string; name: string; slug: string; status: string; plan_tier: string;
    contact_email: string | null; contact_phone: string | null; created_at: number; members: number; gateways: number }>();
  if (!business) error(404, 'Business not found.');
  const subscriptions = await locals.DB.prepare(`
    SELECT store, entitlement_key, status, current_period_end, verified_at
    FROM business_store_entitlements WHERE business_id = ? ORDER BY updated_at DESC LIMIT 20
  `).bind(business.id).all<{ store: string; entitlement_key: string; status: string; current_period_end: number | null; verified_at: number | null }>();
  return { business, subscriptions: subscriptions.results };
};
