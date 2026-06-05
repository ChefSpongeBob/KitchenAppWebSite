import { json, type RequestHandler } from '@sveltejs/kit';
import { registerPushDevice } from '$lib/server/pushNotifications';

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
        platform?: string;
        deviceId?: string;
        appVersion?: string;
      }
    | null;

  const token = String(payload?.token ?? '').trim();
  if (!token) {
    return json({ ok: false, error: 'Missing token.' }, { status: 400 });
  }

  await registerPushDevice(db, {
    businessId: locals.businessId,
    userId: locals.userId,
    token,
    platform: payload?.platform,
    deviceId: payload?.deviceId,
    appVersion: payload?.appVersion,
    userAgent: request.headers.get('user-agent')
  });

  return json(
    { ok: true },
    {
      headers: {
        'cache-control': 'no-store'
      }
    }
  );
};
