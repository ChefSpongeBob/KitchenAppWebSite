export async function GET({ params, platform }) {
  const bucket = platform?.env?.CAMERA_MEDIA;
  if (!bucket) {
    return new Response('Camera media bucket not configured.', { status: 503 });
  }

  const key = params.key;
  if (!key) {
    return new Response('Missing media key.', { status: 400 });
  }

  const object = await bucket.get(key);
  if (!object) {
    return new Response('Not found.', { status: 404 });
  }

  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream';
  const body = await object.arrayBuffer();

  return new Response(body, {
    headers: {
      'content-type': contentType,
      etag: object.httpEtag,
      'cache-control': 'public, max-age=3600'
    }
  });
}
