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

expect('src/routes/register/+page.server.ts', 'trial reuse is denied before account creation', (source) =>
  source.includes('createTrialDenialRecord') &&
  source.includes('Free trial unavailable') &&
  source.includes('identity: {')
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

expect('migrations/0082_update_launch_plan_prices.sql', 'launch store prices are the current approved tiers', (source) =>
  source.includes("WHEN 'crimini.plan.small.monthly' THEN 3000") &&
  source.includes("WHEN 'crimini.plan.medium.monthly' THEN 6500") &&
  source.includes("WHEN 'crimini.plan.large.monthly' THEN 9000")
);

expect('migrations/0082_update_launch_plan_prices.sql', 'camera billing products are deferred for launch', (source) =>
  source.includes("WHERE product_id = 'crimini.addon.cameras.monthly'") &&
  source.includes('SET active = 0') &&
  source.includes("WHERE product_id = 'crimini.plan.large.monthly'")
);

expect('migrations/0083_temperature_tier_entitlements.sql', 'temperature monitoring is tier-gated to medium and large', (source) =>
  source.includes("WHERE product_id = 'crimini.addon.temps.monthly'") &&
  source.includes('SET active = 0') &&
  source.includes("WHEN 'growth' THEN 1") &&
  source.includes("WHEN 'enterprise' THEN 1") &&
  source.includes('ELSE 0')
);

expect('src/routes/register/+page.server.ts', 'registration derives temperature monitoring from plan tier only', (source) =>
  source.includes('tempMonitoringIncludedForPlan(planTier)') &&
  !source.includes("formData.get('addon_temp_monitoring')")
);

expect('src/routes/billing/+page.server.ts', 'billing conversion derives temperature monitoring from plan tier only', (source) =>
  source.includes('tempMonitoringIncludedForPlan(planTier)') &&
  !source.includes("form.get('addon_temp_monitoring')")
);

expect('src/routes/api/billing/products/+server.ts', 'billing products API hides standalone temperature add-ons', (source) =>
  source.includes('product.addon_temp_monitoring === 1 && !product.plan_tier')
);

expect('src/routes/api/billing/native-purchase/+server.ts', 'native purchase rejects standalone temperature add-ons', (source) =>
  source.includes('product.addon_temp_monitoring === 1 && !product.plan_tier')
);

expect('src/lib/server/storeBilling.ts', 'verified entitlements apply temperature monitoring by active plan tier', (source) =>
  source.includes("activePlan.plan_tier === 'growth' || activePlan.plan_tier === 'enterprise'") &&
  !source.includes('active.some((entitlement) => entitlement.addon_temp_monitoring === 1)')
);

expect('src/routes/api/billing/app-store-notifications/+server.ts', 'app store webhook requires exact configured token', (source) =>
  source.includes('if (!token) return false') &&
  source.includes("request.headers.get('authorization')") &&
  source.includes("url.searchParams.get('token') === token")
);

expect('src/routes/api/billing/google-play-notifications/+server.ts', 'google play webhook requires exact configured token', (source) =>
  source.includes('if (!token) return false') &&
  source.includes("request.headers.get('authorization')") &&
  source.includes("url.searchParams.get('token') === token")
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
