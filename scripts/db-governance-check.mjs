import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function extractQuotedArray(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!match) throw new Error(`Could not find ${name}.`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

function parseInventoryCatalog(source) {
  const catalogStart = source.indexOf('## Full Table Catalog');
  if (catalogStart === -1) throw new Error('DB inventory is missing the full table catalog.');

  const tableBlocks = new Map();
  const catalog = source.slice(catalogStart);
  const blocks = catalog.split(/^### /m).slice(1);
  for (const block of blocks) {
    const newlineIndex = block.indexOf('\n');
    if (newlineIndex === -1) continue;
    const table = block.slice(0, newlineIndex).trim();
    tableBlocks.set(table, block.slice(newlineIndex + 1));
  }
  return tableBlocks;
}

function hasColumn(block, column) {
  return block.includes(`- \`${column}\``);
}

function pushCheck(checks, label, ok, detail = '') {
  checks.push({ label, ok: Boolean(ok), detail });
}

const inventory = read('docs/DB_ROUTE_INVENTORY.md');
const tenantSource = read('src/lib/server/tenant.ts');
const adminSource = read('src/lib/server/admin.ts');
const registerSource = read('src/routes/register/+page.server.ts');
const packageJson = read('package.json');

const catalog = parseInventoryCatalog(inventory);
const allTables = [...catalog.keys()].sort();
const tenantTables = new Set(extractQuotedArray(tenantSource, 'TENANT_TABLES'));

const alternateTenantColumns = new Map([
  ['account_deletion_requests', 'requester_business_id'],
  ['iot_device_inventory', 'claimed_business_id']
]);

const approvedGlobalTables = new Map([
  ['app_feature_flags', 'global app feature definitions used to seed business feature rows'],
  ['businesses', 'root tenant registry'],
  ['d1_migrations', 'Cloudflare D1 migration bookkeeping'],
  ['devices', 'user/session device registry resolved through authenticated user membership'],
  ['iot_ingest_guard', 'global ingest replay/rate guard keyed by device/auth material'],
  ['password_resets', 'global account recovery token table'],
  ['security_rate_limits', 'global abuse and rate-limit guard'],
  ['sessions', 'global auth session table resolved into active business context'],
  ['store_products', 'global app-store product catalog'],
  ['store_webhook_events', 'global raw billing webhook intake before entitlement reconciliation'],
  ['trial_denials', 'global anti-abuse trial denial registry'],
  ['user_invites', 'legacy user invite table; active restaurant onboarding uses business_invites'],
  ['user_preferences', 'global per-user settings and tour completion state'],
  ['users', 'global identity table; tenant authority lives in business_users']
]);

const checks = [];
const tenantWithBusinessId = [];
const unclassified = [];

for (const table of allTables) {
  const block = catalog.get(table) ?? '';
  const hasBusinessId = hasColumn(block, 'business_id');
  const alternateColumn = alternateTenantColumns.get(table);
  const isTenantTable = tenantTables.has(table);
  const isApprovedGlobal = approvedGlobalTables.has(table);

  if (hasBusinessId) tenantWithBusinessId.push(table);

  if (isTenantTable) {
    pushCheck(checks, `${table} is tenant-scoped with business_id`, hasBusinessId, `${table} is in TENANT_TABLES but inventory does not show business_id.`);
    continue;
  }

  if (alternateColumn) {
    pushCheck(
      checks,
      `${table} has approved alternate tenant column ${alternateColumn}`,
      hasColumn(block, alternateColumn),
      `${table} is alternate-scoped but inventory does not show ${alternateColumn}.`
    );
    continue;
  }

  if (isApprovedGlobal) {
    pushCheck(checks, `${table} is approved global/system table`, true, approvedGlobalTables.get(table));
    continue;
  }

  unclassified.push(table);
}

const tenantMissingFromSource = tenantWithBusinessId.filter((table) => !tenantTables.has(table));
pushCheck(
  checks,
  'every business_id table is listed in TENANT_TABLES',
  tenantMissingFromSource.length === 0,
  tenantMissingFromSource.join(', ')
);

const tenantMissingFromInventory = [...tenantTables].filter((table) => !catalog.has(table));
pushCheck(
  checks,
  'every TENANT_TABLES entry exists in DB inventory',
  tenantMissingFromInventory.length === 0,
  tenantMissingFromInventory.join(', ')
);

pushCheck(
  checks,
  'every DB table has an explicit tenancy classification',
  unclassified.length === 0,
  unclassified.join(', ')
);

pushCheck(
  checks,
  'active admin invite creation uses business_invites',
  adminSource.includes('INSERT INTO business_invites') && adminSource.includes('WHERE business_id = ?'),
  'Admin invite creation/listing must stay business scoped.'
);

pushCheck(
  checks,
  'legacy user_invites is not an active creation path',
  !/INSERT\s+INTO\s+user_invites/i.test(adminSource) && !/INSERT\s+INTO\s+user_invites/i.test(registerSource),
  'user_invites may be read/claimed for legacy compatibility, but new invites must not insert into it.'
);

pushCheck(
  checks,
  'registration claims business invites with business/email/expiry guards',
  registerSource.includes('UPDATE business_invites') &&
    registerSource.includes('AND business_id = ?') &&
    registerSource.includes('AND email_normalized = ?') &&
    registerSource.includes('AND used_at IS NULL') &&
    registerSource.includes('AND revoked_at IS NULL') &&
    registerSource.includes('AND (expires_at IS NULL OR expires_at >= ?)'),
  'Business invite acceptance must be scoped and race-safe.'
);

pushCheck(
  checks,
  'static suite includes DB governance check',
  packageJson.includes('test:db-governance') && packageJson.includes('npm run test:db-governance'),
  'package.json must run the governance check in the static suite.'
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok && check.detail) console.log(`  ${check.detail}`);
}

console.log(`\nClassified tables: ${allTables.length}`);
console.log(`Tenant business_id tables: ${tenantWithBusinessId.length}`);
console.log(`Alternate tenant-column tables: ${alternateTenantColumns.size}`);
console.log(`Approved global/system tables: ${approvedGlobalTables.size}`);

if (failed.length) process.exit(1);
