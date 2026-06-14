import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const checks = [];

function read(path) {
  const fullPath = resolve(root, path);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : '';
}

function expect(path, label, predicate) {
  const source = read(path);
  checks.push({ ok: Boolean(source && predicate(source)), label, detail: path });
}

function expectExists(path, label) {
  checks.push({ ok: existsSync(resolve(root, path)), label, detail: path });
}

expect('capacitor.config.json', 'Capacitor uses final app id and production domain', (source) =>
  source.includes('"appId": "com.nexusnorthsystems.crimini"') &&
  source.includes('"appName": "Crimini"') &&
  source.includes('"url": "https://criminiops.com"') &&
  source.includes('"cleartext": false')
);

expect('ios/App/App.xcodeproj/project.pbxproj', 'iOS bundle id and versions are set', (source) =>
  source.includes('PRODUCT_BUNDLE_IDENTIFIER = com.nexusnorthsystems.crimini;') &&
  /MARKETING_VERSION\s*=\s*[^;]+;/.test(source) &&
  /CURRENT_PROJECT_VERSION\s*=\s*[^;]+;/.test(source)
);

expect('ios/App/App/Info.plist', 'iOS display name is Crimini', (source) =>
  source.includes('<key>CFBundleDisplayName</key>') &&
  source.includes('<string>Crimini</string>')
);

expectExists('src/routes/privacy/+page.svelte', 'privacy policy URL route exists');
expectExists('src/routes/support/+page.svelte', 'support URL route exists');
expectExists('src/routes/account-deletion/+page.svelte', 'account deletion URL route exists');

expect('src/routes/+layout.svelte', 'public footer links Apple review URLs', (source) =>
  source.includes('href="/support"') &&
  source.includes('href="/privacy"') &&
  source.includes('href="/account-deletion"')
);

expect('src/routes/billing/+page.svelte', 'billing page shows subscription purchase restore and management paths', (source) =>
  source.includes('CriminiBilling.purchase') &&
  source.includes('CriminiBilling.restorePurchases') &&
  source.includes('Manage subscription') &&
  source.includes('Renews monthly until canceled.') &&
  source.includes('Restore is available for existing App Store or Google Play purchases.') &&
  source.includes('href="/privacy"') &&
  source.includes('href="/support"') &&
  source.includes('href="/account-deletion"')
);

expect('docs/PROJECT_HANDOFF.md', 'Apple phase tracks App Store manual requirements', (source) =>
  source.includes('20. Apple App Store readiness') &&
  source.includes('App Store Connect') &&
  source.includes('TestFlight') &&
  source.includes('privacy disclosures')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) {
  console.error(`\nApple Store readiness check failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log('\nApple Store readiness check passed.');
