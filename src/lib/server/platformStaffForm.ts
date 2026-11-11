import { error } from '@sveltejs/kit';

export async function readStaffForm(request: Request) {
  const maxBytes = 32 * 1024;
  const contentType = request.headers.get('content-type') ?? '';
  if (!['application/x-www-form-urlencoded', 'multipart/form-data'].includes(contentType.split(';')[0].trim().toLowerCase())) {
    error(415, 'Send a text form.');
  }
  if (Number(request.headers.get('content-length')) > maxBytes) error(413, 'This form is too large.');
  const reader = request.body?.getReader();
  if (!reader) error(400, 'The form could not be read.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        void reader.cancel().catch(() => {});
        error(413, 'This form is too large.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let form: FormData;
  try { form = await new Response(bytes, { headers: { 'content-type': contentType } }).formData(); }
  catch { error(400, 'The form could not be read.'); }
  if ([...form.values()].some(value => typeof value !== 'string')) error(400, 'This form accepts text only.');
  return form;
}
