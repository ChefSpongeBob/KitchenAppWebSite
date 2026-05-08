import { dev } from '$app/environment';

type D1 = App.Platform['env']['DB'];

const TENANT_TABLES = [
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
  'app_feature_flags_business',
  'iot_devices'
];

let tenantSchemaEnsured = false;
let tenantSchemaPromise: Promise<void> | null = null;
const processedTenantTables = new Set<string>();
const backfilledTenantTables = new Set<string>();

export type TenantSchemaIssue = {
  table: string;
  issue: 'missing_table' | 'missing_business_id';
};

function safeIdentifier(value: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return value;
}

async function tableExists(db: D1, tableName: string) {
  const row = await db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
      LIMIT 1
      `
    )
    .bind(tableName)
    .first<{ name: string }>();
  return Boolean(row?.name);
}

async function hasColumn(db: D1, tableName: string, columnName: string) {
  const table = safeIdentifier(tableName);
  const rows = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return (rows.results ?? []).some((row) => row.name === columnName);
}

async function ensureBusinessColumn(db: D1, tableName: string) {
  const table = safeIdentifier(tableName);
  if (processedTenantTables.has(table)) return;
  if (!(await tableExists(db, table))) return;
  if (!(await hasColumn(db, table, 'business_id'))) {
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN business_id TEXT`).run();
  }
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_${table}_business_id ON ${table}(business_id)`)
    .run();
  processedTenantTables.add(table);
}

export async function singleActiveBusinessId(db: D1) {
  if (!(await tableExists(db, 'businesses'))) return null;
  const rows = await db
    .prepare(
      `
      SELECT id
      FROM businesses
      WHERE COALESCE(status, 'active') = 'active'
      ORDER BY created_at ASC
      LIMIT 2
      `
    )
    .all<{ id: string }>();
  const businesses = rows.results ?? [];
  return businesses.length === 1 ? businesses[0].id : null;
}

async function backfillSingleBusinessRows(db: D1) {
  const businessId = await singleActiveBusinessId(db);
  if (!businessId) return;

  for (const tableName of TENANT_TABLES) {
    const table = safeIdentifier(tableName);
    if (backfilledTenantTables.has(table)) continue;
    if (!(await tableExists(db, table))) continue;
    if (!(await hasColumn(db, table, 'business_id'))) continue;
    await db.prepare(`UPDATE ${table} SET business_id = ? WHERE business_id IS NULL`).bind(businessId).run();
    backfilledTenantTables.add(table);
  }
}

export async function verifyTenantSchema(db: D1) {
  const issues: TenantSchemaIssue[] = [];

  for (const tableName of TENANT_TABLES) {
    const table = safeIdentifier(tableName);
    if (!(await tableExists(db, table))) {
      issues.push({ table, issue: 'missing_table' });
      continue;
    }
    if (!(await hasColumn(db, table, 'business_id'))) {
      issues.push({ table, issue: 'missing_business_id' });
    }
  }

  return issues;
}

export async function ensureTenantSchema(db: D1, force = false) {
  if (!force && tenantSchemaEnsured) return;
  if (!force && tenantSchemaPromise) {
    await tenantSchemaPromise;
    return;
  }

  const run = async () => {
    if (!dev) {
      const issues = await verifyTenantSchema(db);
      if (issues.length) {
        console.error(
          `Production schema readiness failed. Apply migrations before serving traffic: ${issues
            .map((issue) => `${issue.table}:${issue.issue}`)
            .join(', ')}`
        );
      }
      tenantSchemaEnsured = true;
      return;
    }

    for (const tableName of TENANT_TABLES) {
      await ensureBusinessColumn(db, tableName);
    }
    await backfillSingleBusinessRows(db);
    tenantSchemaEnsured = true;
  };

  if (force) {
    await run();
    return;
  }

  tenantSchemaPromise = run();
  await tenantSchemaPromise;
}

export function requireBusinessId(locals: App.Locals) {
  const businessId = String(locals.businessId ?? '').trim();
  if (!businessId) {
    throw new Error('No active business was found for this account.');
  }
  return businessId;
}
