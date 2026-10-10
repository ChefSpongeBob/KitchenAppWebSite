import { json, type RequestHandler } from '@sveltejs/kit';
import { processTemperatureStaleAlerts } from '$lib/server/temperatureMonitoring';
import { bearerTokenFromRequest, constantTimeTokenEqual } from '$lib/server/requestTokens';

const MAX_BUSINESS_BATCH = 25;

type ProcessPayload = {
  businessId?: string;
  businessIds?: string[];
};

function isAuthorized(request: Request, env: App.Platform['env'] | undefined) {
  const token = env?.SMOKE_INTERNAL_TOKEN?.trim();
  if (!token) return false;
  const headerToken = request.headers.get('x-smoke-token')?.trim();
  const bearer = bearerTokenFromRequest(request);
  return constantTimeTokenEqual(token, headerToken) || constantTimeTokenEqual(token, bearer);
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
  if (!isAuthorized(request, platform?.env)) {
    return json({ ok: false, error: 'Not found.' }, { status: 404 });
  }

  const db = locals.DB ?? platform?.env?.DB;
  if (!db) {
    return json({ ok: false, error: 'Database unavailable.' }, { status: 503 });
  }

  const payload = (await request.json().catch(() => null)) as ProcessPayload | null;
  const requestedIds = [
    String(payload?.businessId ?? locals.businessId ?? '').trim(),
    ...(Array.isArray(payload?.businessIds) ? payload.businessIds : [])
  ];
  const businessIds = Array.from(
    new Set(requestedIds.map((value) => String(value ?? '').trim()).filter(Boolean))
  ).slice(0, MAX_BUSINESS_BATCH);

  if (businessIds.length === 0) {
    return json({ ok: false, error: 'Business required.' }, { status: 400 });
  }

  const summaries: Array<{ businessId: string; processed: number }> = [];
  for (let offset = 0; offset < businessIds.length; offset += 5) {
    const batch = businessIds.slice(offset, offset + 5);
    const results = await Promise.all(
      batch.map(async (businessId) => ({
        businessId,
        ...(await processTemperatureStaleAlerts(db, businessId))
      }))
    );
    summaries.push(...results);
  }

  return json(
    {
      ok: true,
      businessesProcessed: summaries.length,
      processed: summaries.reduce((total, summary) => total + summary.processed, 0),
      summaries
    },
    {
      headers: {
        'cache-control': 'no-store'
      }
    }
  );
};
