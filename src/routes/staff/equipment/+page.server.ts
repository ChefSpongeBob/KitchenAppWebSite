import { fail, isHttpError } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePlatformStaff, requireStaffStepUp, loadStaffStepUp, releaseGatewayReservation, reserveGateway, searchPattern, staffPageNumber, staffSearch } from '#lib/server/platformStaff.ts';
import { checkRateLimit, rateLimitFailure } from '#lib/server/security.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
  const staff = await requirePlatformStaff(locals);
  const q = staffSearch(url.searchParams.get('q'));
  const page = staffPageNumber(url.searchParams.get('page'));
  const businessId = staffSearch(url.searchParams.get('business'));
  const business = businessId ? await locals.DB.prepare('SELECT id, name FROM businesses WHERE id = ? LIMIT 1')
    .bind(businessId).first<{ id: string; name: string }>() : null;
  const rows = await locals.DB.prepare(`
    SELECT i.serial, i.hardware_model, i.claim_status,
      r.business_id AS reserved_business_id, rb.name AS reserved_business_name,
      i.claimed_business_id, cb.name AS claimed_business_name
    FROM iot_device_inventory i
    LEFT JOIN iot_device_reservations r ON r.serial = i.serial
    LEFT JOIN businesses rb ON rb.id = r.business_id
    LEFT JOIN businesses cb ON cb.id = i.claimed_business_id
    WHERE i.device_type = 'sensor_gateway' AND (? = '' OR i.serial LIKE ? ESCAPE '\\')
    ORDER BY i.serial LIMIT 21 OFFSET ?
  `).bind(q, searchPattern(q), (page - 1) * 20).all<{
    serial: string; hardware_model: string | null; claim_status: string;
    reserved_business_id: string | null; reserved_business_name: string | null;
    claimed_business_id: string | null; claimed_business_name: string | null;
  }>();
  return { q, page, business, equipment: rows.results.slice(0, 20), hasNext: rows.results.length > 20,
    canAssign: ['owner', 'equipment'].includes(staff.role),
    changesUnlocked: Boolean(locals.sessionId && await loadStaffStepUp(locals.DB, staff.userId, locals.sessionId)) };
};

async function mutate(event: Parameters<Actions[string]>[0], release: boolean) {
  const staff = await requireStaffStepUp(event.locals, ['owner', 'equipment']);
  const limit = await checkRateLimit(event.locals.DB, {
    action: 'staff-equipment-assignment', identifier: staff.userId,
    limit: 30, windowSeconds: 300, blockSeconds: 60
  });
  if (!limit.allowed) return rateLimitFailure('Please wait before changing equipment assignments.');
  const form = await event.request.formData();
  if (form.get('confirmed') !== 'yes') return fail(400, { error: 'Confirm the equipment change.' });
  const serial = String(form.get('serial') ?? '').trim();
  const reason = String(form.get('reason') ?? '').trim();
  try {
    if (release) await releaseGatewayReservation(event.locals.DB, staff, serial, reason, event.locals.sessionId!);
    else await reserveGateway(event.locals.DB, staff, serial, String(form.get('business_id') ?? '').trim(), reason, event.locals.sessionId!);
    return { success: true, message: release ? 'Reservation released.' : 'Gateway reserved.' };
  } catch (err) {
    if (isHttpError(err)) return fail(err.status, { error: err.body.message });
    return fail(409, { error: 'Assignment could not be saved. Refresh and check the gateway.' });
  }
}

export const actions: Actions = { reserve: event => mutate(event, false), release: event => mutate(event, true) };
