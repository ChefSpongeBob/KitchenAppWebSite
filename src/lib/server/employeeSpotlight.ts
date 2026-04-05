export type EmployeeSpotlight = {
  employeeName: string;
  shoutout: string;
  updatedAt: number;
};

let employeeSpotlightSchemaEnsured = false;

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
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  employeeSpotlightSchemaEnsured = true;
}

export async function loadEmployeeSpotlight(db: App.Platform['env']['DB']) {
  await ensureEmployeeSpotlightSchema(db);

  const row = await db
    .prepare(
      `
      SELECT employee_name, shoutout, updated_at
      FROM employee_spotlight
      WHERE id = 'homepage'
      LIMIT 1
      `
    )
    .first<{ employee_name: string; shoutout: string; updated_at: number }>();

  return {
    employeeName: row?.employee_name ?? '',
    shoutout: row?.shoutout ?? '',
    updatedAt: row?.updated_at ?? 0
  } satisfies EmployeeSpotlight;
}
