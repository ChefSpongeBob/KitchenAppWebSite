import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [];

function read(filePath) {
  const absolute = path.join(root, filePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
}

function expect(filePath, label, predicate) {
  const source = read(filePath);
  checks.push({
    ok: Boolean(source && predicate(source)),
    label,
    detail: filePath
  });
}

expect('capacitor.config.json', 'Capacitor app id is final Crimini id', (source) =>
  source.includes('"appId": "com.nexusnorthsystems.crimini"')
);

expect('android/app/build.gradle', 'Android package id is final Crimini id', (source) =>
  source.includes('applicationId "com.nexusnorthsystems.crimini"') &&
  source.includes('com.android.billingclient:billing')
);

expect('ios/App/App.xcodeproj/project.pbxproj', 'iOS bundle id is final Crimini id', (source) =>
  source.includes('PRODUCT_BUNDLE_IDENTIFIER = com.nexusnorthsystems.crimini;')
);

expect('src/routes/api/billing/status/+server.ts', 'Billing status endpoint exists', (source) =>
  source.includes('readBusinessEntitlements') && source.includes('manage')
);

expect('src/routes/billing/+page.svelte', 'Billing page supports native purchase and restore', (source) =>
  source.includes('CriminiBilling.purchase') &&
  source.includes('CriminiBilling.restorePurchases') &&
  source.includes('Manage subscription')
);

expect('docs/store-billing-setup.md', 'Store billing setup doc exists', (source) =>
  source.includes('crimini.plan.small.monthly') &&
  source.includes('APP_STORE_PRIVATE_KEY') &&
  source.includes('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')
);

expect('STORE_RELEASE_READINESS.md', 'Store readiness tracker references billing setup', (source) =>
  source.includes('Native app id / bundle id') && source.includes('Cloudflare Secrets')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exitCode = 1;
