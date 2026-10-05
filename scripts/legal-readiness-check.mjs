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

expectExists('src/routes/privacy/+page.svelte', 'privacy policy route exists');
expectExists('src/routes/terms/+page.svelte', 'terms route exists');
expectExists('src/routes/billing-terms/+page.svelte', 'billing terms route exists');
expectExists('src/routes/support/+page.svelte', 'support route exists');
expectExists('src/routes/account-deletion/+page.svelte', 'account deletion route exists');

expect('src/routes/+layout.svelte', 'footer exposes public legal and support links', (source) =>
  source.includes('href="/support"') &&
  source.includes('href="/privacy"') &&
  source.includes('href="/terms"') &&
  source.includes('href="/billing-terms"') &&
  source.includes('href="/account-deletion"') &&
  source.includes('Crimini by NNS, LLC')
);

expect('src/hooks.server.ts', 'public footer destinations do not require an app session', (source) =>
  source.includes("pathname === '/support'") &&
  source.includes("pathname === '/privacy'") &&
  source.includes("pathname === '/terms'") &&
  source.includes("pathname === '/billing-terms'") &&
  source.includes("pathname === '/account-deletion'")
);

expect('src/routes/+layout.svelte', 'footer access routes match paid-or-invited signup policy', (source) =>
  source.includes('<a href="/login">Sign In</a>') &&
  !source.includes('Start Free') &&
  source.includes('<a href="/support">Support</a>') &&
  !source.includes('<a href="/settings">Support</a>')
);

expect('src/routes/about/+page.svelte', 'marketing About destination contains branded page content', (source) =>
  source.includes('Crimini by NNS, LLC') &&
  source.includes('Built Around Service') &&
  source.includes('One Business, One Workspace') &&
  source.includes('href="/features"')
);

expect('src/routes/support/+page.svelte', 'support page has a launch support contact and legal links', (source) =>
  source.includes('support@criminiops.com') &&
  source.includes('https://apps.apple.com/account/subscriptions') &&
  source.includes('https://play.google.com/store/account/subscriptions') &&
  source.includes('href="/privacy"') &&
  source.includes('href="/terms"') &&
  source.includes('href="/billing-terms"') &&
  source.includes('href="/account-deletion"') &&
  !source.includes('Review Access')
);

expect('src/routes/privacy/+page.svelte', 'privacy policy covers core app data and contact', (source) =>
  source.includes('Employee and onboarding data') &&
  /payroll,\s+tax,\s+or bank information/.test(source) &&
  source.includes('Device and technical data') &&
  /temperature/i.test(source) &&
  source.includes('Cloudflare') &&
  source.includes('Resend') &&
  source.includes('We do not sell personal data') &&
  source.includes('Choices And Rights') &&
  source.includes('Communications') &&
  source.includes('children under 13') &&
  source.includes('support@criminiops.com')
);

expect('src/routes/account-deletion/+page.svelte', 'account deletion page explains request scope retention and contact', (source) =>
  source.includes('My user account') &&
  source.includes('Entire business workspace') &&
  source.includes('What Gets Deleted') &&
  source.includes('What May Be Retained') &&
  source.includes('within 30 days') &&
  source.includes('Deleting an account does not automatically cancel') &&
  source.includes('https://apps.apple.com/account/subscriptions') &&
  source.includes('https://play.google.com/store/account/subscriptions') &&
  source.includes('support@criminiops.com')
);

expect('src/routes/account-deletion/+page.server.ts', 'account deletion requests are persisted and rate limited', (source) =>
  source.includes('account_deletion_requests') &&
  source.includes('checkRateLimit') &&
  source.includes('hashedAuditValue') &&
  source.includes('account_deletion_request')
);

expect('src/routes/terms/+page.svelte', 'terms page sets business responsibility and acceptable use guardrails', (source) =>
  source.includes('Employment, Tax, And Compliance') &&
  source.includes('does not provide legal, tax, payroll, food-safety, or human-resources advice') &&
  source.includes('Acceptable Use') &&
  source.includes('access another business without authorization') &&
  source.includes('Monitoring Tools') &&
  source.includes('Limitation Of Liability') &&
  source.includes('Indemnity')
);

expect('src/routes/billing-terms/+page.svelte', 'billing terms describe subscription renewal cancellation refunds and plan scope', (source) =>
  source.includes('PLAN_PRICES') &&
  source.includes('SENSOR_PRICING') &&
  source.includes('automatically renew each month until canceled') &&
  source.includes('Apple and Google control refunds for purchases made through their stores') &&
  source.includes('Canceling a subscription does not delete workspace data') &&
  source.includes('each additional active sensor')
);

expect('src/lib/billing/pricing.ts', 'billing prices use one approved source of truth', (source) =>
  source.includes('starter: 29') &&
  source.includes('growth: 49') &&
  source.includes('enterprise: 69') &&
  source.includes('baseMonthly: 17') &&
  source.includes('includedSensors: 12') &&
  source.includes('additionalSensorMonthly: 2')
);

expect('src/lib/components/onboarding/OwnerRegistration.svelte', 'owner registration accepts the live Terms and Billing Terms', (source) =>
  source.includes('href="/terms"') &&
  source.includes('href="/billing-terms"') &&
  !source.includes('/legal/liability-agreement')
);

expect('src/routes/billing/+page.svelte', 'billing page links legal subscription disclosures', (source) =>
  source.includes('href="/privacy"') &&
  source.includes('href="/terms"') &&
  source.includes('href="/billing-terms"') &&
  source.includes('href="/support"') &&
  source.includes('href="/account-deletion"')
);

expect('docs/PROJECT_HANDOFF.md', 'phase 22 tracks remaining legal and business readiness work', (source) =>
  source.includes('16. Legal, public site, and business readiness') &&
  /privacy/i.test(source) &&
  source.includes('billing terms') &&
  source.includes('support contact') &&
  source.includes('qualified review') &&
  source.includes('Legal/payroll review is still required')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) {
  console.error(`\nLegal readiness check failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log('\nLegal readiness check passed.');
