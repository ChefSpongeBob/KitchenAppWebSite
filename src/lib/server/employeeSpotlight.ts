export type EmployeeSpotlight = {
  employeeName: string;
  shoutout: string;
  updatedAt: number;
};

let employeeSpotlightSchemaEnsured = false;

function employeeSpotlightId(businessId?: string | null) {
  return businessId ? `${businessId}:homepage` : 'homepage';
}

async function ensureOptionalColumn(
  db: App.Platform['env']['DB'],
  tableName: string,
  columnName: string,
  definition: string
) {
  try {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('duplicate column name') || message.includes('already exists')) return;
    throw error;
  }
}

export async function ensureEmployeeSpotlightSchema(db: App.Platform['env']['DB']) {
  if (employeeSpotlightSchemaEnsured) return;

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS employee_spotlight (
        id TEXT PRIMARY KEY,
        employee_name TEXT NOT NULL DEFAULT '',
        shoutout TEXT NOT NULL DEFAULT '',
        updated_by TEXT,
        updated_at INTEGER NOT NULL DEFAULT 0,
        business_id TEXT,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();
  await ensureOptionalColumn(db, 'employee_spotlight', 'business_id', 'TEXT');
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_employee_spotlight_business_id ON employee_spotlight(business_id)`)
    .run();

  employeeSpotlightSchemaEnsured = true;
}

export async function loadEmployeeSpotlight(db: App.Platform['env']['DB'], businessId?: string | null) {
  await ensureEmployeeSpotlightSchema(db);

  const id = employeeSpotlightId(businessId);
  const row = businessId
    ? await db
        .prepare(
          `
          SELECT employee_name, shoutout, updated_at
          FROM employee_spotlight
          WHERE business_id = ? OR id = ?
          ORDER BY CASE WHEN business_id = ? THEN 0 ELSE 1 END
          LIMIT 1
          `
        )
        .bind(businessId, id, businessId)
        .first<{ employee_name: string; shoutout: string; updated_at: number }>()
    : await db
        .prepare(
          `
          SELECT employee_name, shoutout, updated_at
          FROM employee_spotlight
          WHERE id = ?
          LIMIT 1
          `
        )
        .bind(id)
        .first<{ employee_name: string; shoutout: string; updated_at: number }>();

  return {
    employeeName: row?.employee_name ?? '',
    shoutout: row?.shoutout ?? '',
    updatedAt: row?.updated_at ?? 0
  } satisfies EmployeeSpotlight;
}

export function getEmployeeSpotlightId(businessId?: string | null) {
  return employeeSpotlightId(businessId);
}
