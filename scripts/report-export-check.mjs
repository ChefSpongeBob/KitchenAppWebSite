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

for (const route of ['lists', 'schedule', 'requests', 'temperature', 'onboarding', 'waste']) {
  expect(`src/routes/reports/${route}/+page.server.ts`, `${route} report page is report-access gated`, (source) =>
    source.includes('hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)') &&
    source.includes('requireBusinessId(locals)')
  );

  expect(`src/routes/reports/${route}.csv/+server.ts`, `${route} CSV endpoint is report-access gated`, (source) =>
    source.includes('hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)') &&
    source.includes('content-disposition') &&
    source.includes('csvEscape') &&
    source.includes('\\uFEFF') &&
    source.includes('report.startDate') &&
    source.includes('report.endDate')
  );

  expect(`src/routes/reports/${route}/+page.svelte`, `${route} report uses the native report workspace`, (source) =>
    ['ReportToolbar', 'ReportDateFilters', 'ReportSummaryStrip', 'ReportDataTable', 'ReportExportList'].every((token) =>
      source.includes(token)
    )
  );
}

for (const component of ['ReportToolbar', 'ReportDateFilters', 'ReportSummaryStrip', 'ReportDataTable', 'ReportExportList']) {
  expect(`src/lib/components/ui/${component}.svelte`, `${component} shared report component exists`, (source) =>
    source.length > 0
  );
}

expect('src/lib/server/history.ts', 'CSV escaping prevents spreadsheet formula injection', (source) =>
  source.includes("const raw = String(value ?? '')") &&
  source.includes("/^[=+\\-@\\t\\r]/") &&
  source.includes("`'${raw}`")
);

expect('src/lib/server/reports.ts', 'report helpers keep exports tenant scoped and bounded', (source) =>
  [
    'loadScheduleRequestsReport',
    'loadTemperatureReport',
    'loadOnboardingReport',
    'loadWasteReport',
    'WHERE r.business_id = ?',
    'WHERE t.business_id = ?',
    'WHERE p.business_id = ?',
    'WHERE w.business_id = ?',
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

expect('src/routes/reports/onboarding.csv/+server.ts', 'onboarding CSV formats timestamps for users', (source) =>
  source.includes('csvTimestamp(row.sent_at)') &&
  source.includes('csvTimestamp(row.completed_at)') &&
  source.includes('csvTimestamp(row.approved_at)')
);

expect('src/routes/reports/temperature/+page.server.ts', 'temperature viewer uses bounded hourly aggregates', (source) =>
  source.includes('loadTemperatureHourlyAverageReport') && !source.includes('loadTemperatureReport(')
);

expect('src/routes/reports/temperature.csv/+server.ts', 'temperature CSV identifies temperature and humidity units', (source) =>
  source.includes('Average Temperature (F)') && source.includes('Average Humidity (%)')
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

expect('src/routes/reports/+page.svelte', 'reports landing links every operational report', (source) =>
  [
    'domain=preplists',
    'domain=checklists',
    'domain=inventory',
    'domain=orders',
    '/reports/schedule',
    '/reports/requests',
    '/reports/temperature',
    '/reports/onboarding',
    '/reports/waste',
    '/todo/log'
  ].every((href) => source.includes(href))
);

expect('src/routes/reports/+page.server.ts', 'ToDo history link remains permission aware', (source) =>
  source.includes("'manage_content'") && source.includes('canViewTodoLog')
);

expect('src/routes/todo/log/+page.server.ts', 'ToDo history remains tenant scoped and bounded', (source) =>
  source.includes('WHERE l.business_id = ?') && source.includes('LIMIT 250') && source.includes('canManageTodoHistory')
);

expect('src/routes/todo/log/+page.svelte', 'ToDo history uses the current report presentation', (source) =>
  source.includes('history-row') && source.includes('ReportToolbar') && !source.includes('DashboardCard')
);

expect('docs/PROJECT_HANDOFF.md', 'handoff tracks reports/export launch work', (source) =>
  source.includes('8. Reports and exports') &&
  source.includes('spreadsheet-safe CSVs')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
