const MAX_HR_FILE_BYTES = 15 * 1024 * 1024;
const CONTENT_SAMPLE_BYTES = 4096;
const fileTypes = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif'
} as const;
const allowedTypes = new Set<string>(Object.values(fileTypes));

function matches(bytes: Uint8Array, expected: number[], offset = 0) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function text(bytes: Uint8Array) {
  return new TextDecoder('latin1').decode(bytes);
}

async function hasPdfStructure(file: File, head: Uint8Array, tail: Uint8Array) {
  if (!/^%PDF-(?:1\.[0-7]|2\.0)(?:\r\n?|\n)/.test(text(head))) return false;
  const end = /startxref[\t\n\f\r ]+(\d+)[\t\n\f\r ]+%%EOF[\x00\t\n\f\r ]*$/.exec(text(tail));
  if (!end) return false;
  const offset = Number(end[1]);
  if (!Number.isSafeInteger(offset) || offset < 8 || offset >= file.size) return false;
  const xref = text(new Uint8Array(await file.slice(offset, offset + CONTENT_SAMPLE_BYTES).arrayBuffer()));
  // Support both ordinary xref tables and PDF 1.5+ compressed xref streams.
  return /^xref[\t\n\f\r ]/.test(xref) ||
    (/^\d+[\t\n\f\r ]+\d+[\t\n\f\r ]+obj\b/.test(xref) && /\/Type[\t\n\f\r ]*\/XRef\b/.test(xref));
}

export async function validateHrDocumentUpload(file: File, pdfOnly = false): Promise<string | null> {
  const message = pdfOnly ? 'Upload a complete PDF file.' : 'Upload a complete PDF, JPG, PNG, WebP, or GIF file.';
  if (!file.size || file.size > MAX_HR_FILE_BYTES) return 'Document uploads must be 15MB or smaller.';
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase() : '';
  const extensionType = Object.hasOwn(fileTypes, extension) ? fileTypes[extension as keyof typeof fileTypes] : '';
  const declaredType = file.type.toLowerCase();
  if ((extension && !extensionType) ||
    (declaredType && declaredType !== 'application/octet-stream' && !allowedTypes.has(declaredType)) ||
    (extensionType && declaredType && declaredType !== 'application/octet-stream' && extensionType !== declaredType)) return message;
  const expectedType = extensionType || declaredType;
  if (pdfOnly && expectedType !== 'application/pdf') return message;
  try {
    // Inspect bounded container metadata; never parse/render or rewrite employee documents here.
    const head = new Uint8Array(await file.slice(0, CONTENT_SAMPLE_BYTES).arrayBuffer());
    const tail = new Uint8Array(await file.slice(Math.max(0, file.size - CONTENT_SAMPLE_BYTES)).arrayBuffer());
    let valid = false;
    if (expectedType === 'application/pdf') valid = await hasPdfStructure(file, head, tail);
    if (expectedType === 'image/png' && file.size >= 45) {
      const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
      valid = matches(head, [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]) &&
        view.getUint32(16) > 0 && view.getUint32(20) > 0 &&
        matches(tail, [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130], tail.length - 12);
    }
    if (expectedType === 'image/jpeg') valid = file.size >= 4 && matches(head, [255, 216, 255]) && matches(tail, [255, 217], tail.length - 2);
    if (expectedType === 'image/gif' && file.size >= 14) {
      const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
      valid = /^GIF8[79]a/.test(text(head)) && view.getUint16(6, true) > 0 && view.getUint16(8, true) > 0 && tail[tail.length - 1] === 59;
    }
    if (expectedType === 'image/webp' && file.size >= 20) {
      const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
      valid = text(head.subarray(0, 4)) === 'RIFF' && text(head.subarray(8, 12)) === 'WEBP' &&
        ['VP8 ', 'VP8L', 'VP8X'].includes(text(head.subarray(12, 16))) && view.getUint32(4, true) + 8 === file.size;
    }
    return valid ? null : message;
  } catch {
    return message;
  }
}
