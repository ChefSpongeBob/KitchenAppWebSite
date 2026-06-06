import { existsSync, readFileSync } from 'node:fs';

const checks = [];

function read(path) {
  return readFileSync(path, 'utf8');
}

function expect(path, label, predicate) {
  if (!existsSync(path)) {
    checks.push({ ok: false, label, detail: `${path} does not exist.` });
    return;
  }
  const source = read(path);
  checks.push({ ok: Boolean(predicate(source)), label, detail: path });
}

expect('package.json', 'official Capacitor push plugin is installed', (source) =>
  source.includes('"@capacitor/push-notifications"')
);

expect('migrations/0077_push_notifications.sql', 'push migration stores tokens by business and user', (source) =>
  source.includes('ALTER TABLE user_preferences ADD COLUMN push_updates') &&
  source.includes('CREATE TABLE IF NOT EXISTS push_notification_devices') &&
  source.includes('business_id TEXT NOT NULL') &&
  source.includes('user_id TEXT NOT NULL') &&
  source.includes('token_hash TEXT NOT NULL') &&
  source.includes('idx_push_devices_business_user_token') &&
  source.includes('idx_push_devices_business_active_user')
);

expect('src/lib/server/pushNotifications.ts', 'server push helper hashes, registers, revokes, and loads devices', (source) =>
  source.includes('hashPushToken') &&
  source.includes('registerPushDevice') &&
  source.includes('revokePushDevice') &&
  source.includes('revokePushDevicesForUser') &&
  source.includes('loadActivePushDevicesForUser') &&
  source.includes('ON CONFLICT(business_id, user_id, token_hash)')
);

expect('src/routes/api/push/register/+server.ts', 'push registration endpoint is authenticated and tenant scoped', (source) =>
  source.includes('locals.userId') &&
  source.includes('locals.businessId') &&
  source.includes('registerPushDevice') &&
  source.includes('cache-control')
);

expect('src/routes/api/push/revoke/+server.ts', 'push revoke endpoint is authenticated and tenant scoped', (source) =>
  source.includes('locals.userId') &&
  source.includes('locals.businessId') &&
  source.includes('revokePushDevice') &&
  source.includes('cache-control')
);

expect('src/lib/client/pushNotifications.ts', 'native client requests permission and registers tokens', (source) =>
  source.includes("@capacitor/push-notifications") &&
  source.includes('PushNotifications.checkPermissions') &&
  source.includes('PushNotifications.requestPermissions') &&
  source.includes("postJson('/api/push/register'") &&
  source.includes("postJson('/api/push/revoke'")
);

expect('src/routes/settings/+page.server.ts', 'settings persists push preference', (source) =>
  source.includes('push_updates') &&
  source.includes('pushUpdates')
);

expect('src/routes/settings/+page.svelte', 'settings exposes push opt-in', (source) =>
  source.includes('Push Notifications') &&
  source.includes('name="push_updates"')
);

expect('src/routes/+layout.server.ts', 'layout sends push preference to client chrome', (source) =>
  source.includes('push_updates') &&
  source.includes('pushNotificationsEnabled')
);

expect('src/routes/+layout.svelte', 'app chrome starts native push only when opted in', (source) =>
  source.includes('startNativePushRegistration') &&
  source.includes('registerNativePushNotifications') &&
  source.includes('pushNotificationsEnabled') &&
  source.includes('isAppChromeRoute')
);

expect('src/lib/server/tenant.ts', 'tenant readiness tracks push devices', (source) =>
  source.includes("'push_notification_devices'")
);

expect('src/routes/api/internal/schema-readiness/+server.ts', 'schema readiness checks push table and indexes', (source) =>
  source.includes("'push_notification_devices'") &&
  source.includes("'idx_push_devices_business_user_token'") &&
  source.includes("'idx_push_devices_business_active_user'")
);

expect('docs/PROJECT_HANDOFF.md', 'handoff tracks native push foundation status', (source) =>
  source.includes('`4. Native push notification foundation`') &&
  source.includes('Phase 4 remaining needs') &&
  source.includes('Native push notification foundation')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
