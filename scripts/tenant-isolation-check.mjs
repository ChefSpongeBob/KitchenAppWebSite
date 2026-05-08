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
  'src/routes/api/camera/upload/+server.ts',
  'businesses/${businessId}/camera/',
  'camera uploads are stored under business-scoped object keys'
);

assertIncludes(
  'src/routes/api/camera/media/[...key]/+server.ts',
  'locals.businessId',
  'camera media requires active business context'
);

assertIncludes(
  'src/routes/api/camera/media/[...key]/+server.ts',
  "'cache-control': 'private, no-store'",
  'camera media is not publicly cacheable'
);

for (const file of [
  'src/routes/api/camera/activity/+server.ts',
  'src/routes/api/camera/upload/+server.ts',
  'src/routes/api/temps/+server.ts'
]) {
  assertNotIncludes(file, 'singleActiveBusinessId', `${file} does not guess tenant context`);
}

assertIncludes(
  'src/lib/server/announcements.ts',
  'WHERE business_id = ? OR id = ?',
  'announcements prefer business-scoped reads'
);

assertIncludes(
  'src/lib/server/employeeSpotlight.ts',
  'WHERE business_id = ? OR id = ?',
  'employee spotlight prefers business-scoped reads'
);

console.log('\nTenant isolation check passed.');
