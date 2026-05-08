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

expect('docs/scale-performance-audit.md', 'scale audit document exists', (source) =>
  source.includes('Query Areas Reviewed') && source.includes('Next Scale Notes')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
