import { json, type RequestHandler } from '@sveltejs/kit';
import { revokePushDevice } from '$lib/server/pushNotifications';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.userId || !locals.businessId) {
    return json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }
  const db = locals.DB;
  if (!db) {
    return json({ ok: false, error: 'Database unavailable.' }, { status: 503 });
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        token?: string;
        tokenHash?: string;
        deviceId?: string;
      }
    | null;

  const revoked = await revokePushDevice(db, {
    businessId: locals.businessId,
    userId: locals.userId,
    token: payload?.token,
    tokenHash: payload?.tokenHash,
    deviceId: payload?.deviceId
  });

  return json(
    { ok: true, revoked },
    {
      headers: {
        'cache-control': 'no-store'
      }
    }
  );
};
