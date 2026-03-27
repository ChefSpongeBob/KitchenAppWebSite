import { json } from '@sveltejs/kit';
import {
  cleanupExpiredCameraMedia,
  cameraIngestAuthorized,
  ensureCameraSchema,
  extensionFromContentType
} from '$lib/server/camera';
import { allowIoTIngest } from '$lib/server/iotIngest';

export async function POST({ request, platform, url }) {
  const bucket = platform?.env?.CAMERA_MEDIA;
  const db = platform?.env?.DB;
  if (!bucket) {
    return json({ error: 'Camera media bucket not configured.' }, { status: 503 });
  }
  if (!cameraIngestAuthorized(request, platform?.env?.IOT_API_KEY)) {
    return json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') ?? 'application/octet-stream';
  const fileBuffer = await request.arrayBuffer();
  if (!fileBuffer.byteLength) {
    return json({ error: 'Empty upload body.' }, { status: 400 });
  }

  const cameraId = (url.searchParams.get('camera_id') ?? 'camera').trim() || 'camera';
  const cameraName = (url.searchParams.get('camera_name') ?? '').trim() || null;
  const kind = (url.searchParams.get('kind') ?? 'still').trim() || 'still';
  const eventType = (url.searchParams.get('event_type') ?? kind).trim() || kind;
  const logEvent = url.searchParams.get('log_event') === '1';
  const filename = (url.searchParams.get('filename') ?? '').trim();
  const explicitTimestamp = Number(url.searchParams.get('ts') ?? url.searchParams.get('timestamp') ?? NaN);
  const explicitExt = filename.includes('.') ? filename.split('.').pop() ?? '' : '';
  const ext = explicitExt || extensionFromContentType(contentType, kind === 'clip' ? 'mp4' : 'jpg');
  const timestamp = Math.floor(Date.now() / 1000);
  const safeCameraId = cameraId.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  if (db) {
    const guardSuffix = Number.isFinite(explicitTimestamp)
      ? `${Math.floor(explicitTimestamp)}`
      : `${Math.floor(timestamp / 15)}`;
    const allowed = await allowIoTIngest(db, `camera-upload:${safeCameraId}:${kind}:${guardSuffix}`, 15);

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
  const key = `${safeCameraId}/${kind}/${timestamp}-${crypto.randomUUID()}.${ext}`;

  await bucket.put(key, fileBuffer, {
    httpMetadata: {
      contentType
    }
  });

  const mediaUrl = `${url.origin}/api/camera/media/${key}`;

  if (logEvent && db) {
    await ensureCameraSchema(db);
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
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        timestamp
      )
      .run();
  }

  return json({
    success: true,
    key,
    media_url: mediaUrl
  });
}
