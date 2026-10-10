import { dev } from '$app/environment';
import {
  ALL_BUSINESS_CAPABILITIES,
  defaultPermissionTemplateForRole,
  effectiveAppRoleFromBusinessRole,
  resolveBusinessCapabilities,
  type BusinessCapability,
  type BusinessCapabilityOverrides
} from '$lib/server/permissions';

type D1 = App.Platform['env']['DB'];

let businessSchemaEnsured = false;
let businessSchemaPromise: Promise<void> | null = null;

export type BusinessContext = {
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessPlan: string;
  businessRole: string;
  businessPermissionTemplate: string;
  businessPositionId: string | null;
  businessPositionName: string | null;
  businessCapabilityOverrides: BusinessCapabilityOverrides;
  businessCapabilities: BusinessCapability[];
  businessLogoUrl: string | null;
};

export type BusinessPosition = {
  id: string;
  business_id: string;
  name: string;
  description: string;
  account_type: 'manager' | 'staff' | 'external';
  base_template: string;
  is_active: number;
  sort_order: number;
  capability_overrides: BusinessCapabilityOverrides;
  effective_capabilities: BusinessCapability[];
};

export type BusinessMembershipSummary = Omit<
  BusinessContext,
  'businessCapabilityOverrides' | 'businessCapabilities'
>;

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
  if (!dev) {
    businessSchemaEnsured = true;
    return;
  }

  if (businessSchemaEnsured) return;
  if (businessSchemaPromise) {
    await businessSchemaPromise;
    return;
  }

  businessSchemaPromise = (async () => {
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

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS business_users (
        business_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (business_id, user_id),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
      `
    )
    .run();

  await ensureOptionalColumn(db, 'business_users', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
  await ensureOptionalColumn(db, 'business_users', 'permission_template', "TEXT NOT NULL DEFAULT 'staff'");
  await ensureOptionalColumn(db, 'business_users', 'position_id', 'TEXT');

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS business_positions (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        name TEXT NOT NULL COLLATE NOCASE,
        description TEXT NOT NULL DEFAULT '',
        account_type TEXT NOT NULL CHECK (account_type IN ('manager', 'staff', 'external')),
        base_template TEXT NOT NULL DEFAULT 'staff',
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (business_id, name),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS business_position_permissions (
        business_id TEXT NOT NULL,
        position_id TEXT NOT NULL,
        permission_key TEXT NOT NULL,
        is_enabled INTEGER NOT NULL DEFAULT 0,
        updated_by TEXT,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (business_id, position_id, permission_key),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (position_id) REFERENCES business_positions(id) ON DELETE CASCADE,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
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
        permission_template TEXT NOT NULL DEFAULT 'staff',
        employment_type TEXT NOT NULL DEFAULT 'employee',
        job_title TEXT NOT NULL DEFAULT '',
        department TEXT NOT NULL DEFAULT '',
        primary_schedule_department TEXT NOT NULL DEFAULT '',
        schedule_departments_json TEXT NOT NULL DEFAULT '[]',
        start_date TEXT NOT NULL DEFAULT '',
        pay_type TEXT NOT NULL DEFAULT '',
        manager_user_id TEXT,
        onboarding_required INTEGER NOT NULL DEFAULT 1,
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

  await ensureOptionalColumn(db, 'business_invites', 'permission_template', "TEXT NOT NULL DEFAULT 'staff'");
  await ensureOptionalColumn(db, 'business_invites', 'employment_type', "TEXT NOT NULL DEFAULT 'employee'");
  await ensureOptionalColumn(db, 'business_invites', 'job_title', "TEXT NOT NULL DEFAULT ''");
  await ensureOptionalColumn(db, 'business_invites', 'department', "TEXT NOT NULL DEFAULT ''");
  await ensureOptionalColumn(db, 'business_invites', 'primary_schedule_department', "TEXT NOT NULL DEFAULT ''");
  await ensureOptionalColumn(db, 'business_invites', 'schedule_departments_json', "TEXT NOT NULL DEFAULT '[]'");
  await ensureOptionalColumn(db, 'business_invites', 'start_date', "TEXT NOT NULL DEFAULT ''");
  await ensureOptionalColumn(db, 'business_invites', 'pay_type', "TEXT NOT NULL DEFAULT ''");
  await ensureOptionalColumn(db, 'business_invites', 'manager_user_id', 'TEXT');
  await ensureOptionalColumn(db, 'business_invites', 'onboarding_required', 'INTEGER NOT NULL DEFAULT 1');
  await ensureOptionalColumn(db, 'business_invites', 'position_id', 'TEXT');

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

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_business_invites_access_template
      ON business_invites(business_id, role, permission_template, created_at)
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_business_positions_business_active
      ON business_positions(business_id, is_active, sort_order, name)
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_business_position_permissions_business_position
      ON business_position_permissions(business_id, position_id, permission_key)
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_business_users_business_position
      ON business_users(business_id, position_id, is_active)
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_business_invites_business_position
      ON business_invites(business_id, position_id, created_at)
      `
    )
    .run();

  businessSchemaEnsured = true;
  })();

  await businessSchemaPromise;
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

