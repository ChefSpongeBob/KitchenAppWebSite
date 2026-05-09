import { spawnSync } from 'node:child_process';
import path from 'node:path';

const argv = new Set(process.argv.slice(2));
const isRemote = argv.has('--remote');
const isDryRun = argv.has('--dry-run');
const dbNameArg = process.argv.find((arg) => arg.startsWith('--db='));
const dbName = dbNameArg ? dbNameArg.slice('--db='.length) : 'crimini-production';
const root = process.cwd();

const tenantTables = [
  'todos',
  'todo_assignments',
  'todo_completion_log',
  'recipes',
  'documents',
  'whiteboard_posts',
  'whiteboard_review',
  'whiteboard_votes',
  'list_sections',
  'list_items',
  'checklist_sections',
  'checklist_items',
  'announcements',
  'employee_spotlight',
  'daily_specials',
  'daily_specials_editors',
  'meeting_notes',
  'sensor_nodes',
  'temps',
  'camera_events',
  'camera_sources',
  'schedule_weeks',
  'schedule_shifts',
  'schedule_week_team',
  'schedule_shift_offers',
  'schedule_open_shifts',
  'schedule_open_shift_requests',
  'schedule_templates',
  'schedule_template_shifts',
  'schedule_labor_targets',
  'schedule_preferences',
  'schedule_role_definitions',
  'schedule_departments',
  'user_schedule_departments',
  'user_schedule_availability',
  'user_schedule_time_off_requests',
  'creator_category_registry',
  'employee_profiles',
  'employee_profile_edit_requests',
  'employee_onboarding_packages',
  'employee_onboarding_items',
  'employee_onboarding_template_items',
  'business_trials',
  'store_billing_placeholders',
  'legal_agreements',
  'app_feature_flags_business'
];

function safeIdentifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return value;
}

function runWrangler(command) {
  const wranglerBin = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const args = [wranglerBin, 'd1', 'execute', dbName, isRemote ? '--remote' : '--local', '--command', command, '--json'];
  const proc = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8'
  });

  const combined = `${proc.stdout ?? ''}\n${proc.stderr ?? ''}`.trim();
  if (proc.status !== 0) {
    throw new Error(`Wrangler command failed:\n${combined}`);
  }

  return JSON.parse(proc.stdout || '[]');
}

function results(output) {
  return Array.isArray(output) ? (output[0]?.results ?? []) : [];
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function main() {
  const mode = isRemote ? 'remote' : 'local';
  console.log(`Ensuring tenant columns on ${mode} D1 database "${dbName}"...`);

  const safeTables = tenantTables.map(safeIdentifier);
  const quotedTables = safeTables.map(sqlQuote).join(', ');
  const columnRows = results(
    runWrangler(`
      SELECT m.name AS table_name, p.name AS column_name
      FROM sqlite_master AS m
      JOIN pragma_table_info(m.name) AS p
      WHERE m.type = 'table'
        AND m.name IN (${quotedTables});
    `)
  );

  const existing = new Set(columnRows.map((row) => row.table_name));
  const withBusinessId = new Set(
    columnRows.filter((row) => row.column_name === 'business_id').map((row) => row.table_name)
  );
  const missing = safeTables.filter((table) => existing.has(table) && !withBusinessId.has(table));

  if (missing.length === 0) {
    console.log('All existing tenant tables already have business_id.');
    return;
  }

  console.log(`Missing business_id on ${missing.length} table(s): ${missing.join(', ')}`);
  if (isDryRun) {
    console.log('Dry run only. No schema changes made.');
    return;
  }

  for (const table of missing) {
    runWrangler(`ALTER TABLE ${table} ADD COLUMN business_id TEXT;`);
    runWrangler(`CREATE INDEX IF NOT EXISTS idx_${table}_business_id ON ${table}(business_id);`);
    console.log(`Updated ${table}`);
  }

  console.log('Tenant column ensure complete.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
