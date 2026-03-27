import { json } from '@sveltejs/kit';
import {
  cameraIngestAuthorized,
  cleanupExpiredCameraMedia,
  ensureCameraSchema
} from '$lib/server/camera';
import { allowIoTIngest } from '$lib/server/iotIngest';

export async function POST({ request, platform }) {
  const db = platform?.env?.DB;
  if (!db) {
    return json({ error: 'Database not configured.' }, { status: 503 });
  }
  if (!cameraIngestAuthorized(request, platform?.env?.IOT_API_KEY)) {
    return json({ error: 'Unauthorized.' }, { status: 401 });
  }

  await ensureCameraSchema(db);
  await cleanupExpiredCameraMedia(db, platform?.env?.CAMERA_MEDIA);

  const contentType = request.headers.get('content-type') ?? '';
  let payload: Record<string, unknown> = {};

  if (contentType.includes('application/json')) {
    payload = await request.json();
  } else {
    const formData = await request.formData();
    payload = Object.fromEntries(formData.entries());
  }

  const cameraId = String(payload.camera_id ?? payload.device_id ?? '').trim() || null;
  const cameraName = String(payload.camera_name ?? payload.name ?? '').trim() || null;
  const eventType = String(payload.event_type ?? payload.type ?? 'activity').trim() || 'activity';
  const imageUrl = String(payload.image_url ?? payload.image ?? payload.thumbnail_url ?? '').trim() || null;
  const clipUrl = String(payload.clip_url ?? payload.video_url ?? payload.clip ?? '').trim() || null;
  const durationRaw = Number(payload.clip_duration_seconds ?? payload.duration_seconds ?? payload.duration ?? 60);
  const clipDurationSeconds = Number.isFinite(durationRaw) ? Math.max(0, Math.floor(durationRaw)) : 60;
  const createdAt = Number(payload.ts ?? payload.timestamp ?? Math.floor(Date.now() / 1000));
  const normalizedCreatedAt = Number.isFinite(createdAt) ? Math.floor(createdAt) : Math.floor(Date.now() / 1000);
  const guardCameraKey = cameraId ?? cameraName ?? 'camera';
  const allowed = await allowIoTIngest(
    db,
    `camera-activity:${guardCameraKey}:${eventType}:${normalizedCreatedAt}`,
    30
  );

  if (!allowed) {
    return json(
      {
        success: true,
        accepted: true,
        skipped: true,
        message: 'Duplicate camera activity ignored.'
      },
      { status: 202 }
    );
  }

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
      JSON.stringify(payload),
      imageUrl,
      clipUrl,
      clipDurationSeconds,
      normalizedCreatedAt
    )
    .run();

  return json({
    success: true,
    accepted: true,
    message: 'Camera activity received.'
  });
}