function mapBusinessContextRow(row: {
  business_id: string;
  business_name: string;
  business_slug: string;
  business_plan: string;
  business_logo_url: string | null;
  business_role: string;
  permission_template?: string | null;
  position_id?: string | null;
  position_name?: string | null;
}) {
  return {
    businessId: row.business_id,
    businessName: row.business_name,
    businessSlug: row.business_slug,
    businessPlan: row.business_plan,
    businessRole: row.business_role,
    businessPermissionTemplate: row.permission_template ?? row.business_role,
    businessPositionId: row.position_id ?? null,
    businessPositionName: row.position_name ?? null,
    businessLogoUrl: row.business_logo_url
  } satisfies BusinessMembershipSummary;
}

export async function loadPositionCapabilityOverrides(
  db: D1,
  businessId: string,
  positionId: string | null | undefined
): Promise<BusinessCapabilityOverrides> {
  if (!positionId) return {};
  const rows = await db
    .prepare(
      `
      SELECT permission_key, is_enabled
      FROM business_position_permissions
      WHERE business_id = ? AND position_id = ?
      `
    )
    .bind(businessId, positionId)
    .all<{ permission_key: string; is_enabled: number }>();
  const validCapabilities = new Set<string>(ALL_BUSINESS_CAPABILITIES);
  const overrides: BusinessCapabilityOverrides = {};
  for (const row of rows.results ?? []) {
    if (!validCapabilities.has(row.permission_key)) continue;
    overrides[row.permission_key as BusinessCapability] = row.is_enabled === 1;
  }
  return overrides;
}

export async function loadBusinessPositions(
  db: D1,
  businessId: string,
  includeInactive = false
): Promise<BusinessPosition[]> {
  await ensureBusinessSchema(db);
  const [positionRows, permissionRows] = await Promise.all([
    db
      .prepare(
        `
        SELECT id, business_id, name, description, account_type, base_template,
          is_active, sort_order
        FROM business_positions
        WHERE business_id = ? ${includeInactive ? '' : 'AND is_active = 1'}
        ORDER BY is_active DESC, sort_order ASC, name ASC
        `
      )
      .bind(businessId)
      .all<Omit<BusinessPosition, 'capability_overrides' | 'effective_capabilities'>>(),
    db
      .prepare(
        `
        SELECT position_id, permission_key, is_enabled
        FROM business_position_permissions
        WHERE business_id = ?
        `
      )
      .bind(businessId)
      .all<{ position_id: string; permission_key: string; is_enabled: number }>()
  ]);
  const validCapabilities = new Set<string>(ALL_BUSINESS_CAPABILITIES);
  const overridesByPosition = new Map<string, BusinessCapabilityOverrides>();
  for (const row of permissionRows.results ?? []) {
    if (!validCapabilities.has(row.permission_key)) continue;
    const overrides = overridesByPosition.get(row.position_id) ?? {};
    overrides[row.permission_key as BusinessCapability] = row.is_enabled === 1;
    overridesByPosition.set(row.position_id, overrides);
  }
  return (positionRows.results ?? []).map((position) => {
    const capabilityOverrides = overridesByPosition.get(position.id) ?? {};
    return {
      ...position,
      capability_overrides: capabilityOverrides,
      effective_capabilities: resolveBusinessCapabilities(
        position.account_type,
        position.base_template,
        {},
        capabilityOverrides
      )
    };
  });
}

