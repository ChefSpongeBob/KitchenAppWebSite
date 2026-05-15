import { json } from '@sveltejs/kit';
import { cameraBetaEnabled } from '$lib/config/features';
import {
  cleanupExpiredCameraMedia,
  ensureCameraSchema,
  extensionFromContentType
} from '$lib/server/camera';
import { allowIoTIngest, authenticateIoTDevice } from '$lib/server/iotIngest';
import { ensureTenantSchema } from '$lib/server/tenant';

const MAX_CAMERA_STILL_BYTES = 8 * 1024 * 1024;
const MAX_CAMERA_CLIP_BYTES = 25 * 1024 * 1024;

export async function POST({ request, platform, url }) {
  if (!cameraBetaEnabled) {
    return json({ error: 'Not found.' }, { status: 404 });
  }
  const bucket = platform?.env?.CAMERA_MEDIA;
  const db = platform?.env?.DB;
  if (!bucket) {
    return json({ error: 'Camera media bucket not configured.' }, { status: 503 });
  }
  const device = db ? await authenticateIoTDevice(db, request, 'camera') : null;
  if (!device) return json({ error: 'Device credentials required.' }, { status: 401 });

  const contentType = request.headers.get('content-type') ?? 'application/octet-stream';
  const kind = (url.searchParams.get('kind') ?? 'still').trim() || 'still';
  const maxUploadBytes = kind === 'clip' ? MAX_CAMERA_CLIP_BYTES : MAX_CAMERA_STILL_BYTES;
  const declaredLength = Number(request.headers.get('content-length') ?? NaN);
  if (Number.isFinite(declaredLength) && declaredLength > maxUploadBytes) {
    return json({ error: 'Camera upload is too large.' }, { status: 413 });
  }

  const fileBuffer = await request.arrayBuffer();
  if (!fileBuffer.byteLength) {
    return json({ error: 'Empty upload body.' }, { status: 400 });
  }
  if (fileBuffer.byteLength > maxUploadBytes) {
    return json({ error: 'Camera upload is too large.' }, { status: 413 });
  }

  const cameraId = (url.searchParams.get('camera_id') ?? 'camera').trim() || 'camera';
  const cameraName = (url.searchParams.get('camera_name') ?? '').trim() || null;
  const eventType = (url.searchParams.get('event_type') ?? kind).trim() || kind;
  const logEvent = url.searchParams.get('log_event') === '1';
  const filename = (url.searchParams.get('filename') ?? '').trim();
  const explicitTimestamp = Number(url.searchParams.get('ts') ?? url.searchParams.get('timestamp') ?? NaN);
  const explicitExt = filename.includes('.') ? filename.split('.').pop() ?? '' : '';
  const ext = explicitExt || extensionFromContentType(contentType, kind === 'clip' ? 'mp4' : 'jpg');
  const timestamp = Math.floor(Date.now() / 1000);
  const safeCameraId = cameraId.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  const businessId = device.businessId;
  if (db) {
    const guardSuffix = Number.isFinite(explicitTimestamp)
      ? `${Math.floor(explicitTimestamp)}`
      : `${Math.floor(timestamp / 15)}`;
    const allowed = await allowIoTIngest(db, `camera-upload:${businessId}:${safeCameraId}:${kind}:${guardSuffix}`, 15);

    if (!allowed) {
      return json(
        {
          success: true,
          skipped: true,
          message: 'Duplicate camera upload ignored.'
        },
        { status: 202 }
      );
    }
  }
  const key = `businesses/${businessId}/camera/${safeCameraId}/${kind}/${timestamp}-${crypto.randomUUID()}.${ext}`;

  await bucket.put(key, fileBuffer, {
    httpMetadata: {
      contentType
    }
  });

  const mediaUrl = `${url.origin}/api/camera/media/${key}`;

  if (logEvent && db) {
    await ensureCameraSchema(db);
    await ensureTenantSchema(db, true);
    await cleanupExpiredCameraMedia(db, bucket);

    await db
      .prepare(
        `
        INSERT INTO camera_events (
          id,
          camera_id,
          camera_name,
          event_type,
          payload_json,
          image_url,
          clip_url,
          clip_duration_seconds,
          created_at,
          business_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        crypto.randomUUID(),
        cameraId,
        cameraName,
        eventType,
        JSON.stringify({
          source: 'camera_upload',
          kind,
          filename,
          content_type: contentType
        }),
        kind === 'still' ? mediaUrl : null,
        kind === 'clip' ? mediaUrl : null,
        kind === 'clip' ? 60 : null,
        timestamp,
        businessId
      )
      .run();
  }

  return json({
    success: true,
    key,
    media_url: mediaUrl
  });
}
