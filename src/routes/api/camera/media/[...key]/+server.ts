import { cameraBetaEnabled } from '$lib/config/features';
import { ensureCameraSchema } from '$lib/server/camera';
import { ensureTenantSchema } from '$lib/server/tenant';
import { logOperationalEvent } from '$lib/server/observability';

function responseHeaders(contentType: string, etag?: string) {
  const headers = new Headers({
    'content-type': contentType,
    'cache-control': 'private, no-store'
  });
  if (etag) headers.set('etag', etag);
  return headers;
}

function isSafeCameraKey(key: string) {
  return Boolean(key) && !key.includes('..') && !key.startsWith('/') && !key.includes('\\');
}

export async function GET({ params, platform, locals, url, request }) {
  if (!cameraBetaEnabled) {
    return new Response('Not found.', { status: 404 });
  }
  const bucket = platform?.env?.CAMERA_MEDIA;
  const db = locals.DB ?? platform?.env?.DB;
  if (!bucket) {
    logOperationalEvent({
      level: 'error',
      event: 'camera_media_bucket_missing',
      request,
      businessId: locals.businessId,
      userId: locals.userId,
      status: 503
    });
    return new Response('Camera media bucket not configured.', { status: 503 });
  }
  if (!db || !locals.userId || !locals.businessId) {
    logOperationalEvent({
      level: 'warn',
      event: 'camera_media_access_denied',
      request,
      businessId: locals.businessId,
      userId: locals.userId,
      status: 401,
      metadata: { reason: 'missing_session' }
    });
    return new Response('Unauthorized.', { status: 401 });
  }

  const key = params.key;
  if (!isSafeCameraKey(key)) {
    return new Response('Missing media key.', { status: 400 });
  }

  const businessPrefix = `businesses/${locals.businessId}/camera/`;
  if (!key.startsWith(businessPrefix)) {
    await ensureCameraSchema(db);
    await ensureTenantSchema(db, true);
    const mediaUrl = `${url.origin}/api/camera/media/${key}`;
    const mediaPathMatch = `%/api/camera/media/${key}`;
    const record = await db
      .prepare(
        `
        SELECT id
        FROM camera_events
        WHERE business_id = ?
          AND (image_url = ? OR clip_url = ? OR image_url LIKE ? OR clip_url LIKE ?)
        LIMIT 1
        `
      )
      .bind(locals.businessId, mediaUrl, mediaUrl, mediaPathMatch, mediaPathMatch)
      .first<{ id: string }>();

    if (!record) {
      logOperationalEvent({
        level: 'warn',
        event: 'camera_media_cross_tenant_key_blocked',
        request,
        businessId: locals.businessId,
        userId: locals.userId,
        status: 404,
        metadata: { reason: 'record_missing' }
      });
      return new Response('Not found.', { status: 404 });
    }
  }

  const object = await bucket.get(key);
  if (!object) {
    logOperationalEvent({
      level: 'warn',
      event: 'camera_media_object_missing',
      request,
      businessId: locals.businessId,
      userId: locals.userId,
      status: 404
    });
    return new Response('Not found.', { status: 404 });
  }

  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream';
  const body = await object.arrayBuffer();

  return new Response(body, {
    headers: responseHeaders(contentType, object.httpEtag)
  });
}
