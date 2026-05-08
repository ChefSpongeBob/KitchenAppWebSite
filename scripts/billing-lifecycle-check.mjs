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

expect('docs/billing-trial-tenant-lifecycle.md', 'lifecycle documentation exists', (source) =>
  source.includes('Trial identity claims') && source.includes('pre-purge snapshot')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
