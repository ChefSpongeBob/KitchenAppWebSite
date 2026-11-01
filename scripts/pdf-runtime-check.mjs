import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs')).href;
const stream = '0.15 0.2 0.3 rg 10 10 80 80 re f';
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>',
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
];
let pdf = '%PDF-1.4\n';
const offsets = [0];
for (const [index, object] of objects.entries()) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10,'0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const task = pdfjs.getDocument({ data: new Uint8Array(Buffer.from(pdf)) });
try {
  const document = await task.promise;
  assert.equal(document.numPages, 1);
  const page = await document.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const canvas = createCanvas(viewport.width, viewport.height);
  await page.render({ canvas, viewport }).promise;
  const context = canvas.getContext('2d');
  assert.ok(context.getImageData(50,150,1,1).data[0] < 100);
  assert.equal(context.getImageData(150,150,1,1).data[0], 255);
  const source = readFileSync('src/lib/components/ui/PdfPageStack.svelte','utf8');
  assert.equal(source.includes('PDFScriptingManager'), false);
  assert.ok(source.includes('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'));
  for (const file of ['pdf.mjs', 'pdf.worker.mjs']) {
    const runtime = readFileSync(`node_modules/pdfjs-dist/legacy/build/${file}`, 'utf8');
    assert.equal(/\beval\s*\(|new\s+Function\s*\(/.test(runtime), false, `No eval compilation in ${file}`);
  }
  console.log(`PASS PDF.js ${pdfjs.version}: real local worker loads a PDF and renders expected pixels with the production canvas API; no eval compilation or scripting manager`);
} finally { await task.destroy(); }
