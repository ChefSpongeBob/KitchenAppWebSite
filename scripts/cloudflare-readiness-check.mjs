import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [];

function read(filePath) {
  const absolute = path.join(root, filePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
}

function expect(label, ok, detail = '') {
  checks.push({ label, ok: Boolean(ok), detail });
}

function parseWrangler() {
  const source = read('wrangler.jsonc');
  if (!source) return null;
  try {
    return JSON.parse(source);
  } catch (error) {
    expect('wrangler.jsonc parses as JSON', false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

const wrangler = parseWrangler();
if (wrangler) {
  const d1 = wrangler.d1_databases?.find((binding) => binding.binding === 'DB');
  const docMedia = wrangler.r2_buckets?.find((bucket) => bucket.binding === 'DOC_MEDIA');
  const cameraMedia = wrangler.r2_buckets?.find((bucket) => bucket.binding === 'CAMERA_MEDIA');

  expect('Cloudflare Pages output directory is configured', wrangler.pages_build_output_dir === '.svelte-kit/cloudflare');
  expect('Cloudflare nodejs_compat flag is enabled', wrangler.compatibility_flags?.includes('nodejs_compat'));
  expect('D1 binding DB points to crimini-production', d1?.database_name === 'crimini-production');
  expect('D1 database id is present', typeof d1?.database_id === 'string' && d1.database_id.length > 20);
  expect('DOC_MEDIA R2 binding is configured', docMedia?.bucket_name === 'crimini-doc-media');
  expect('CAMERA_MEDIA R2 binding is configured', cameraMedia?.bucket_name === 'crimini-camera-media');
  expect('APP_BASE_URL points to production domain', wrangler.vars?.APP_BASE_URL === 'https://criminiops.com');
}

const packageJson = JSON.parse(read('package.json') || '{}');
const scripts = packageJson.scripts ?? {};
expect('Remote migration script uses DB binding', scripts['db:migrations:apply:remote'] === 'npx wrangler d1 migrations apply DB --remote');
expect('Local migration script uses DB binding', scripts['db:migrations:apply:local'] === 'npx wrangler d1 migrations apply DB --local');
expect('Static checks include Cloudflare readiness', String(scripts['test:static'] ?? '').includes('test:cloudflare-readiness'));

const migrations = fs
  .readdirSync(path.join(root, 'migrations'))
  .filter((file) => /^\d+_.+\.sql$/.test(file))
  .sort();
expect('Latest billing entitlement migration exists', migrations.includes('0059_store_entitlements.sql'));
expect('Schedule resource index migration exists', migrations.includes('0060_schedule_resource_indexes.sql'));
expect('Employee HR compliance foundation migration exists', migrations.includes('0061_employee_hr_compliance_foundation.sql'));
expect('Employee sensitive vault migration exists', migrations.includes('0062_employee_invite_sensitive_vault.sql'));
expect('Employee compliance onboarding link migration exists', migrations.includes('0063_employee_compliance_onboarding_link.sql'));
expect('Account deletion migration exists', migrations.includes('0058_account_deletion_requests.sql'));
expect('Todo foreign key repair migration exists', migrations.includes('0057_repair_todo_user_foreign_keys.sql'));

const hooks = read('src/hooks.server.ts');
expect('Schema guard is enabled around Cloudflare DB', hooks.includes('wrapProductionSchemaGuard'));
expect('Public billing webhook routes are allowed', hooks.includes('/api/billing/app-store-notifications') && hooks.includes('/api/billing/google-play-notifications'));

const readinessEndpoint = read('src/routes/api/internal/schema-readiness/+server.ts');
expect('Schema readiness checks store products', readinessEndpoint.includes('store_products'));
expect('Schema readiness checks account deletion requests', readinessEndpoint.includes('account_deletion_requests'));
expect('Schema readiness checks employee HR compliance foundation', readinessEndpoint.includes('employee_compliance_documents'));
expect('Schema readiness checks employee sensitive vault foundation', readinessEndpoint.includes('employee_sensitive_record_vault'));
expect('Schema readiness checks onboarding compliance link index', readinessEndpoint.includes('idx_employee_compliance_documents_onboarding_item'));

const storeDoc = read('docs/store-billing-setup.md');
expect('Store billing doc lists Cloudflare billing secrets', storeDoc.includes('APP_STORE_PRIVATE_KEY') && storeDoc.includes('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'));

const playbook = read('docs/release-deploy-playbook.md');
expect('Deploy playbook references DB binding, not old kitchen binding', playbook.includes('d1 execute DB --remote') && !playbook.includes('d1 execute kitchen --remote'));
expect('Deploy playbook includes Cloudflare readiness check', playbook.includes('npm run test:cloudflare-readiness'));

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok && check.detail) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
