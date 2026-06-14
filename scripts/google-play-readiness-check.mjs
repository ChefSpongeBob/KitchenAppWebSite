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

expect('capacitor.config.json', 'Capacitor Android shell uses final production app identity', (source) =>
  source.includes('"appId": "com.nexusnorthsystems.crimini"') &&
  source.includes('"appName": "Crimini"') &&
  source.includes('"url": "https://criminiops.com"') &&
  source.includes('"cleartext": false') &&
  source.includes('"webContentsDebuggingEnabled": false') &&
  source.includes('"allowMixedContent": false')
);

expect('android/app/build.gradle', 'Android package namespace versioning and Play Billing are configured', (source) =>
  source.includes('namespace = "com.nexusnorthsystems.crimini"') &&
  source.includes('applicationId "com.nexusnorthsystems.crimini"') &&
  /versionCode\s+\d+/.test(source) &&
  /versionName\s+"[^"]+"/.test(source) &&
  source.includes('com.android.billingclient:billing')
);

expect('android/variables.gradle', 'Android SDK targets are Play-ready', (source) =>
  /minSdkVersion\s*=\s*24/.test(source) &&
  /compileSdkVersion\s*=\s*(3[5-9]|[4-9]\d)/.test(source) &&
  /targetSdkVersion\s*=\s*(3[5-9]|[4-9]\d)/.test(source)
);

expect('android/app/src/main/AndroidManifest.xml', 'Android release manifest disables risky debug-era behavior', (source) =>
  source.includes('android:usesCleartextTraffic="false"') &&
  source.includes('android:allowBackup="false"') &&
  source.includes('android:fullBackupContent="false"') &&
  source.includes('android.permission.INTERNET') &&
  !source.includes('android.permission.CAMERA') &&
  !source.includes('android.permission.READ_EXTERNAL_STORAGE') &&
  !source.includes('android.permission.WRITE_EXTERNAL_STORAGE')
);

expect('android/app/src/main/res/values/strings.xml', 'Android app labels are final Crimini labels', (source) =>
  source.includes('<string name="app_name">Crimini</string>') &&
  source.includes('<string name="title_activity_main">Crimini</string>') &&
  source.includes('<string name="package_name">com.nexusnorthsystems.crimini</string>')
);

expectExists('src/routes/privacy/+page.svelte', 'privacy policy URL route exists');
expectExists('src/routes/support/+page.svelte', 'support URL route exists');
expectExists('src/routes/account-deletion/+page.svelte', 'account deletion URL route exists');

expect('src/routes/+layout.svelte', 'public footer links Play review URLs', (source) =>
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

expect('src/lib/server/storeVerification.ts', 'Google Play purchase verification is wired server-side', (source) =>
  source.includes('GOOGLE_PLAY_PACKAGE_NAME') &&
  source.includes('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON') &&
  source.includes('androidpublisher.googleapis.com/androidpublisher/v3/applications') &&
  source.includes('purchases/subscriptionsv2/tokens') &&
  source.includes(':acknowledge')
);

expect('src/routes/api/billing/google-play-notifications/+server.ts', 'Google Play billing notifications are token-gated and processed', (source) =>
  source.includes('BILLING_WEBHOOK_TOKEN') &&
  source.includes('constantTimeTokenEqual') &&
  source.includes('subscriptionNotification') &&
  source.includes('purchaseToken') &&
  source.includes('verifyStorePurchase') &&
  source.includes('updateStoreEntitlementLifecycle') &&
  source.includes('refreshBusinessBillingState')
);

expect('docs/PROJECT_HANDOFF.md', 'Google Play phase tracks Play Console manual requirements', (source) =>
  source.includes('21. Google Play Store readiness') &&
  source.includes('Google Play Console') &&
  source.includes('data safety') &&
  source.includes('internal testing') &&
  source.includes('crimini.plan.small.monthly') &&
  source.includes('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) {
  console.error(`\nGoogle Play readiness check failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log('\nGoogle Play readiness check passed.');
