import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
  const bucket = platform?.env?.DOC_MEDIA ?? platform?.env?.CAMERA_MEDIA;
  if (!bucket) {
    return new Response('Document media bucket not configured.', { status: 503 });
  }

  const key = params.key
    .split('/')
    .map((part) => decodeURIComponent(part))
    .join('/');

  if (!key) {
    return new Response('Missing media key.', { status: 400 });
  }

  const object = await bucket.get(key);
  if (!object) {
    return new Response('Not found.', { status: 404 });
  }

  const headers = new Headers();
  if (object.httpMetadata?.contentType) {
    headers.set('content-type', object.httpMetadata.contentType);
  } else {
    headers.set('content-type', 'application/octet-stream');
  }
  headers.set(
    'cache-control',
    object.httpMetadata?.cacheControl ?? 'public, max-age=86400, stale-while-revalidate=604800'
  );
  headers.set('etag', object.httpEtag);

  const body = await object.arrayBuffer();
  return new Response(body, { headers });
};