export async function ensureDefaultBusinessPositions(
  db: D1,
  businessId: string,
  actorUserId: string | null = null
) {
  await ensureBusinessSchema(db);
  const now = Math.floor(Date.now() / 1000);
  const defaults = [
    { name: 'Team Member', accountType: 'staff', sortOrder: 10 },
    { name: 'Manager', accountType: 'manager', sortOrder: 20 },
    { name: 'External', accountType: 'external', sortOrder: 30 }
  ] as const;
  await db.batch(
    defaults.map((position) =>
      db
        .prepare(
          `
          INSERT OR IGNORE INTO business_positions (
            id, business_id, name, description, account_type, base_template,
            is_active, sort_order, created_by, created_at, updated_at
          )
          VALUES (?, ?, ?, '', ?, ?, 1, ?, ?, ?, ?)
          `
        )
        .bind(
          crypto.randomUUID(),
          businessId,
          position.name,
          position.accountType,
          defaultPermissionTemplateForRole(position.accountType),
          position.sortOrder,
          actorUserId,
          now,
          now
        )
    )
  );
}

export async function loadBusinessCapabilityOverrides(
  db: D1,
  businessId: string,
  userId: string
): Promise<BusinessCapabilityOverrides> {
  const rows = await db
    .prepare(
      `
      SELECT permission_key, is_enabled
      FROM employee_role_permissions
      WHERE business_id = ?
        AND user_id = ?
      `
    )
    .bind(businessId, userId)
    .all<{ permission_key: string; is_enabled: number }>()
    .catch(() => ({ results: [] as Array<{ permission_key: string; is_enabled: number }> }));

  const validCapabilities = new Set<string>(ALL_BUSINESS_CAPABILITIES);
  const overrides: BusinessCapabilityOverrides = {};
  for (const row of rows.results ?? []) {
    if (!validCapabilities.has(row.permission_key)) continue;
    overrides[row.permission_key as BusinessCapability] = row.is_enabled === 1;
  }
  return overrides;
}

async function attachBusinessCapabilities(
  db: D1,
  userId: string,
  context: BusinessMembershipSummary
): Promise<BusinessContext> {
  const [businessCapabilityOverrides, positionCapabilityOverrides] = await Promise.all([
    loadBusinessCapabilityOverrides(db, context.businessId, userId),
    loadPositionCapabilityOverrides(db, context.businessId, context.businessPositionId)
  ]);
  return {
    ...context,
    businessCapabilityOverrides,
    businessCapabilities: resolveBusinessCapabilities(
      context.businessRole,
      context.businessPermissionTemplate,
      businessCapabilityOverrides,
      positionCapabilityOverrides
    )
  };
}

