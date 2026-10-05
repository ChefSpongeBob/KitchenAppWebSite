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

expect('migrations/0055_billing_trial_tenant_lifecycle.sql', 'lifecycle migration creates trial claims and snapshots', (source) =>
  source.includes('trial_identity_claims') &&
  source.includes('business_lifecycle_snapshots') &&
  source.includes("status = 'trialing'") &&
  source.includes("status = 'past_due'")
);

expect('src/lib/server/trial.ts', 'trial identities are claimed when trials are granted', (source) =>
  source.includes('recordTrialIdentityClaims') &&
  source.includes("source: 'trial_granted'") &&
  source.includes('collectTrialIdentityClaims')
);

expect('src/lib/server/trial.ts', 'duplicate trial claims block reuse', (source) =>
  source.includes('FROM trial_identity_claims') &&
  source.includes("reason: 'email_reuse'") &&
  source.includes("reason: 'device_reuse'") &&
  source.includes("reason: 'business_ip_reuse'") &&
  source.includes("trial_identity_claims.status IN ('active', 'used')")
);

expect('src/lib/server/trial.ts', 'cancellation snapshots before purge', (source) =>
  source.includes('createBusinessLifecycleSnapshot') &&
  source.includes('pre_purge') &&
  source.includes('purgeBusinessWorkspaceData')
);

expect('src/lib/server/trial.ts', 'paid conversion keeps tenant data and activates business', (source) =>
  source.includes("SET plan_tier = ?") &&
  source.includes("status = 'active'") &&
  source.includes("SET status = 'active'") &&
  source.includes('export async function convertBusinessToPaid')
);

expect('src/lib/server/business.ts', 'workspace lookup accepts lifecycle states that billing guard handles', (source) =>
  source.includes("IN ('active', 'trialing', 'past_due', 'pending_payment')")
);

expect('src/routes/register/+page.server.ts', 'public trial signup is disabled before account creation', (source) =>
  source.includes("const purchaseModeRaw = String(formData.get('purchase_mode') || 'buy_now')") &&
  source.includes('Trial signup is not available right now') &&
  source.includes("const initialBusinessStatus = 'pending_payment'") &&
  source.includes("statusOverride: 'pending_payment'") &&
  !source.includes('createTrialDenialRecord') &&
  !source.includes('Free trial unavailable')
);

expect('src/routes/api/internal/schema-readiness/+server.ts', 'schema readiness includes lifecycle tables', (source) =>
  source.includes('trial_identity_claims') && source.includes('business_lifecycle_snapshots')
);

expect('migrations/0059_store_entitlements.sql', 'store entitlement migration creates native billing tables', (source) =>
  source.includes('store_products') &&
  source.includes('business_store_entitlements') &&
  source.includes('store_purchase_events') &&
  source.includes('store_webhook_events')
);

expect('src/routes/api/billing/native-purchase/+server.ts', 'native purchases stay pending until store verification', (source) =>
  source.includes("pending_store_configuration") &&
  source.includes("pending_verification") &&
  !source.includes('convertBusinessToPaid(')
);

expect('src/lib/server/storeBilling.ts', 'verified entitlements are the paid activation path', (source) =>
  source.includes('activateVerifiedStoreEntitlement') &&
  source.includes('applyVerifiedEntitlementsToBusiness') &&
  source.includes("status = 'active'")
);

expect('src/lib/server/storeBilling.ts', 'billing lifecycle can update and reconcile entitlements', (source) =>
  source.includes('findStoreEntitlementForLifecycle') &&
  source.includes('updateStoreEntitlementLifecycle') &&
  source.includes('refreshBusinessBillingState') &&
  source.includes("status = 'past_due'")
);

expect('src/lib/server/storeVerification.ts', 'store verification calls Apple and Google APIs', (source) =>
  source.includes('api.storekit.itunes.apple.com') &&
  source.includes('androidpublisher.googleapis.com') &&
  source.includes('purchases/subscriptionsv2/tokens')
);

expect('src/routes/api/billing/app-store-notifications/+server.ts', 'app store notification endpoint stores events', (source) =>
  source.includes('store_webhook_events') && source.includes("'app_store'")
);

expect('src/routes/api/billing/app-store-notifications/+server.ts', 'app store notification endpoint processes entitlement lifecycle', (source) =>
  source.includes('mapAppleStatus') &&
  source.includes('verifyStorePurchase') &&
  source.includes('updateStoreEntitlementLifecycle') &&
  source.includes('refreshBusinessBillingState') &&
  source.includes("processed_status = ?")
);

