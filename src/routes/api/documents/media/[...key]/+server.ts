import type { RequestHandler } from './$types';
import { logOperationalEvent } from '$lib/server/observability';
import { canAccessEmployeeSensitiveData, writeSensitiveRecordAudit } from '$lib/server/sensitive';

export const GET: RequestHandler = async ({ params, platform, locals, request }) => {
  const bucket = platform?.env?.DOC_MEDIA;
  if (!bucket) {
    logOperationalEvent({
      level: 'error',
      event: 'document_media_bucket_missing',
      request,
      businessId: locals.businessId,
      userId: locals.userId,
      status: 503
    });
    return new Response('Document media bucket not configured.', { status: 503 });
  }

  const key = params.key
    .split('/')
    .map((part) => decodeURIComponent(part))
    .join('/');

  if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    return new Response('Missing media key.', { status: 400 });
  }

  if (!locals.userId || !locals.DB || !locals.businessId) {
    logOperationalEvent({
      level: 'warn',
      event: 'document_media_access_denied',
      request,
      status: 401,
      metadata: { reason: 'missing_session' }
    });
    return new Response('Unauthorized.', { status: 401 });
  }

  const encodedKey = key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  const fileUrl = `/api/documents/media/${encodedKey}`;
  const businessMediaPrefix = `businesses/${locals.businessId}/`;

  if (key.includes('/employee-onboarding/')) {
    const record = await locals.DB
      .prepare(
        `
        SELECT user_id, business_id
        FROM employee_onboarding_items
        WHERE (file_url = ? OR source_file_url = ?)
          AND business_id = ?
        LIMIT 1
        `
      )
      .bind(fileUrl, fileUrl, locals.businessId)
      .first<{ user_id: string; business_id: string }>();

    const canReadEmployeeOnboardingMedia =
      record &&
      (await canAccessEmployeeSensitiveData(
        locals.DB,
        locals.businessId,
        locals.userId,
        locals.businessRole,
        record.user_id
      ));

    if (record && !canReadEmployeeOnboardingMedia) {
      logOperationalEvent({
        level: 'warn',
        event: 'document_media_access_denied',
        request,
        businessId: locals.businessId,
        userId: locals.userId,
        status: 403,
        metadata: { reason: 'employee_onboarding_owner_mismatch' }
      });
      return new Response('Forbidden.', { status: 403 });
    }

    if (record && record.user_id !== locals.userId) {
      await writeSensitiveRecordAudit(locals.DB, {
        businessId: locals.businessId,
        userId: record.user_id,
        actorUserId: locals.userId,
        action: 'employee_onboarding_media_read',
        request,
        metadata: { keyType: 'employee_onboarding' }
      });
    }

    if (!record) {
      const templateRecord = await locals.DB
        .prepare(
          `
          SELECT id
          FROM employee_onboarding_template_items
          WHERE source_file_url = ?
            AND business_id = ?
            AND COALESCE(is_active, 1) = 1
          LIMIT 1
          `
        )
        .bind(fileUrl, locals.businessId)
        .first<{ id: string }>();

      if (!templateRecord || locals.userRole !== 'admin') {
        logOperationalEvent({
          level: 'warn',
          event: 'document_media_not_found',
          request,
          businessId: locals.businessId,
          userId: locals.userId,
          status: 404,
          metadata: { reason: 'onboarding_record_missing' }
        });
        return new Response('Not found.', { status: 404 });
      }
    }
  } else {
    if (key.startsWith('businesses/') && !key.startsWith(businessMediaPrefix)) {
      logOperationalEvent({
        level: 'warn',
        event: 'document_media_cross_tenant_key_blocked',
        request,
        businessId: locals.businessId,
        userId: locals.userId,
        status: 404,
        metadata: { reason: 'business_prefix_mismatch' }
      });
      return new Response('Not found.', { status: 404 });
    }

    const documentRecord = await locals.DB
      .prepare(
        `
        SELECT id
        FROM documents
        WHERE file_url = ?
          AND business_id = ?
          AND COALESCE(is_active, 1) = 1
        LIMIT 1
        `
      )
      .bind(fileUrl, locals.businessId)
      .first<{ id: string }>();

    if (!documentRecord) {
      const templateRecord = await locals.DB
        .prepare(
          `
          SELECT id
          FROM employee_onboarding_template_items
          WHERE source_file_url = ?
            AND business_id = ?
            AND COALESCE(is_active, 1) = 1
          LIMIT 1
          `
        )
        .bind(fileUrl, locals.businessId)
        .first<{ id: string }>();

      if (!templateRecord) {
        const brandingRecord = await locals.DB
          .prepare(
            `
            SELECT id
            FROM businesses
            WHERE id = ?
              AND sidebar_logo_url = ?
            LIMIT 1
            `
          )
          .bind(locals.businessId, fileUrl)
          .first<{ id: string }>();

        if (!brandingRecord) {
          logOperationalEvent({
            level: 'warn',
            event: 'document_media_not_found',
            request,
            businessId: locals.businessId,
            userId: locals.userId,
            status: 404,
            metadata: { reason: 'record_missing' }
          });
          return new Response('Not found.', { status: 404 });
        }
      }
    }
  }

  const object = await bucket.get(key);
  if (!object) {
    logOperationalEvent({
      level: 'warn',
      event: 'document_media_object_missing',
      request,
      businessId: locals.businessId,
      userId: locals.userId,
      status: 404
    });
    return new Response('Not found.', { status: 404 });
  }

  const headers = new Headers();
  if (object.httpMetadata?.contentType) {
    headers.set('content-type', object.httpMetadata.contentType);
  } else {
    headers.set('content-type', 'application/octet-stream');
  }
  headers.set('cache-control', 'private, no-store');
  headers.set('etag', object.httpEtag);

  return new Response(object.body as unknown as BodyInit, { headers });
};
