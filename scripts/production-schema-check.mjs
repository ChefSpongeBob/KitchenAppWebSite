import { readFileSync, existsSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadServerModules } from './helpers/test-d1.mjs';

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

function expectNoRouteSchemaMutation() {
  const routeRoot = 'src/routes';
  const blocked = /\b(CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+INDEX|DROP\s+INDEX|PRAGMA\s+table_info)\b/i;
  const hits = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|js|svelte)$/.test(entry.name)) continue;
      const source = read(full);
      if (blocked.test(source)) hits.push(full);
    }
  };
  walk(routeRoot);
  checks.push({
    ok: hits.length === 0,
    label: 'route request handlers do not mutate or probe schema',
    detail: hits.length ? hits.join(', ') : routeRoot
  });
}

expect('src/lib/server/schemaGuard.ts', 'production D1 schema guard exists', (source) =>
  source.includes('wrapProductionSchemaGuard') &&
  source.includes('Runtime schema mutation blocked in production') &&
  source.includes('CREATE|ALTER|DROP|REINDEX|VACUUM')
);

expect('src/hooks.server.ts', 'request DB is wrapped by schema guard', (source) =>
  source.includes('wrapProductionSchemaGuard') &&
  source.includes('ALLOW_RUNTIME_SCHEMA_MUTATION')
);

expect('src/lib/server/tenant.ts', 'tenant schema repair is skipped on production request paths', (source) =>
  source.includes('verifyTenantSchema') &&
  source.includes('if (!dev)') &&
  source.includes('tenantSchemaEnsured = true') &&
  source.includes('return;')
);

expect('src/routes/api/internal/schema-readiness/+server.ts', 'schema readiness endpoint exists', (source) =>
  source.includes('verifyTenantSchema') &&
  source.includes('SMOKE_INTERNAL_TOKEN') &&
  source.includes('missingCoreTables') &&
  source.includes('missingCoreIndexes') &&
  source.includes('missingCoreColumns') &&
  source.includes("schedule_weeks: [") &&
  source.includes("'draft_write_token'") &&
  source.includes('business_position_permissions') &&
  source.includes('idx_business_users_business_position') &&
  source.includes('idx_schedule_departments_business_active_order')
);

expect('docs/PROJECT_HANDOFF.md', 'deploy playbook includes schema verification', (source) =>
  source.includes('npm run test:production-schema') &&
  source.includes('npm run schema:readiness:prod')
);

expectNoRouteSchemaMutation();

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) {
  process.exit(1);
}

const { wrapProductionSchemaGuard } = loadServerModules()('src/lib/server/schemaGuard.ts');
class BrandedDatabase {
  #value = 42;
  get marker() { return this.#value; }
  batch() { return this.#value; }
}
const branded = new BrandedDatabase();
const guarded = wrapProductionSchemaGuard(branded, false);
assert.equal(guarded.batch(), 42, 'D1 methods must retain their original receiver');
assert.equal(guarded.marker, 42, 'D1 accessors must retain their original receiver');
assert.equal(wrapProductionSchemaGuard(branded, true), branded);

const require = createRequire(import.meta.url);
const tools = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = tools('miniflare');
const { buildSync } = tools('esbuild');
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const { outputFiles } = buildSync({
  stdin: { contents: `
    import { wrapProductionSchemaGuard } from './src/lib/server/schemaGuard.ts';
    export default { async fetch(_request, env) {
      await env.DB.exec('CREATE TABLE runtime_guard_test (id TEXT PRIMARY KEY)');
      const db = wrapProductionSchemaGuard(env.DB, false);
      await db.batch(['one', 'two'].map(id => db.prepare('INSERT INTO runtime_guard_test (id) VALUES (?)').bind(id)));
      let rolledBack = false;
      try { await db.batch(['three', 'one'].map(id => db.prepare('INSERT INTO runtime_guard_test (id) VALUES (?)').bind(id))); }
      catch { rolledBack = true; }
      const blocked = await db.prepare('CREATE TABLE forbidden_guard_test (id TEXT)').run();
      await db.exec('CREATE TABLE forbidden_exec_test (id TEXT)');
      return Response.json({ rolledBack, blocked: blocked.meta.schemaMutationBlocked,
        rows: (await db.prepare('SELECT id FROM runtime_guard_test ORDER BY id').all()).results,
        forbidden: (await db.prepare("SELECT name FROM sqlite_master WHERE name IN ('forbidden_guard_test', 'forbidden_exec_test')").all()).results });
    }};`, resolveDir: process.cwd(), sourcefile: 'schema-guard-runtime-check.js' },
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false
});
const runtime = new Miniflare({
  host: '127.0.0.1', port: 0, cf: false, telemetry: { enabled: false },
  workers: [{ config: { name: 'schema-guard-runtime-check', compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags, env: { DB: { type: 'd1', id: 'isolated-schema-guard' } },
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: outputFiles[0].text } } } } }]
});
try {
  const response = await runtime.dispatchFetch('https://runtime.example.invalid');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { rolledBack: true, blocked: true, rows: [{ id: 'one' }, { id: 'two' }], forbidden: [] });
  console.log('PASS actual Workers D1: guarded batches retain their receiver, writes and atomic rollback work, runtime schema changes stay blocked');
} finally { await runtime.dispose(); }