expect('src/routes/api/billing/google-play-notifications/+server.ts', 'google play notification endpoint stores events', (source) =>
  source.includes('store_webhook_events') && source.includes("'google_play'")
);

expect('src/routes/api/billing/google-play-notifications/+server.ts', 'google play notification endpoint processes entitlement lifecycle', (source) =>
  source.includes('fallbackGoogleStatus') &&
  source.includes('verifyStorePurchase') &&
  source.includes('updateStoreEntitlementLifecycle') &&
  source.includes('refreshBusinessBillingState')
);

expect('migrations/0081_billing_webhook_lifecycle_indexes.sql', 'billing webhook lifecycle migration adds lookup indexes', (source) =>
  source.includes('idx_business_store_entitlements_original_transaction') &&
  source.includes('idx_business_store_entitlements_latest_transaction') &&
  source.includes('idx_store_webhook_events_processed_created')
);

expect('migrations/0101_billing_prices_and_sensor_addon.sql', 'launch store prices are the current approved tiers', (source) =>
  source.includes("WHEN 'crimini.plan.small.monthly' THEN 2900") &&
  source.includes("WHEN 'crimini.plan.medium.monthly' THEN 4900") &&
  source.includes("WHEN 'crimini.plan.large.monthly' THEN 6900")
);

expect('migrations/0101_billing_prices_and_sensor_addon.sql', 'temperature monitoring is an active standalone add-on', (source) =>
  source.includes("WHERE product_id = 'crimini.addon.temps.monthly'") &&
  source.includes('price_cents = 1700') &&
  source.includes('addon_temp_monitoring = 1') &&
  source.includes('active = 1')
);

expect('migrations/0101_billing_prices_and_sensor_addon.sql', 'temperature monitoring is separated from plan entitlements', (source) =>
  source.includes('SET addon_temp_monitoring = 0') &&
  source.includes("'crimini.plan.small.monthly'") &&
  source.includes("'crimini.plan.medium.monthly'") &&
  source.includes("'crimini.plan.large.monthly'")
);

expect('src/routes/register/+page.server.ts', 'registration leaves the optional sensor add-on disabled until purchased', (source) =>
  source.includes('const addOnTempMonitoring = false') &&
  !source.includes('tempMonitoringIncludedForPlan')
);

expect('src/routes/billing/+page.server.ts', 'local billing conversion accepts the explicit sensor add-on selection', (source) =>
  source.includes("form.get('addon_temp_monitoring')") &&
  !source.includes('tempMonitoringIncludedForPlan')
);

expect('src/routes/api/billing/products/+server.ts', 'billing products API exposes active standalone add-ons', (source) =>
  source.includes('products.map((product)') &&
  !source.includes('product.addon_temp_monitoring === 1 && !product.plan_tier')
);

expect('src/routes/api/billing/native-purchase/+server.ts', 'native purchase accepts the standalone temperature product', (source) =>
  !source.includes('product.addon_temp_monitoring === 1 && !product.plan_tier')
);

expect('src/lib/server/storeBilling.ts', 'verified standalone entitlement controls temperature monitoring', (source) =>
  source.includes('entitlement.addon_temp_monitoring === 1 && !entitlement.plan_tier') &&
  !source.includes("activePlan.plan_tier === 'growth' || activePlan.plan_tier === 'enterprise'")
);

expect('src/routes/api/billing/app-store-notifications/+server.ts', 'app store webhook requires exact configured token', (source) =>
  source.includes('if (!token) return false') &&
  source.includes('bearerTokenFromRequest') &&
  source.includes("url.searchParams.get('token')") &&
  source.includes('constantTimeTokenEqual')
);

expect('src/routes/api/billing/google-play-notifications/+server.ts', 'google play webhook requires exact configured token', (source) =>
  source.includes('if (!token) return false') &&
  source.includes('bearerTokenFromRequest') &&
  source.includes("url.searchParams.get('token')") &&
  source.includes('constantTimeTokenEqual')
);

expect('src/lib/billing/nativeBilling.ts', 'web app has native billing bridge', (source) =>
  source.includes("registerPlugin<CriminiBillingPlugin>('CriminiBilling')") &&
  source.includes('nativeStoreForPlatform')
);

expect('docs/PROJECT_HANDOFF.md', 'lifecycle documentation exists', (source) =>
  source.includes('Trial identity claims') && source.includes('pre-purge snapshot')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
