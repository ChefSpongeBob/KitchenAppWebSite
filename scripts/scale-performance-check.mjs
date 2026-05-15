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

expect('migrations/0053_scale_performance_indexes.sql', 'scale migration covers core tenant indexes', (source) =>
  [
    'idx_todos_business_created',
    'idx_documents_business_slug_active',
    'idx_schedule_shifts_business_week_date',
    'idx_schedule_shifts_business_user_date',
    'idx_temps_business_sensor_ts',
    'idx_camera_events_business_created',
    'idx_employee_onboarding_items_business_file'
  ].every((indexName) => source.includes(indexName))
);

expect('migrations/0060_schedule_resource_indexes.sql', 'schedule resource migration covers business-first indexes', (source) =>
  [
    'idx_schedule_departments_business_active_order',
    'idx_schedule_role_definitions_business_active_department',
    'idx_schedule_preferences_business',
    'idx_user_schedule_departments_business_user',
    'idx_schedule_open_shift_requests_business_open_user',
    'idx_schedule_templates_business_updated',
    'idx_store_purchase_events_business_status_created'
  ].every((indexName) => source.includes(indexName))
);

expect('src/lib/server/retention.ts', 'temp retention cleanup is batched', (source) =>
  source.includes('TEMP_CLEANUP_BATCH_SIZE') &&
  source.includes('LIMIT ?') &&
  source.includes('DELETE FROM temps')
);

expect('src/lib/server/camera.ts', 'camera retention cleanup is batched', (source) =>
  source.includes('CAMERA_CLEANUP_BATCH_SIZE') &&
  source.includes('ORDER BY created_at ASC') &&
  source.includes('DELETE FROM camera_events WHERE id = ?')
);

expect('src/routes/todo/+page.server.ts', 'todo cleanup is batched', (source) =>
  source.includes('TODO_CLEANUP_BATCH_SIZE') &&
  source.includes('ORDER BY completed_at ASC') &&
  source.includes('LIMIT ?')
);

expect('src/lib/server/admin.ts', 'whiteboard cleanup is throttled and batched', (source) =>
  source.includes('WHITEBOARD_CLEANUP_BATCH_SIZE') &&
  source.includes('WHITEBOARD_CLEANUP_INTERVAL_SECONDS') &&
  source.includes('lastWhiteboardCleanupAtByBusiness') &&
  source.includes('LIMIT ?')
);

expect('src/routes/admin/+page.server.ts', 'admin todo analytics are aggregated', (source) =>
  source.includes("SELECT 'created' AS kind") &&
  source.includes('UNION ALL') &&
  source.includes('completed_previous_window')
);

expect('src/lib/server/tenant.ts', 'tenant schema repair is skipped on production request paths', (source) =>
  source.includes("import { dev } from '$app/environment'") &&
  source.includes('if (!dev)') &&
  source.includes('verifyTenantSchema')
);

expect('src/lib/server/business.ts', 'business schema repair is skipped on production request paths', (source) =>
  source.includes("import { dev } from '$app/environment'") && source.includes('businessSchemaEnsured = true')
);

expect('src/lib/server/schedules.ts', 'schedule schema repair is skipped on production request paths', (source) =>
  source.includes("import { dev } from '$app/environment'") && source.includes('scheduleSchemaEnsured = true')
);

expect('src/lib/server/admin.ts', 'admin schema repair helpers are skipped on production request paths', (source) =>
  source.includes("import { dev } from '$app/environment'") &&
  source.includes('employeeOnboardingTablesEnsured = true') &&
  !source.includes("'' AS details")
);

expect('src/routes/api/temps/+server.ts', 'temp index repair is skipped on production API paths', (source) =>
  source.includes("import { dev } from '$app/environment'") && source.includes('tempsIndexesEnsured = true')
);

expect('src/routes/api/documents/media/[...key]/+server.ts', 'document media responses stream from R2', (source) =>
  source.includes('new Response(object.body') && !source.includes('object.arrayBuffer()')
);

expect('src/routes/api/camera/media/[...key]/+server.ts', 'camera media responses stream from R2', (source) =>
  source.includes('new Response(object.body') && !source.includes('object.arrayBuffer()')
);

expect('src/routes/api/camera/upload/+server.ts', 'camera uploads have hard size limits', (source) =>
  source.includes('MAX_CAMERA_STILL_BYTES') &&
  source.includes('MAX_CAMERA_CLIP_BYTES') &&
  source.includes('status: 413')
);

expect('docs/scale-performance-audit.md', 'scale audit document exists', (source) =>
  source.includes('Query Areas Reviewed') && source.includes('Next Scale Notes')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
