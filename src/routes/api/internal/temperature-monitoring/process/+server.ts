import { json, type RequestHandler } from '@sveltejs/kit';
import { processTemperatureStaleAlerts } from '$lib/server/temperatureMonitoring';

function isAuthorized(request: Request, env: App.Platform['env'] | undefined) {
  const token = env?.SMOKE_INTERNAL_TOKEN?.trim();
  if (!token) return false;
  const headerToken = request.headers.get('x-smoke-token')?.trim();
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  return headerToken === token || bearer === token;
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
  if (!isAuthorized(request, platform?.env)) {
    return json({ ok: false, error: 'Not found.' }, { status: 404 });
  }

  const db = locals.DB ?? platform?.env?.DB;
  if (!db) {
    return json({ ok: false, error: 'Database unavailable.' }, { status: 503 });
  }

  const payload = (await request.json().catch(() => null)) as { businessId?: string } | null;
  const businessId = String(payload?.businessId ?? locals.businessId ?? '').trim();
  if (!businessId) {
    return json({ ok: false, error: 'Business required.' }, { status: 400 });
  }

  const summary = await processTemperatureStaleAlerts(db, businessId, request);
  return json(
    { ok: true, ...summary },
    {
      headers: {
        'cache-control': 'no-store'
      }
    }
  );
};
