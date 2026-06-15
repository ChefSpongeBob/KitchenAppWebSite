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

expect('src/routes/support/+page.svelte', 'support page has a launch support contact and legal links', (source) =>
  source.includes('support@criminiops.com') &&
  source.includes('href="/privacy"') &&
  source.includes('href="/terms"') &&
  source.includes('href="/billing-terms"') &&
  source.includes('href="/account-deletion"')
);

expect('src/routes/privacy/+page.svelte', 'privacy policy covers core app data and contact', (source) =>
  source.includes('account, workspace, employee profile, scheduling, checklist, document') &&
  source.includes('device/session identifiers') &&
  source.includes('tenant-scoped database access') &&
  source.includes('account deletion page') &&
  source.includes('support@criminiops.com')
);

expect('src/routes/account-deletion/+page.svelte', 'account deletion page explains request scope retention and contact', (source) =>
  source.includes('User account') &&
  source.includes('Full workspace') &&
  source.includes('What Gets Deleted') &&
  source.includes('What May Be Retained') &&
  source.includes('support@criminiops.com')
);

expect('src/routes/account-deletion/+page.server.ts', 'account deletion requests are persisted and rate limited', (source) =>
  source.includes('account_deletion_requests') &&
  source.includes('checkRateLimit') &&
  source.includes('hashedAuditValue') &&
  source.includes('account_deletion_request')
);

expect('src/routes/terms/+page.svelte', 'terms page sets business responsibility and acceptable use guardrails', (source) =>
  source.includes('Crimini does not replace legal, payroll, tax, food safety, or HR advice') &&
  source.includes('state-specific forms') &&
  source.includes('Acceptable Use') &&
  source.includes('access another business workspace') &&
  source.includes('Monitoring Tools')
);

expect('src/routes/billing-terms/+page.svelte', 'billing terms describe subscription renewal cancellation refunds and plan scope', (source) =>
  source.includes('monthly subscription plans') &&
  source.includes('Subscriptions renew monthly') &&
  source.includes('until canceled') &&
  source.includes('Refund requests for store purchases') &&
  source.includes('Temperature monitoring') &&
  source.includes('Medium and Large') &&
  source.includes('Camera monitoring is deferred')
);

expect('src/routes/billing/+page.svelte', 'billing page links legal subscription disclosures', (source) =>
  source.includes('href="/privacy"') &&
  source.includes('href="/terms"') &&
  source.includes('href="/billing-terms"') &&
  source.includes('href="/support"') &&
  source.includes('href="/account-deletion"')
);

expect('docs/PROJECT_HANDOFF.md', 'phase 22 tracks remaining legal and business readiness work', (source) =>
  source.includes('22. Legal, public site, and business readiness') &&
  source.includes('privacy policy') &&
  source.includes('billing terms') &&
  source.includes('support contact') &&
  source.includes('qualified legal or payroll guidance')
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
