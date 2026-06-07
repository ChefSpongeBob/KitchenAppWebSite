import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const checks = [];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function expect(path, label, predicate) {
  if (!existsSync(resolve(root, path))) {
    checks.push({ ok: false, label, detail: `${path} does not exist.` });
    return;
  }
  const source = read(path);
  checks.push({ ok: Boolean(predicate(source)), label, detail: path });
}

function excludesAll(source, tokens) {
  return tokens.every((token) => !source.includes(token));
}

expect('src/routes/+layout.svelte', 'main admin sidebar hides camera pages', (source) =>
  excludesAll(source, ['/admin/camera', 'Camera Media', 'Camera Setup'])
);

expect('src/lib/components/ui/AdminEditorMenu.svelte', 'admin editor dropdown hides camera pages', (source) =>
  excludesAll(source, ['/admin/camera', 'Camera Media', 'Camera Setup'])
);

expect('src/routes/admin/camera/+page.server.ts', 'camera media admin page remains beta-gated', (source) =>
  source.includes('cameraBetaEnabled') && source.includes("throw error(404, 'Not found.')")
);

expect('src/routes/admin/camera/setup/+page.server.ts', 'camera setup admin page remains beta-gated', (source) =>
  source.includes('cameraBetaEnabled') && source.includes("throw error(404, 'Not found.')")
);

expect('src/routes/register/+page.svelte', 'signup hides camera add-on and submits it off', (source) =>
  excludesAll(source, ['Camera Security Monitoring', 'Security camera monitoring']) &&
  source.includes('name="addon_camera_monitoring" value="0"')
);

expect('src/routes/register/+page.server.ts', 'signup server ignores camera add-on submissions', (source) =>
  source.includes('const addOnCameraMonitoring = false;')
);

expect('src/routes/billing/+page.svelte', 'billing hides camera products and submits camera off', (source) =>
  source.includes('!product.addOnCameraMonitoring') &&
  source.includes('name="addon_camera_monitoring" value="0"')
);

expect('src/routes/billing/+page.server.ts', 'billing server ignores camera add-on submissions', (source) =>
  source.includes('const addOnCameraMonitoring = false;')
);

expect('src/routes/api/billing/products/+server.ts', 'billing products API filters camera add-ons', (source) =>
  source.includes('product.addon_camera_monitoring !== 1')
);

expect('src/routes/api/billing/native-purchase/+server.ts', 'native purchase rejects camera add-ons', (source) =>
  source.includes('product.addon_camera_monitoring === 1') &&
  source.includes('Camera monitoring is not available yet.')
);

expect('src/lib/server/storeBilling.ts', 'entitlement reconciliation keeps camera disabled for launch', (source) =>
  source.includes('const addOnCameraMonitoring = false;')
);

expect('src/routes/pricing/+page.svelte', 'pricing frames camera monitoring as planned', (source) =>
  source.includes('Camera monitoring planned after launch') &&
  excludesAll(source, ['Camera monitoring included', 'Camera monitoring add-on available'])
);

expect('docs/PROJECT_HANDOFF.md', 'handoff tracks camera shelving phase', (source) =>
  source.includes('13. Camera feature shelving') &&
  source.includes('Camera monitoring products are deferred post-launch')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) {
  console.error(`\nCamera shelving check failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log('\nCamera shelving check passed.');
