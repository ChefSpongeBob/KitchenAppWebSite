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

for (const route of ['requests', 'temperature', 'onboarding']) {
  expect(`src/routes/reports/${route}/+page.server.ts`, `${route} report page is report-access gated`, (source) =>
    source.includes('hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)') &&
    source.includes('requireBusinessId(locals)')
  );

  expect(`src/routes/reports/${route}.csv/+server.ts`, `${route} CSV endpoint is report-access gated`, (source) =>
    source.includes('hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)') &&
    source.includes('content-disposition') &&
    source.includes('csvEscape')
  );
}

expect('src/lib/server/reports.ts', 'report helpers keep exports tenant scoped and bounded', (source) =>
  [
    'loadScheduleRequestsReport',
    'loadTemperatureReport',
    'loadOnboardingReport',
    'WHERE r.business_id = ?',
    'WHERE t.business_id = ?',
    'WHERE p.business_id = ?',
    'LIMIT 1000',
    'LIMIT 500'
  ].every((token) => source.includes(token))
);

expect('src/lib/server/reports.ts', 'onboarding report excludes sensitive payload and document links', (source) =>
  !source.includes('form_payload') &&
  !source.includes('file_url') &&
  !source.includes('source_file_url') &&
  !source.includes('signed_name')
);

expect('migrations/0080_report_export_indexes.sql', 'report export indexes support production report filters', (source) =>
  [
    'idx_schedule_shift_offers_business_updated',
    'idx_schedule_open_shift_requests_business_updated',
    'idx_user_schedule_time_off_requests_business_updated',
    'idx_temperature_alert_events_business_seen',
    'idx_employee_onboarding_packages_business_updated'
  ].every((indexName) => source.includes(indexName))
);

expect('src/routes/reports/+page.svelte', 'reports landing links to Phase 8 exports', (source) =>
  ['/reports/requests', '/reports/temperature', '/reports/onboarding'].every((href) => source.includes(href))
);

expect('docs/PROJECT_HANDOFF.md', 'handoff tracks Phase 8 reports/export phase', (source) =>
  source.includes('`8. Reports/export foundation`') &&
  source.includes('Active phase: `9. Billing and store subscription lifecycle`')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
