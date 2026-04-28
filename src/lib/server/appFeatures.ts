import {
  appFeatureDefinitions,
  defaultAppFeatureModes,
  type AppFeatureKey,
  type AppFeatureMode,
  type AppFeatureModes,
  normalizeAppFeatureModes
} from '$lib/features/appFeatures';

type DB = App.Platform['env']['DB'];

let featureSchemaEnsured = false;
let ensureFeatureSchemaPromise: Promise<void> | null = null;

async function ensureAppFeatureSchema(db: DB) {
  if (featureSchemaEnsured) return;
  if (ensureFeatureSchemaPromise) {
    await ensureFeatureSchemaPromise;
    return;
  }

  ensureFeatureSchemaPromise = (async () => {
    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS app_feature_flags_business (
          business_id TEXT NOT NULL,
          feature_key TEXT NOT NULL,
          mode TEXT NOT NULL DEFAULT 'all',
          updated_at INTEGER NOT NULL,
          updated_by TEXT,
          PRIMARY KEY (business_id, feature_key),
          FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
          FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
        `
      )
      .run();

    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS app_feature_flags (
          feature_key TEXT PRIMARY KEY,
          mode TEXT NOT NULL DEFAULT 'all',
          updated_at INTEGER NOT NULL,
          updated_by TEXT,
          FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
        `
      )
      .run();

    for (const feature of appFeatureDefinitions) {
      await db
        .prepare(
          `
          INSERT INTO app_feature_flags (feature_key, mode, updated_at, updated_by)
          VALUES (?, ?, ?, NULL)
          ON CONFLICT(feature_key) DO NOTHING
          `
        )
        .bind(feature.key, defaultAppFeatureModes[feature.key], now)
        .run();
    }

    featureSchemaEnsured = true;
  })();

  await ensureFeatureSchemaPromise;
}

async function seedBusinessFeatureModes(db: DB, businessId: string) {
  const now = Math.floor(Date.now() / 1000);
  for (const feature of appFeatureDefinitions) {
    await db
      .prepare(
        `
        INSERT INTO app_feature_flags_business (business_id, feature_key, mode, updated_at, updated_by)
        VALUES (?, ?, ?, ?, NULL)
        ON CONFLICT(business_id, feature_key) DO NOTHING
        `
      )
      .bind(businessId, feature.key, defaultAppFeatureModes[feature.key], now)
      .run();
  }
}

export async function loadAppFeatureModes(db: DB, businessId?: string | null): Promise<AppFeatureModes> {
  await ensureAppFeatureSchema(db);

  if (businessId) {
    await seedBusinessFeatureModes(db, businessId);
    const rows = await db
      .prepare(
        `
        SELECT feature_key, mode
        FROM app_feature_flags_business
        WHERE business_id = ?
        `
      )
      .bind(businessId)
      .all<{ feature_key: string; mode: string }>();

    const values: Partial<Record<string, string>> = {};
    for (const row of rows.results ?? []) {
      values[row.feature_key] = row.mode;
    }

    return normalizeAppFeatureModes(values);
  }

  const rows = await db
    .prepare(
      `
      SELECT feature_key, mode
      FROM app_feature_flags
      `
    )
    .all<{ feature_key: string; mode: string }>();

  const values: Partial<Record<string, string>> = {};
  for (const row of rows.results ?? []) {
    values[row.feature_key] = row.mode;
  }

  return normalizeAppFeatureModes(values);
}

export async function saveAppFeatureModes(
  db: DB,
  nextModes: Partial<Record<AppFeatureKey, AppFeatureMode>>,
  updatedBy: string | null,
  businessId?: string | null
) {
  await ensureAppFeatureSchema(db);

  const now = Math.floor(Date.now() / 1000);
  if (businessId) {
    await seedBusinessFeatureModes(db, businessId);
    for (const feature of appFeatureDefinitions) {
      const mode = nextModes[feature.key];
      if (!mode) continue;

      await db
        .prepare(
          `
          INSERT INTO app_feature_flags_business (business_id, feature_key, mode, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(business_id, feature_key) DO UPDATE SET
            mode = excluded.mode,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by
          `
        )
        .bind(businessId, feature.key, mode, now, updatedBy)
        .run();
    }
    return;
  }

  for (const feature of appFeatureDefinitions) {
    const mode = nextModes[feature.key];
    if (!mode) continue;

    await db
      .prepare(
        `
        INSERT INTO app_feature_flags (feature_key, mode, updated_at, updated_by)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(feature_key) DO UPDATE SET
          mode = excluded.mode,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by
        `
      )
      .bind(feature.key, mode, now, updatedBy)
      .run();
  }
}
