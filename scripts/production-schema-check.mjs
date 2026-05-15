import { readFileSync, existsSync } from 'node:fs';

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
  source.includes('missingCoreTables')
);

expect('docs/release-deploy-playbook.md', 'deploy playbook includes schema verification', (source) =>
  source.includes('npm run test:production-schema') &&
  source.includes('npm run schema:readiness:prod')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) {
  process.exit(1);
}