export async function getUserBusinessContext(db: D1, userId: string, preferredBusinessId?: string | null) {
  await ensureBusinessSchema(db);

  const selectedBusinessId = preferredBusinessId?.trim();
  if (selectedBusinessId) {
    const selectedMembership = await db
      .prepare(
        `
        SELECT
          b.id AS business_id,
          b.name AS business_name,
          b.slug AS business_slug,
          b.plan_tier AS business_plan,
          b.sidebar_logo_url AS business_logo_url,
          bu.role AS business_role,
          COALESCE(bp.base_template, bu.permission_template, bu.role, 'staff') AS permission_template,
          bp.id AS position_id,
          bp.name AS position_name
        FROM business_users bu
        JOIN businesses b ON b.id = bu.business_id
        LEFT JOIN business_positions bp ON bp.id = bu.position_id AND bp.business_id = bu.business_id
        WHERE bu.user_id = ?
          AND bu.business_id = ?
          AND COALESCE(bu.is_active, 1) = 1
          AND COALESCE(b.status, 'active') IN ('active', 'trialing', 'past_due', 'pending_payment')
        LIMIT 1
        `
      )
      .bind(userId, selectedBusinessId)
      .first<{
        business_id: string;
        business_name: string;
        business_slug: string;
        business_plan: string;
        business_logo_url: string | null;
        business_role: string;
        permission_template: string;
        position_id: string | null;
        position_name: string | null;
      }>();

    if (selectedMembership) {
      return attachBusinessCapabilities(db, userId, mapBusinessContextRow(selectedMembership));
    }
  }

  const membership = await db
    .prepare(
      `
      SELECT
        b.id AS business_id,
        b.name AS business_name,
        b.slug AS business_slug,
        b.plan_tier AS business_plan,
        b.sidebar_logo_url AS business_logo_url,
        bu.role AS business_role,
        COALESCE(bp.base_template, bu.permission_template, bu.role, 'staff') AS permission_template,
        bp.id AS position_id,
        bp.name AS position_name
      FROM business_users bu
      JOIN businesses b ON b.id = bu.business_id
      LEFT JOIN business_positions bp ON bp.id = bu.position_id AND bp.business_id = bu.business_id
      WHERE bu.user_id = ?
        AND COALESCE(bu.is_active, 1) = 1
        AND COALESCE(b.status, 'active') IN ('active', 'trialing', 'past_due', 'pending_payment')
      ORDER BY
        CASE bu.role
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          WHEN 'general_manager' THEN 2
          WHEN 'manager' THEN 2
          WHEN 'foh_manager' THEN 3
          WHEN 'boh_manager' THEN 3
          WHEN 'hourly_manager' THEN 4
          ELSE 5
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
      permission_template: string;
      position_id: string | null;
      position_name: string | null;
      }>();

  if (!membership) return null;

  return attachBusinessCapabilities(db, userId, mapBusinessContextRow(membership));
}

export async function loadUserBusinessMemberships(db: D1, userId: string) {
  await ensureBusinessSchema(db);

  const rows = await db
    .prepare(
      `
      SELECT
        b.id AS business_id,
        b.name AS business_name,
        b.slug AS business_slug,
        b.plan_tier AS business_plan,
        b.sidebar_logo_url AS business_logo_url,
        bu.role AS business_role,
        COALESCE(bp.base_template, bu.permission_template, bu.role, 'staff') AS permission_template,
        bp.id AS position_id,
        bp.name AS position_name
      FROM business_users bu
      JOIN businesses b ON b.id = bu.business_id
      LEFT JOIN business_positions bp ON bp.id = bu.position_id AND bp.business_id = bu.business_id
      WHERE bu.user_id = ?
        AND COALESCE(bu.is_active, 1) = 1
        AND COALESCE(b.status, 'active') IN ('active', 'trialing', 'past_due', 'pending_payment')
      ORDER BY
        CASE bu.role
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          WHEN 'general_manager' THEN 2
          WHEN 'manager' THEN 2
          WHEN 'foh_manager' THEN 3
          WHEN 'boh_manager' THEN 3
          WHEN 'hourly_manager' THEN 4
          ELSE 5
        END ASC,
        b.created_at ASC
      `
    )
    .bind(userId)
    .all<{
      business_id: string;
      business_name: string;
      business_slug: string;
      business_plan: string;
      business_logo_url: string | null;
      business_role: string;
      permission_template: string;
      position_id: string | null;
      position_name: string | null;
      }>();

  return (rows.results ?? []).map(mapBusinessContextRow) satisfies BusinessMembershipSummary[];
}

export async function syncUserAppRoleFromMemberships(db: D1, userId: string) {
  await ensureBusinessSchema(db);
  const memberships = await db
    .prepare(
      `
      SELECT bu.business_id, bu.role,
        COALESCE(bp.base_template, bu.permission_template, bu.role, 'staff') AS permission_template,
        bp.id AS position_id
      FROM business_users bu
      LEFT JOIN business_positions bp ON bp.id = bu.position_id AND bp.business_id = bu.business_id
      WHERE bu.user_id = ? AND COALESCE(bu.is_active, 1) = 1
      `
    )
    .bind(userId)
    .all<{
      business_id: string;
      role: string;
      permission_template: string;
      position_id: string | null;
    }>();

  let appRole: 'admin' | 'user' = 'user';
  for (const membership of memberships.results ?? []) {
    const [individualOverrides, positionOverrides] = await Promise.all([
      loadBusinessCapabilityOverrides(db, membership.business_id, userId),
      loadPositionCapabilityOverrides(db, membership.business_id, membership.position_id)
    ]);
    const capabilities = resolveBusinessCapabilities(
      membership.role,
      membership.permission_template,
      individualOverrides,
      positionOverrides
    );
    if (
      effectiveAppRoleFromBusinessRole(
        membership.role,
        membership.permission_template,
        capabilities
      ) === 'admin'
    ) {
      appRole = 'admin';
      break;
    }
  }
  await db.prepare(`UPDATE users SET role = ? WHERE id = ?`).bind(appRole, userId).run();
  return appRole;
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
      INSERT INTO business_users (business_id, user_id, role, permission_template, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .bind(businessId, userId, businessRole, businessRole, now, now)
    .run();

  await ensureDefaultBusinessPositions(db, businessId, userId);

  return {
    businessId,
    businessName: baseName,
    businessSlug: slug,
    businessPlan: 'starter',
    businessRole,
    businessPermissionTemplate: businessRole,
    businessPositionId: null,
    businessPositionName: null,
    businessCapabilityOverrides: {},
    businessCapabilities: resolveBusinessCapabilities(businessRole, businessRole),
    businessLogoUrl: null
  } satisfies BusinessContext;
}
