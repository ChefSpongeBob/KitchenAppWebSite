import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludes(file, needle, message) {
  const source = read(file);
  if (!source.includes(needle)) {
    throw new Error(`${message}\nMissing in ${file}: ${needle}`);
  }
  console.log(`PASS: ${message}`);
}

function assertNotIncludes(file, needle, message) {
  const source = read(file);
  if (source.includes(needle)) {
    throw new Error(`${message}\nForbidden in ${file}: ${needle}`);
  }
  console.log(`PASS: ${message}`);
}

assertIncludes(
  'src/hooks.server.ts',
  'event.locals.MEDIA_BUCKET = event.platform?.env?.DOC_MEDIA;',
  'document media uses the document bucket only'
);

assertNotIncludes(
  'src/routes/api/documents/media/[...key]/+server.ts',
  'CAMERA_MEDIA',
  'document media route does not fall back to camera storage'
);

assertIncludes(
  'src/routes/api/documents/media/[...key]/+server.ts',
  "headers.set('cache-control', 'private, no-store')",
  'document media is private and not publicly cacheable'
);

assertIncludes(
  'src/routes/api/documents/media/[...key]/+server.ts',
  'sidebar_logo_url',
  'business branding media is authorized through the active business'
);

assertIncludes(
  'src/routes/api/documents/media/[...key]/+server.ts',
  'canAccessEmployeeSensitiveData',
  'employee onboarding media requires employee, owner, admin, or HR-sensitive access'
);

assertIncludes(
  'src/routes/api/documents/media/[...key]/+server.ts',
  'employee_onboarding_media_read',
  'employee onboarding media admin reads are audited'
);

assertIncludes(
  'src/lib/server/admin.ts',
  'businesses/${businessId}/documents/',
  'document uploads are stored under business-scoped paths'
);

assertIncludes(
  'src/lib/server/admin.ts',
  'businesses/${businessId}/employee-onboarding/',
  'employee onboarding uploads are stored under business-scoped paths'
);

assertIncludes(
  'src/routes/api/camera/media/[...key]/+server.ts',
  "'cache-control': 'private, no-store'",
  'camera media remains private and not publicly cacheable'
);

console.log('\nMedia access check passed.');
