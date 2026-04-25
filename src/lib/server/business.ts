type D1 = App.Platform['env']['DB'];

export type BusinessContext = {
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessPlan: string;
  businessRole: string;
  businessLogoUrl: string | null;
};

async function ensureOptionalColumn(db: D1, tableName: string, columnName: string, definition: string) {
  try {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('duplicate column name') || message.includes('already exists')) {
      return;
    }
    throw error;
  }
}

export function normalizeBusinessSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function businessSlugExists(db: D1, slug: string) {
  const row = await db
    .prepare(
      `
      SELECT id
      FROM businesses
      WHERE slug = ?
      LIMIT 1
      `
    )
    .bind(slug)
    .first<{ id: string }>();
  return Boolean(row?.id);
}

export async function reserveBusinessSlug(db: D1, requestedName: string) {
  const base = normalizeBusinessSlug(requestedName) || 'kitchen-workspace';
  let candidate = base;
  let i = 1;
  while (await businessSlugExists(db, candidate)) {
    i += 1;
    candidate = `${base}-${i}`;
  }
  return candidate;
}

export async function ensureBusinessSchema(db: D1) {
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS businesses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        plan_tier TEXT NOT NULL DEFAULT 'starter',
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
      `
    )
    .run();

  await ensureOptionalColumn(db, 'businesses', 'onboarding_completed_at', 'INTEGER');
  await ensureOptionalColumn(db, 'businesses', 'onboarding_schedule_template', 'TEXT');
  await ensureOptionalColumn(db, 'businesses', 'sidebar_logo_url', 'TEXT');
  await ensureOptionalColumn(db, 'businesses', 'legal_business_name', 'TEXT');
  await ensureOptionalColumn(db, 'businesses', 'registry_id', 'TEXT');
  await ensureOptionalColumn(db, 'businesses', 'contact_email', 'TEXT');
  await ensureOptionalColumn(db, 'businesses', 'contact_phone', 'TEXT');
  await ensureOptionalColumn(db, 'businesses', 'website_url', 'TEXT');
  await ensureOptionalColumn(db, 'businesses', 'address_line_1', 'TEXT');
  await ensureOptionalColumn(db, 'businesses', 'address_line_2', 'TEXT');
  await ensureOptionalColumn(db, 'businesses', 'address_city', 'TEXT');
  await ensureOptionalColumn(db, 'businesses', 'address_state', 'TEXT');
  await ensureOptionalColumn(db, 'businesses', 'address_postal_code', 'TEXT');
  await ensureOptionalColumn(db, 'businesses', 'address_country', 'TEXT');
  await ensureOptionalColumn(db, 'businesses', 'addon_temp_monitoring', 'INTEGER NOT NULL DEFAULT 0');
  await ensureOptionalColumn(db, 'businesses', 'addon_camera_monitoring', 'INTEGER NOT NULL DEFAULT 0');

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS business_users (
        business_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (business_id, user_id),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS business_invites (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        email TEXT NOT NULL,
        email_normalized TEXT NOT NULL,
        invite_code TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'staff',
        invited_by TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER,
        used_at INTEGER,
        used_by_user_id TEXT,
        revoked_at INTEGER,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_business_users_user
      ON business_users(user_id, business_id)
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_business_invites_email
      ON business_invites(email_normalized)
      `
    )
    .run();
}

export async function isBusinessOnboardingComplete(db: D1, businessId: string) {
  await ensureBusinessSchema(db);
  const row = await db
    .prepare(
      `
      SELECT onboarding_completed_at
      FROM businesses
      WHERE id = ?
      LIMIT 1
      `
    )
    .bind(businessId)
    .first<{ onboarding_completed_at: number | null }>();
  return Boolean(row?.onboarding_completed_at);
}

export async function getUserBusinessContext(db: D1, userId: string) {
  await ensureBusinessSchema(db);

  const membership = await db
    .prepare(
      `
      SELECT
        b.id AS business_id,
        b.name AS business_name,
        b.slug AS business_slug,
        b.plan_tier AS business_plan,
        b.sidebar_logo_url AS business_logo_url,
        bu.role AS business_role
      FROM business_users bu
      JOIN businesses b ON b.id = bu.business_id
      WHERE bu.user_id = ?
        AND COALESCE(b.status, 'active') = 'active'
      ORDER BY
        CASE bu.role
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          WHEN 'manager' THEN 2
          ELSE 3
        END ASC,
        b.created_at ASC
      LIMIT 1
      `
    )
    .bind(userId)
    .first<{
      business_id: string;
      business_name: string;
      business_slug: string;
      business_plan: string;
      business_logo_url: string | null;
      business_role: string;
    }>();

  if (!membership) return null;

  return {
    businessId: membership.business_id,
    businessName: membership.business_name,
    businessSlug: membership.business_slug,
    businessPlan: membership.business_plan,
    businessRole: membership.business_role,
    businessLogoUrl: membership.business_logo_url
  } satisfies BusinessContext;
}

export async function bootstrapBusinessForUser(
  db: D1,
  userId: string,
  userRole: string | null,
  displayHint?: string | null
) {
  await ensureBusinessSchema(db);

  const now = Math.floor(Date.now() / 1000);
  const baseName = `${displayHint?.trim() || 'My'} Workspace`;
  const slug = await reserveBusinessSlug(db, baseName);
  const businessId = crypto.randomUUID();
  const businessRole = userRole === 'admin' ? 'owner' : 'staff';

  await db
    .prepare(
      `
      INSERT INTO businesses (id, name, slug, plan_tier, status, created_at, updated_at)
      VALUES (?, ?, ?, 'starter', 'active', ?, ?)
      `
    )
    .bind(businessId, baseName, slug, now, now)
    .run();

  await db
    .prepare(
      `
      INSERT INTO business_users (business_id, user_id, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      `
    )
    .bind(businessId, userId, businessRole, now, now)
    .run();

  return {
    businessId,
    businessName: baseName,
    businessSlug: slug,
    businessPlan: 'starter',
    businessRole,
    businessLogoUrl: null
  } satisfies BusinessContext;
}
