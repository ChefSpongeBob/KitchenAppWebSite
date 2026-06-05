import { json, type RequestHandler } from '@sveltejs/kit';
import { processOperationalEvents } from '$lib/server/operationalEvents';
import { logOperationalError, logOperationalEvent } from '$lib/server/observability';

function readInternalToken(platform: App.Platform | undefined) {
  const platformValue = platform?.env?.SMOKE_INTERNAL_TOKEN;
  if (typeof platformValue === 'string' && platformValue.trim()) return platformValue.trim();
  const nodeProcess = (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process;
  return nodeProcess?.env?.SMOKE_INTERNAL_TOKEN?.trim() ?? '';
}

function suppliedToken(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  return bearer || request.headers.get('x-smoke-token')?.trim() || '';
}

function isAuthorized(request: Request, platform: App.Platform | undefined) {
  const expected = readInternalToken(platform);
  const supplied = suppliedToken(request);
  return Boolean(expected && supplied && supplied === expected);
}

async function readLimit(request: Request) {
  const url = new URL(request.url);
  const queryLimit = Number(url.searchParams.get('limit') ?? 0);
  if (Number.isFinite(queryLimit) && queryLimit > 0) return queryLimit;

  try {
    const payload = (await request.json()) as { limit?: number };
    const bodyLimit = Number(payload.limit ?? 0);
    if (Number.isFinite(bodyLimit) && bodyLimit > 0) return bodyLimit;
  } catch {
    return 50;
  }
  return 50;
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
  if (!isAuthorized(request, platform)) {
    return json({ ok: false, error: 'Not found.' }, { status: 404 });
  }

  const db = locals.DB ?? platform?.env?.DB;
  if (!db) {
    logOperationalEvent({
      level: 'error',
      event: 'operational_event_processor_db_unavailable',
      request,
      status: 503
    });
    return json({ ok: false, error: 'Database unavailable.' }, { status: 503 });
  }

  try {
    const limit = await readLimit(request);
    const result = await processOperationalEvents(db, {
      env: platform?.env,
      request,
      limit
    });

    return json(
      {
        ok: true,
        ...result
      },
      {
        headers: {
          'cache-control': 'no-store'
        }
      }
    );
  } catch (error) {
    logOperationalError({
      event: 'operational_event_processor_failed',
      request,
      status: 500,
      error
    });
    return json({ ok: false, error: 'Processor failed.' }, { status: 500 });
  }
};
