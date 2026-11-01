import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePlatformStaff } from '$lib/server/platformStaff';
import { beginStaffPasskey, finishStaffPasskey, removeStaffPasskey, staffPasskeyOrigin } from '$lib/server/platformPasskeys';
import { checkRateLimit } from '$lib/server/security';

export const POST: RequestHandler = async ({ locals, request, url, platform }) => {
  const headers = { 'cache-control': 'no-store' };
  if (request.headers.get('origin') !== url.origin) return json({ error: 'Request not allowed.' }, { status: 403, headers });
  const staff = await requirePlatformStaff(locals, undefined, true);
  if (!locals.sessionId) return json({ error: 'Sign in again.' }, { status: 401, headers });
  const limit = await checkRateLimit(locals.DB, { action: 'staff-passkey', identifier: staff.userId, limit: 30, windowSeconds: 300, blockSeconds: 300 });
  if (!limit.allowed) return json({ error: 'Please wait before trying passkeys again.' }, { status: 429, headers });
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 32768) return json({ error: 'Request too large.' }, { status: 413, headers });
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'Invalid request.' }, { status: 400, headers });
    const decoder = new TextDecoder();
    let raw = '', size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 32768) { await reader.cancel(); return json({ error: 'Request too large.' }, { status: 413, headers }); }
        raw += decoder.decode(chunk.value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request.' }, { status: 400, headers });
    const relyingParty = staffPasskeyOrigin(url, platform?.env.APP_BASE_URL);
    if (body.action === 'remove') {
      if (typeof body.id !== 'string' || body.id.length > 2048) return json({ error: 'Choose a passkey.' }, { status: 400, headers });
      await removeStaffPasskey(locals.DB, staff, locals.sessionId, relyingParty.rpID, body.id);
      return json({ ok: true }, { headers });
    }
    if (!['register', 'authenticate'].includes(body.purpose)) return json({ error: 'Invalid request.' }, { status: 400, headers });
    if (body.action === 'options') return json(await beginStaffPasskey(locals.DB, staff, locals.sessionId, relyingParty, body.purpose), { headers });
    if (body.action !== 'verify' || !body.response || typeof body.response.id !== 'string') return json({ error: 'Invalid request.' }, { status: 400, headers });
    await finishStaffPasskey(locals.DB, staff, locals.sessionId, relyingParty, body.purpose, body.response, body.name);
    return json({ ok: true }, { headers });
  } catch (err) {
    if (isHttpError(err)) return json({ error: err.body.message }, { status: err.status, headers });
    return json({ error: 'Passkey could not be verified. Try again.' }, { status: 400, headers });
  }
};
