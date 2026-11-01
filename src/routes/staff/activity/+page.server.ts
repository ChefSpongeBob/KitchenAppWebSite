import type { PageServerLoad } from './$types';
import { requirePlatformStaff, staffPageNumber } from '$lib/server/platformStaff';

export const load: PageServerLoad = async ({ locals, url }) => {
  await requirePlatformStaff(locals, ['owner']);
  const page = staffPageNumber(url.searchParams.get('page'));
  const rows = await locals.DB.prepare(`
    SELECT id, actor_user_id, target_user_id, action, business_id, device_serial, reason, created_at
    FROM platform_staff_audit ORDER BY created_at DESC, id LIMIT 21 OFFSET ?
  `).bind((page - 1) * 20).all<{ id: string; actor_user_id: string | null; target_user_id: string | null; action: string;
    business_id: string | null; device_serial: string | null; reason: string; created_at: number }>();
  return { page, events: rows.results.slice(0, 20), hasNext: rows.results.length > 20 };
};
