import { readFileSync, existsSync, readdirSync } from 'node:fs';

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
