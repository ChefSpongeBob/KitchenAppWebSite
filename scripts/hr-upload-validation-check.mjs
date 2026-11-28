import assert from 'node:assert/strict';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadServerModules } from './helpers/test-d1.mjs';
import { pdfFile, pdfFixture } from './helpers/test-files.mjs';

const { validateHrDocumentUpload: validate } = loadServerModules()('src/lib/server/hrUploadValidation.ts');
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs')).href;
const canvas = createCanvas(2, 2);
const images = [
  ['png', 'image/png', canvas.toBuffer('image/png')],
  ['jpg', 'image/jpeg', canvas.toBuffer('image/jpeg')],
  ['webp', 'image/webp', canvas.toBuffer('image/webp')],
  ['gif', 'image/gif', Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), character => character.charCodeAt(0))]
];
for (const [extension, type, bytes] of images) {
  const file = new File([bytes], 'image.' + extension, { type });
  assert.equal(await validate(file), null, 'Valid ' + extension);
  assert.notEqual(await validate(file, true), null, 'Official forms must remain PDF-only');
  assert.notEqual(await validate(new File([bytes.subarray(0, bytes.length - 2)], file.name, { type })), null, 'Truncated ' + extension);
  assert.notEqual(await validate(new File([bytes], 'image.pdf', { type })), null, 'Extension mismatch ' + extension);
}
console.log('PASS real PNG/JPEG/WebP/GIF uploads, PDF-only rules, mismatches and truncated containers');

const original = pdfFixture();
const oldXref = Number(/startxref\n(\d+)/.exec(original)[1]);
const nextObjectOffset = original.length;
let incremental = original + '5 0 obj\n<< /Producer (Isolated incremental fixture) >>\nendobj\n';
const nextXref = incremental.length;
incremental += `xref\n5 1\n${String(nextObjectOffset).padStart(10, '0')} 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R /Prev ${oldXref} >>\nstartxref\n${nextXref}\n%%EOF\n`;
const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>', '<< /Length 0 >>\nstream\n\nendstream'];
let streamPdf = '%PDF-1.7\n'; const offsets = [0];
for (const [index, object] of objects.entries()) { offsets.push(streamPdf.length); streamPdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
const streamOffset = streamPdf.length; offsets.push(streamOffset);
const entries = new Uint8Array(offsets.length * 7), view = new DataView(entries.buffer);
for (let index = 0; index < offsets.length; index++) { entries[index * 7] = index ? 1 : 0; view.setUint32(index * 7 + 1, offsets[index]); view.setUint16(index * 7 + 5, index ? 0 : 65535); }
streamPdf += `5 0 obj\n<< /Type /XRef /Size 6 /Root 1 0 R /W [1 4 2] /Length ${entries.length} >>\nstream\n`;
const streamFixture = new File([streamPdf, entries, `\nendstream\nendobj\nstartxref\n${streamOffset}\n%%EOF\n`], 'stream.pdf', { type: 'application/pdf' });
for (const file of [pdfFile('ordinary.pdf'), new File([incremental], 'incremental.pdf', { type: 'application/pdf' }), streamFixture,
  new File([original], 'mobile-upload', { type: 'application/pdf' }), new File([original], 'blank-mime.PDF'),
  new File([original], 'generic.pdf', { type: 'application/octet-stream' })]) {
  const before = new Uint8Array(await file.arrayBuffer());
  assert.equal(await validate(file, true), null, file.name);
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), before, 'Never rewrite PDF bytes');
  const task = pdfjs.getDocument({ data: before, isEvalSupported: false });
  try { assert.equal((await task.promise).numPages, 1, 'Fixture must be a real parseable PDF'); } finally { await task.destroy(); }
}
console.log('PASS real parseable ordinary/incremental/xref-stream PDFs, browser MIME variations and unchanged document bytes');

for (const [name, type, bytes] of [
  ['fake.pdf','application/pdf','plain text'], ['fake.pdf','application/pdf','<html>not a PDF</html>'],
  ['fake.pdf','application/pdf','%PDF-1.7\nincomplete'], ['fake.pdf','application/pdf',original.replace(/startxref\n\d+/, 'startxref\n999999999')],
  ['fake.pdf','application/pdf',original.replace('xref\n0 5', 'nope\n0 5')], ['fake.pdf','application/pdf',original+'<script>not PDF</script>'],
  ['fake.html','application/pdf',original], ['fake.pdf','text/html',original], ['fake.constructor','application/pdf',original],
  ['fake.png','image/png','not an image'], ['fake.jpg','image/jpeg','not an image'], ['fake.webp','image/webp','not an image'], ['fake.gif','image/gif','not an image']
]) assert.notEqual(await validate(new File([bytes], name, { type })), null, name + '/' + type);
const bounded = pdfFile('bounded.pdf'); let sampled = 0;
const slice = bounded.slice.bind(bounded);
bounded.arrayBuffer = () => { throw Error('Never buffer the full upload'); };
bounded.slice = (...args) => { const part = slice(...args); sampled += part.size; return part; };
assert.equal(await validate(bounded, true), null); assert.ok(sampled <= 3 * 4096);
const tooLarge = pdfFile('oversized.pdf'); Object.defineProperty(tooLarge, 'size', { value: 15 * 1024 * 1024 + 1 });
tooLarge.slice = () => { throw Error('Oversized uploads must be rejected before reading'); };
assert.notEqual(await validate(tooLarge), null);
const unreadable = pdfFile('unreadable.pdf'); unreadable.slice = () => { throw Error('PRIVATE-READ-FAILURE'); };
assert.equal((await validate(unreadable)).includes('PRIVATE'), false);
console.log('PASS forged MIME/content/xref, trailing non-PDF content, bounded reads, over-limit and unreadable uploads fail safely');
