import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import * as serverRuntime from 'svelte/internal/server';
import { createTestD1, formRequest, loadServerModules } from './helpers/test-d1.mjs';

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

// Render the actual footer fragment without mounting the unrelated app shell.
const footer = read('src/routes/+layout.svelte').match(/<nav class="footer-links"[\s\S]*?<\/nav>/)?.[0];
assert.ok(footer, 'Shared footer navigation must exist');
const compiled = compile(`<script>export let isMarketingRoute; export let data;</script>${footer}`, { generate: 'server' });
const exports = {};
new Function('require', 'exports', ts.transpileModule(compiled.js.code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText)(name => {
  assert.equal(name, 'svelte/internal/server');
  return serverRuntime;
}, exports);
function footerLinks(isMarketingRoute, user) {
  const html = render(exports.default, { props: { isMarketingRoute, data: { user } } }).body;
  return [...html.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(([, href, label]) => [href, label]);
}
assert.deepEqual(footerLinks(false, { id: 'isolated-footer-user' }), [
  ['/about', 'About App'], ['/support', 'Support'], ['/privacy', 'Privacy'], ['/terms', 'Terms'],
  ['/billing-terms', 'Billing Terms'], ['/account-deletion', 'Account Deletion']
]);
const publicLinks = [
  ['/', 'Overview'], ['/features', 'Features'], ['/how-it-works', 'How It Works'], ['/about', 'About'],
  ['/pricing', 'Pricing'], ['/support', 'Support'], ['/privacy', 'Privacy'], ['/terms', 'Terms'],
  ['/billing-terms', 'Billing Terms'], ['/account-deletion', 'Account Deletion'], ['/login', 'Sign In']
];
assert.deepEqual(footerLinks(true, null), publicLinks);
assert.deepEqual(footerLinks(true, { id: 'isolated-footer-user' }), publicLinks);
assert.deepEqual(footerLinks(false, null), [
  ['/features', 'Features'], ['/how-it-works', 'How It Works'], ['/pricing', 'Pricing']
]);
console.log('PASS rendered footer: signed-in Crimini About/support/legal links, no operational Documents shortcut, unchanged public and logged-out links');

function component(source, dependencies = {}) {
  const exports = {};
  const output = ts.transpileModule(compile(source, { generate: 'server' }).js.code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  new Function('require', 'exports', output)(name => {
    if (name === 'svelte/internal/server') return serverRuntime;
    assert.ok(Object.hasOwn(dependencies, name), 'Unexpected public-page dependency: ' + name);
    return dependencies[name];
  }, exports);
  return exports;
}

const load = loadServerModules();
const company = 'NexusNorthSystemsTech, LLC';
const dependencies = {
  '#lib/components/ui/Layout.svelte': component('<slot />'),
  '#lib/billing/pricing.ts': load('src/lib/billing/pricing.ts'),
  '$app/forms': { enhance() {} },
  '#lib/components/staff/SupportRequestForm.svelte': component(''),
  '#lib/components/staff/SupportQueue.svelte': component(''),
  '#lib/components/staff/SupportConversation.svelte': component('')
};
const publicPages = {};
for (const route of ['privacy', 'terms', 'billing-terms', 'account-deletion', 'about', 'support']) {
  publicPages[route] = component(read(`src/routes/${route}/+page.svelte`), dependencies).default;
}
const pageText = (route, props = {}) => render(publicPages[route], { props }).body
  .replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const privacyText = pageText('privacy');
assert.ok(privacyText.includes(company));
assert.match(privacyText, /SMS and push notification delivery are not currently available/);
assert.match(privacyText, /Saved preferences do not activate either service/);
assert.match(privacyText, /Crimini staff use separately permissioned tools/);
assert.doesNotMatch(privacyText, /deliver requested email, text, and push|Optional email or text notifications are sent/);
const termsText = pageText('terms');
assert.ok(termsText.includes(company));
assert.match(termsText, /not government verification of employment eligibility/);
const agreement = load('src/lib/server/legal.ts');
const agreementDate = new Date(agreement.LIABILITY_AGREEMENT_VERSION + 'T12:00:00Z')
  .toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
assert.ok(termsText.includes('Effective ' + agreementDate), 'New acceptance version must match the displayed Terms date');
const billingText = pageText('billing-terms');
assert.match(billingText, /Small at \$29 per month, Medium at \$49 per month, and Large at \$69 per month/);
assert.match(billingText, /\$17 per month for up to 12 active sensors, plus \$2 per month for each additional active sensor/);
assert.match(billingText, /Temperature hardware is not yet released for general sale/);
assert.match(billingText, /pending or unverifiable purchase does not activate paid access/);
assert.match(billingText, /Purchase and restore options depend on the enabled billing channel/);
assert.ok(billingText.includes(company));
assert.doesNotMatch(billingText, /no (?:fixed )?sensor ceiling|unlimited sensors|\$79/);
for (const route of ['privacy', 'terms', 'billing-terms', 'about']) {
  assert.doesNotMatch(pageText(route), /NNS, LLC/);
}
const deletionText = pageText('account-deletion');
assert.match(deletionText, /Submitting a request does not itself delete data/);
assert.match(deletionText, /does not delete shared accounts or records belonging to other restaurants/);
assert.match(deletionText, /within 30 days/);
assert.match(pageText('account-deletion', { form: { success: true } }), /Request received for review/);
assert.doesNotMatch(pageText('account-deletion', { form: { success: true } }), /Check your email for confirmation/);
const errorHtml = render(publicPages['account-deletion'], { props: {
  form: { error: '<script>untrusted request</script>', email: 'employee@example.invalid', workspaceName: '<Restaurant>' }
} }).body;
assert.match(errorHtml, /&lt;script>untrusted request&lt;\/script>/);
assert.doesNotMatch(errorHtml, /<script>untrusted|Request received for review/);
assert.match(pageText('support', { data: { canRequest: false } }), /support@criminiops.com/);
console.log('PASS actual public-page rendering: confirmed operator, unchanged prices, availability, Terms version, request receipt/error escaping and cross-restaurant deletion boundaries');

// A receipt is not authorization to delete or proof that an email reached an inbox.
const test = createTestD1();
const realFetch = globalThis.fetch;
const realWarn = console.warn;
try {
  globalThis.fetch = async () => { throw new Error('No external requests permitted in legal-readiness tests'); };
  console.warn = () => {};
  const now = Math.floor(Date.now() / 1000);
  for (const id of ['legal-a', 'legal-b']) {
    test.sqlite.prepare('INSERT INTO businesses(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)')
      .run(id, id, id, now, now);
  }
  test.sqlite.prepare('INSERT INTO users(id,email,email_normalized,created_at,updated_at) VALUES(?,?,?,?,?)')
    .run('legal-shared', 'shared@example.invalid', 'shared@example.invalid', now, now);
  for (const id of ['legal-a', 'legal-b']) {
    test.sqlite.prepare('INSERT INTO business_users(business_id,user_id,role,permission_template,created_at,updated_at) VALUES(?,?,?,?,?,?)')
      .run(id, 'legal-shared', 'employee', 'employee', now, now);
  }
  const protectedState = () => ['businesses', 'users', 'business_users'].map(table =>
    test.sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all());
  const before = protectedState();
  let mailSent = false;
  const receipts = [];
  const route = loadServerModules({ '#lib/server/email.ts': {
    async sendAccountDeletionRequestEmail(input) { receipts.push(input); return { sent: mailSent, reason: mailSent ? undefined : 'not-configured' }; }
  } })('src/routes/account-deletion/+page.server.ts');
  const submit = (scope, locals = {}) => route.actions.default({
    request: formRequest({ email: 'shared@example.invalid', workspace_name: 'legal-a', request_scope: scope }, '/account-deletion'),
    locals: { DB: test.db, ...locals }, url: new URL('https://criminiops.com/account-deletion'),
    getClientAddress: () => '192.0.2.45'
  });
  for (mailSent of [false, true]) {
    for (const scope of ['user', 'workspace']) {
      const result = await submit(scope, { userId: 'legal-shared', businessId: 'legal-a' });
      assert.equal(result.success, true);
      assert.match(pageText('account-deletion', { form: result }), /Request received for review/);
      assert.deepEqual(protectedState(), before, 'A request must not delete either restaurant or the shared account');
    }
  }
  const requests = test.sqlite.prepare('SELECT * FROM account_deletion_requests ORDER BY created_at,id').all();
  assert.equal(requests.length, 4);
  assert.ok(requests.every(row => row.status === 'pending' && row.requester_user_id === 'legal-shared' && row.requester_business_id === 'legal-a'));
  assert.deepEqual([...new Set(requests.map(row => row.request_scope))].sort(), ['user', 'workspace']);
  assert.equal(new Set(requests.map(row => row.id)).size, 4);
  assert.ok(requests.every(row => row.ip_hash && row.ip_hash !== '192.0.2.45'));
  assert.equal(receipts.length, 4);
  assert.equal((await submit('user')).status, 429);
  assert.equal(receipts.length, 4, 'Rate-limited requests must not create another email');
  assert.equal(test.sqlite.prepare('SELECT COUNT(*) n FROM account_deletion_requests').get().n, 4);
  assert.deepEqual(protectedState(), before);
  assert.equal((await submit('invalid')).status, 400);
  assert.equal((await submit('user', { DB: null })).status, 503);
  console.log('PASS actual-schema deletion request: pending only, two-restaurant identity preserved, same receipt with/without configured mail, hashed IP, validation and rate limit');
} finally {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
  test.close();
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
  source.includes('Crimini by NexusNorthSystemsTech, LLC')
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
  source.includes('Crimini by NexusNorthSystemsTech, LLC') &&
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

for (const path of ['src/routes/pricing/+page.svelte', 'src/routes/billing/+page.svelte',
  'src/lib/components/onboarding/OwnerRegistration.svelte', 'src/routes/billing-terms/+page.svelte']) {
  expect(path, 'sensor copy does not promise unlimited or enforce unapproved quantities: ' + path, source =>
    !/no (?:fixed )?sensor ceiling|unlimited sensors|(?:maximum of|up to)\s+25\s+(?:active\s+)?sensors\b/i.test(source));
}

for (const path of ['src/routes/+layout.svelte', 'src/routes/+page.svelte',
  'src/lib/components/onboarding/OwnerRegistration.svelte',
  'src/lib/components/onboarding/EmployeeInviteRegistration.svelte',
  'src/routes/login/+page.svelte', 'src/routes/register/welcome/+page.svelte',
  'src/lib/server/email.ts', 'static/manifest.webmanifest']) {
  expect(path, 'public company identity is consistent: ' + path, source =>
    source.includes(company) && !source.includes('NNS, LLC'));
}

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) {
  console.error(`\nLegal readiness check failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log('\nLegal disclosure and request regression checks passed. Legal, policy, inbox, store and physical acceptance are not certified by this check.');
