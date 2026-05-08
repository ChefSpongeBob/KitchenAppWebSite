import { fail, redirect } from '@sveltejs/kit';
import {
  ensureAnnouncementsSchema,
  getHomepageAnnouncementId,
  loadHomepageAnnouncement
} from '$lib/server/announcements';
import { ensureDailySpecialsSchema } from '$lib/server/dailySpecials';
import {
  ensureEmployeeSpotlightSchema,
  getEmployeeSpotlightId,
  loadEmployeeSpotlight
} from '$lib/server/employeeSpotlight';
import { normalizeRecipeCategory } from '$lib/assets/recipeCategories';
import {
  ensureScheduleSchema,
  loadScheduleDepartmentApprovalsByUser,
  loadScheduleDepartments
} from '$lib/server/schedules';
import {
  isValidScheduleDepartment,
  type ScheduleDepartment
} from '$lib/assets/schedule';
import { isEmailConfigured, sendApprovalEmail, sendInviteEmail } from '$lib/server/email';
import { ensureBusinessSchema } from '$lib/server/business';
import { ensureTenantSchema, requireBusinessId } from '$lib/server/tenant';
import {
  checkRateLimit,
  rateLimitFailure,
  revokeUserSessions,
  writeAuditLog
} from '$lib/server/security';

type D1 = App.Platform['env']['DB'];

export type AdminSectionRow = {
  section_id: string;
  domain: 'preplists' | 'inventory' | 'orders';
  slug: string;
  title: string;
  description: string | null;
  item_id: string | null;
  content: string | null;
  details: string | null;
  amount: number | null;
  par_count: number | null;
  is_checked: number | null;
  sort_order: number | null;
};

export type AdminSectionItem = {
  id: string;
  content: string;
  details: string;
  amount: number;
  par_count: number;
  is_checked: number;
  sort_order: number;
};

export type AdminSectionGroup = {
  id: string;
  domain: 'preplists' | 'inventory' | 'orders';
  slug: string;
  title: string;
  description: string;
  items: AdminSectionItem[];
};

export type AdminChecklistItem = {
  id: string;
  content: string;
  amount: number;
  par_count: number;
  is_checked: number;
  sort_order: number;
};

export type AdminChecklistGroup = {
  id: string;
  slug: string;
  title: string;
  items: AdminChecklistItem[];
};

export type AdminNodeName = {
  sensor_id: number;
  name: string;
};

export type AdminWhiteboardIdea = {
  id: string;
  content: string;
  votes: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: number;
  submitted_name: string | null;
  submitted_email: string | null;
};

export type AdminDocument = {
  id: string;
  slug: string;
  title: string;
  section: string;
  category: string;
  content: string | null;
  file_url: string | null;
  is_active: number;
};

export type AdminTodo = {
  id: string;
  title: string;
  description: string;
  completed_at: number | null;
  created_at: number;
  assigned_to: string | null;
  assigned_name: string | null;
  assigned_email: string | null;
};

export type AdminUser = {
  id: string;
  display_name: string | null;
  email: string;
  role: string;
  is_active: number;
  can_manage_specials: number;
  approved_departments: ScheduleDepartment[];
};

export type AdminInvite = {
  id: string;
  email: string;
  invite_code: string;
  created_at: number;
  expires_at: number | null;
  used_at: number | null;
  revoked_at: number | null;
};

export type AdminEmailStatus = {
  emailConfigured: boolean;
};

type EmailEnv = Partial<App.Platform['env']>;

export type AdminAssignableUser = {
  id: string;
  display_name: string | null;
  email: string;
};

export type AdminEmployeeProfile = {
  user_id: string;
  real_name: string;
  phone: string;
  birthday: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
};

export type EmployeeProfileEditRequest = {
  id: string;
  user_id: string;
  requested_real_name: string;
  requested_birthday: string;
  status: 'pending' | 'approved' | 'declined';
  manager_note: string;
  requested_at: number;
  resolved_at: number | null;
  resolved_by: string | null;
};

export type EmployeeOnboardingPackage = {
  id: string;
  business_id: string;
  user_id: string;
  status: 'sent' | 'in_progress' | 'submitted' | 'approved';
  payroll_classification: 'employee' | 'contractor';
  sent_at: number;
  completed_at: number | null;
  approved_at: number | null;
  approved_by: string | null;
  created_by: string | null;
  updated_at: number;
  manager_note: string;
};

export type EmployeeOnboardingItem = {
  id: string;
  package_id: string;
  business_id: string;
  user_id: string;
  item_type: 'form' | 'document' | 'acknowledgement';
  form_key: string;
  title: string;
  description: string;
  status: 'pending' | 'submitted' | 'approved' | 'needs_changes';
  file_url: string;
  file_name: string;
  form_payload: string;
  source_file_url: string;
  source_file_name: string;
  signed_name: string;
  manager_note: string;
  sort_order: number;
  created_at: number;
  submitted_at: number | null;
  reviewed_at: number | null;
  reviewed_by: string | null;
};

export type EmployeeOnboardingState = {
  package: EmployeeOnboardingPackage | null;
  items: EmployeeOnboardingItem[];
};

export type EmployeeOnboardingTemplateItem = {
  id: string;
  business_id: string;
  item_type: EmployeeOnboardingItem['item_type'];
  form_key: string;
  title: string;
  description: string;
  source_file_url: string;
  source_file_name: string;
  sort_order: number;
  is_active: number;
  created_at: number;
  updated_at: number;
  created_by: string | null;
};

export type AdminOnboardingDashboardRow = {
  user_id: string;
  display_name: string | null;
  email: string;
  role: string;
  is_active: number;
  package_id: string | null;
  package_status: EmployeeOnboardingPackage['status'] | 'not_sent';
  payroll_classification: EmployeeOnboardingPackage['payroll_classification'] | null;
  sent_at: number | null;
  completed_at: number | null;
  approved_at: number | null;
  updated_at: number | null;
  total_items: number;
  pending_items: number;
  submitted_items: number;
  approved_items: number;
  needs_changes_items: number;
};

export type AdminCreatorCatalog = {
  preplists: string[];
  inventory: string[];
  orders: string[];
  recipes: string[];
  documents: string[];
};

export function requireAdmin(role: string | undefined | null) {
  if (role !== 'admin') {
    throw redirect(303, '/app');
  }
}

async function userBelongsToBusiness(db: D1, userId: string, businessId: string) {
  await ensureBusinessSchema(db);
  const row = await db
    .prepare(
      `
      SELECT user_id
      FROM business_users
      WHERE business_id = ?
        AND user_id = ?
      LIMIT 1
      `
    )
    .bind(businessId, userId)
    .first<{ user_id: string }>();
  return Boolean(row?.user_id);
}

async function activeBusinessUserCount(db: D1, businessId: string, adminOnly = false) {
  await ensureBusinessSchema(db);
  const row = await db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM business_users
      WHERE business_id = ?
        AND COALESCE(is_active, 1) = 1
        ${adminOnly ? "AND role IN ('owner', 'admin', 'manager')" : ''}
      `
    )
    .bind(businessId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function documentMediaKeyFromUrl(fileUrl: string) {
  const prefix = '/api/documents/media/';
  if (!fileUrl.startsWith(prefix)) return null;
  const encoded = fileUrl.slice(prefix.length).trim();
  if (!encoded) return null;
  return encoded
    .split('/')
    .map((part) => decodeURIComponent(part))
    .join('/');
}

function extensionFromFilename(name: string) {
  const trimmed = name.trim();
  const dotIndex = trimmed.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex >= trimmed.length - 1) return '';
  return trimmed.slice(dotIndex + 1).toLowerCase();
}

function extensionFromContentType(contentType: string) {
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  if (contentType === 'image/svg+xml') return 'svg';
  return '';
}

function isAllowedDocumentUpload(contentType: string, extension: string) {
  if (contentType === 'application/pdf') return true;
  if (contentType.startsWith('image/')) return true;
  return ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(extension);
}

async function uploadDocumentMedia(
  bucket: NonNullable<App.Locals['MEDIA_BUCKET']>,
  businessId: string,
  slug: string,
  file: File
) {
  const contentType = file.type || 'application/octet-stream';
  const filenameExtension = extensionFromFilename(file.name);
  const typeExtension = extensionFromContentType(contentType);
  const extension = filenameExtension || typeExtension || 'bin';
  const normalizedSlug = normalizeSlug(slug) || 'document';
  const key = `businesses/${businessId}/documents/${normalizedSlug}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const body = await file.arrayBuffer();

  await bucket.put(key, body, {
    httpMetadata: {
      contentType,
      cacheControl: 'private, max-age=0'
    }
  });

  const encodedKey = key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

  return {
    key,
    url: `/api/documents/media/${encodedKey}`
  };
}

async function uploadEmployeeOnboardingMedia(
  bucket: NonNullable<App.Locals['MEDIA_BUCKET']>,
  businessId: string,
  userId: string,
  file: File
) {
  const contentType = file.type || 'application/octet-stream';
  const filenameExtension = extensionFromFilename(file.name);
  const typeExtension = extensionFromContentType(contentType);
  const extension = filenameExtension || typeExtension || 'bin';

  if (!isAllowedDocumentUpload(contentType, extension)) {
    throw new Error('Unsupported onboarding document type.');
  }

  const normalizedUserId = normalizeSlug(userId) || 'employee';
  const key = `businesses/${businessId}/employee-onboarding/${normalizedUserId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const body = await file.arrayBuffer();

  await bucket.put(key, body, {
    httpMetadata: {
      contentType,
      cacheControl: 'private, max-age=0'
    }
  });

  const encodedKey = key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

  return {
    key,
    url: `/api/documents/media/${encodedKey}`
  };
}

export async function tableExists(db: D1, tableName: string) {
  const table = await db
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
  return Boolean(table);
}

export async function usersHasIsActiveColumn(db: D1) {
  const columns = await db.prepare(`PRAGMA table_info(users)`).all<{ name: string }>();
  return (columns.results ?? []).some((column) => column.name === 'is_active');
}

async function ensureOptionalColumn(db: D1, tableName: string, columnName: string, definition: string) {
  const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string }>();
  const hasColumn = (columns.results ?? []).some((column) => column.name === columnName);
  if (hasColumn) return;

  await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
}

async function ensureCreatorCategoryRegistry(db: D1) {
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS creator_category_registry (
        id TEXT PRIMARY KEY,
        business_id TEXT,
        editor_type TEXT NOT NULL,
        category TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `
    )
    .run();

  await ensureOptionalColumn(db, 'creator_category_registry', 'business_id', 'TEXT');
  await db.prepare(`DROP INDEX IF EXISTS idx_creator_category_registry_unique`).run();
  await db
    .prepare(
      `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_category_registry_business_unique
      ON creator_category_registry(business_id, editor_type, category)
      `
    )
    .run();
}

export async function ensureEmployeeProfilesTable(db: D1) {
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS employee_profiles (
        business_id TEXT NOT NULL DEFAULT '',
        user_id TEXT NOT NULL,
        real_name TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        birthday TEXT NOT NULL DEFAULT '',
        address_line_1 TEXT NOT NULL DEFAULT '',
        address_line_2 TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL DEFAULT '',
        postal_code TEXT NOT NULL DEFAULT '',
        emergency_contact_name TEXT NOT NULL DEFAULT '',
        emergency_contact_phone TEXT NOT NULL DEFAULT '',
        emergency_contact_relationship TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        updated_by TEXT,
        PRIMARY KEY (business_id, user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  await ensureOptionalColumn(db, 'employee_profiles', 'business_id', "TEXT NOT NULL DEFAULT ''");
  await ensureOptionalColumn(db, 'employee_profiles', 'real_name', "TEXT NOT NULL DEFAULT ''");
  await db
    .prepare(
      `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_profiles_business_user
      ON employee_profiles(business_id, user_id)
      `
    )
    .run();
}

export async function ensureEmployeeProfileEditRequestsTable(db: D1) {
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS employee_profile_edit_requests (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL DEFAULT '',
        user_id TEXT NOT NULL,
        requested_real_name TEXT NOT NULL DEFAULT '',
        requested_birthday TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        manager_note TEXT NOT NULL DEFAULT '',
        requested_at INTEGER NOT NULL,
        resolved_at INTEGER,
        resolved_by TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  await ensureOptionalColumn(db, 'employee_profile_edit_requests', 'business_id', "TEXT NOT NULL DEFAULT ''");
  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_employee_profile_edit_requests_business
      ON employee_profile_edit_requests(business_id, status, requested_at)
      `
    )
    .run();
}

export async function ensureEmployeeOnboardingTables(db: D1) {
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS employee_onboarding_packages (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL DEFAULT '',
        user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'sent',
        payroll_classification TEXT NOT NULL DEFAULT 'employee',
        sent_at INTEGER NOT NULL,
        completed_at INTEGER,
        approved_at INTEGER,
        approved_by TEXT,
        created_by TEXT,
        updated_at INTEGER NOT NULL,
        manager_note TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_employee_onboarding_packages_user
      ON employee_onboarding_packages(business_id, user_id, status, updated_at)
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS employee_onboarding_items (
        id TEXT PRIMARY KEY,
        package_id TEXT NOT NULL,
        business_id TEXT NOT NULL DEFAULT '',
        user_id TEXT NOT NULL,
        item_type TEXT NOT NULL DEFAULT 'acknowledgement',
        form_key TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        file_url TEXT NOT NULL DEFAULT '',
        file_name TEXT NOT NULL DEFAULT '',
        form_payload TEXT NOT NULL DEFAULT '',
        signed_name TEXT NOT NULL DEFAULT '',
        manager_note TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        submitted_at INTEGER,
        reviewed_at INTEGER,
        reviewed_by TEXT,
        FOREIGN KEY (package_id) REFERENCES employee_onboarding_packages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  await ensureOptionalColumn(db, 'employee_onboarding_items', 'source_file_url', "TEXT NOT NULL DEFAULT ''");
  await ensureOptionalColumn(db, 'employee_onboarding_items', 'source_file_name', "TEXT NOT NULL DEFAULT ''");
  await ensureOptionalColumn(db, 'employee_onboarding_items', 'form_key', "TEXT NOT NULL DEFAULT ''");
  await ensureOptionalColumn(db, 'employee_onboarding_items', 'form_payload', "TEXT NOT NULL DEFAULT ''");

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_employee_onboarding_items_package
      ON employee_onboarding_items(package_id, sort_order, status)
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS employee_onboarding_template_items (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL DEFAULT '',
        item_type TEXT NOT NULL DEFAULT 'acknowledgement',
        form_key TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        source_file_url TEXT NOT NULL DEFAULT '',
        source_file_name TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        created_by TEXT,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_employee_onboarding_template_business
      ON employee_onboarding_template_items(business_id, is_active, sort_order)
      `
    )
    .run();

  await ensureOptionalColumn(db, 'employee_onboarding_template_items', 'form_key', "TEXT NOT NULL DEFAULT ''");
}

function emptyEmployeeProfile(userId: string): AdminEmployeeProfile {
  return {
    user_id: userId,
    real_name: '',
    phone: '',
    birthday: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: ''
  };
}

export async function ensureUserInvitesTable(db: D1) {
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS user_invites (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        email_normalized TEXT NOT NULL,
        invite_code TEXT NOT NULL UNIQUE,
        invited_by TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER,
        used_at INTEGER,
        used_by_user_id TEXT,
        revoked_at INTEGER,
        FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_user_invites_email_normalized
      ON user_invites(email_normalized)
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_user_invites_active
      ON user_invites(email_normalized, revoked_at, used_at, expires_at)
      `
    )
    .run();
}

function generateInviteCode() {
  return `INV-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

export async function loadAdminSections(db: D1, businessId: string) {
  await ensureTenantSchema(db);
  const columns = await db.prepare(`PRAGMA table_info(list_items)`).all<{ name: string }>();
  const detailsEnabled = (columns.results ?? []).some((column) => column.name === 'details');
  const sectionRows = await db
    .prepare(
      `
      SELECT
        s.id AS section_id,
        s.domain,
        s.slug,
        s.title,
        s.description,
        i.id AS item_id,
        i.content,
        ${detailsEnabled ? 'i.details,' : "'' AS details,"}
        i.amount,
        i.par_count,
        i.is_checked,
        i.sort_order
      FROM list_sections s
      LEFT JOIN list_items i ON i.section_id = s.id
      WHERE s.domain IN ('preplists', 'inventory', 'orders')
        AND s.business_id = ?
      ORDER BY s.domain ASC, s.slug ASC, i.sort_order ASC, i.created_at ASC
      `
    )
    .bind(businessId)
    .all<AdminSectionRow>();

  const grouped = new Map<string, AdminSectionGroup>();
  for (const row of sectionRows.results ?? []) {
    if (!grouped.has(row.section_id)) {
      grouped.set(row.section_id, {
        id: row.section_id,
        domain: row.domain,
        slug: row.slug,
        title: row.title,
        description: row.description ?? '',
        items: []
      });
    }

    if (row.item_id) {
      grouped.get(row.section_id)?.items.push({
        id: row.item_id,
        content: row.content ?? '',
        details: row.details ?? '',
        amount: row.amount ?? 0,
        par_count: row.par_count ?? 0,
        is_checked: row.is_checked ?? 0,
        sort_order: row.sort_order ?? 0
      });
    }
  }

  const sections = Array.from(grouped.values());
  return {
    preplists: sections.filter((section) => section.domain === 'preplists'),
    inventory: sections.filter((section) => section.domain === 'inventory'),
    orders: sections.filter((section) => section.domain === 'orders')
  };
}

export async function loadAdminChecklists(db: D1, businessId: string) {
  if (!(await tableExists(db, 'checklist_sections')) || !(await tableExists(db, 'checklist_items'))) {
    return [];
  }
  await ensureTenantSchema(db);

  const rows = await db
    .prepare(
      `
      SELECT
        s.id AS section_id,
        s.slug,
        s.title,
        i.id AS item_id,
        i.content,
        i.is_checked,
        i.sort_order
      FROM checklist_sections s
      LEFT JOIN checklist_items i ON i.section_id = s.id
      WHERE s.business_id = ?
      ORDER BY s.slug ASC, i.sort_order ASC, i.created_at ASC
      `
    )
    .bind(businessId)
    .all<{
      section_id: string;
      slug: string;
      title: string;
      item_id: string | null;
      content: string | null;
      is_checked: number | null;
      sort_order: number | null;
    }>();

  const grouped = new Map<string, AdminChecklistGroup>();
  for (const row of rows.results ?? []) {
    if (!grouped.has(row.section_id)) {
      grouped.set(row.section_id, {
        id: row.section_id,
        slug: row.slug,
        title: row.title,
        items: []
      });
    }

    if (row.item_id) {
      grouped.get(row.section_id)?.items.push({
        id: row.item_id,
        content: row.content ?? '',
        amount: 0,
        par_count: 0,
        is_checked: row.is_checked ?? 0,
        sort_order: row.sort_order ?? 0
      });
    }
  }

  return Array.from(grouped.values());
}

export async function loadAdminRecipes(db: D1, businessId: string) {
  await ensureTenantSchema(db);
  const recipes = await db
    .prepare(
      `
      SELECT id, title, category, ingredients, instructions, created_at
      FROM recipes
      WHERE business_id = ?
      ORDER BY created_at DESC
      `
    )
    .bind(businessId)
    .all();
  return recipes.results ?? [];
}

export async function loadAdminCreatorCatalog(db: D1, businessId: string): Promise<AdminCreatorCatalog> {
  await ensureTenantSchema(db);
  const preplists = new Set<string>();
  const inventory = new Set<string>();
  const orders = new Set<string>();
  const recipes = new Set<string>();
  const documents = new Set<string>();

  try {
    const listRows = await db
      .prepare(
        `
        SELECT domain, title
        FROM list_sections
        WHERE domain IN ('preplists', 'inventory', 'orders')
          AND business_id = ?
        ORDER BY title ASC
        `
      )
      .bind(businessId)
      .all<{ domain: 'preplists' | 'inventory' | 'orders'; title: string }>();

    for (const row of listRows.results ?? []) {
      const title = String(row.title ?? '').trim();
      if (!title) continue;
      if (row.domain === 'preplists') preplists.add(title);
      if (row.domain === 'inventory') inventory.add(title);
      if (row.domain === 'orders') orders.add(title);
    }
  } catch {
    // Leave empty when list tables are unavailable.
  }

  try {
    const recipeRows = await db
      .prepare(
        `
        SELECT DISTINCT category
        FROM recipes
        WHERE TRIM(COALESCE(category, '')) != ''
          AND business_id = ?
        ORDER BY category ASC
        `
      )
      .bind(businessId)
      .all<{ category: string }>();
    for (const row of recipeRows.results ?? []) {
      const category = String(row.category ?? '').trim();
      if (category) recipes.add(category);
    }
  } catch {
    // Leave empty when recipe table is unavailable.
  }

  try {
    await ensureCreatorCategoryRegistry(db);
    const registryRows = await db
      .prepare(
        `
        SELECT editor_type, category
        FROM creator_category_registry
        WHERE business_id = ?
        ORDER BY category ASC
        `
      )
      .bind(businessId)
      .all<{ editor_type: string; category: string }>();

    for (const row of registryRows.results ?? []) {
      const category = String(row.category ?? '').trim();
      if (!category) continue;
      if (row.editor_type === 'recipe') recipes.add(category);
      if (row.editor_type === 'document') documents.add(category);
    }
  } catch {
    // Leave empty when registry table is unavailable.
  }

  return {
    preplists: Array.from(preplists.values()),
    inventory: Array.from(inventory.values()),
    orders: Array.from(orders.values()),
    recipes: Array.from(recipes.values()),
    documents: Array.from(documents.values())
  };
}

export async function loadAdminTodos(db: D1, businessId: string) {
  await ensureTenantSchema(db);
  const todos = await db
    .prepare(
      `
      SELECT
        t.id,
        t.title,
        t.description,
        t.completed_at,
        t.created_at,
        ta.user_id AS assigned_to,
        u.display_name AS assigned_name,
        u.email AS assigned_email
      FROM todos t
      LEFT JOIN todo_assignments ta ON ta.todo_id = t.id
      LEFT JOIN users u ON u.id = ta.user_id
      WHERE t.business_id = ?
      ORDER BY t.created_at DESC
      `
    )
    .bind(businessId)
    .all<AdminTodo>();
  return todos.results ?? [];
}

export async function loadAdminUsers(db: D1, businessId: string) {
  await ensureBusinessSchema(db);
  await ensureDailySpecialsSchema(db);
  await ensureScheduleSchema(db);
  await ensureTenantSchema(db, true);

  const hasIsActive = await usersHasIsActiveColumn(db);
  const result = hasIsActive
    ? await db
        .prepare(
          `
          SELECT
            u.id,
            u.display_name,
            u.email,
            COALESCE(bu.role, 'staff') AS role,
            CASE WHEN COALESCE(u.is_active, 1) = 1 AND COALESCE(bu.is_active, 1) = 1 THEN 1 ELSE 0 END AS is_active,
            CASE WHEN dse.user_id IS NULL THEN 0 ELSE 1 END AS can_manage_specials
          FROM business_users bu
          JOIN users u ON u.id = bu.user_id
          LEFT JOIN daily_specials_editors dse ON dse.user_id = u.id AND COALESCE(dse.business_id, ?) = ?
          WHERE bu.business_id = ?
          ORDER BY COALESCE(u.display_name, u.email) ASC
          `
        )
        .bind(businessId, businessId, businessId)
        .all<AdminUser>()
    : await db
        .prepare(
          `
          SELECT
            u.id,
            u.display_name,
            u.email,
            COALESCE(bu.role, 'staff') AS role,
            COALESCE(bu.is_active, 1) AS is_active,
            CASE WHEN dse.user_id IS NULL THEN 0 ELSE 1 END AS can_manage_specials
          FROM business_users bu
          JOIN users u ON u.id = bu.user_id
          LEFT JOIN daily_specials_editors dse ON dse.user_id = u.id AND COALESCE(dse.business_id, ?) = ?
          WHERE bu.business_id = ?
          ORDER BY COALESCE(u.display_name, u.email) ASC
          `
        )
        .bind(businessId, businessId, businessId)
        .all<AdminUser>();

  const users = result.results ?? [];
  const approvalsByUser = await loadScheduleDepartmentApprovalsByUser(
    db,
    users.map((user) => user.id),
    businessId
  );

  return users.map((user) => ({
    ...user,
    approved_departments: approvalsByUser.get(user.id) ?? []
  }));
}

export async function loadAdminInvites(db: D1, businessId: string) {
  await ensureBusinessSchema(db);

  const invites = await db
    .prepare(
      `
      SELECT id, email, invite_code, created_at, expires_at, used_at, revoked_at
      FROM business_invites
      WHERE business_id = ?
      ORDER BY
        CASE
          WHEN revoked_at IS NULL AND used_at IS NULL THEN 0
          WHEN used_at IS NOT NULL THEN 1
          ELSE 2
        END ASC,
        created_at DESC
      `
    )
    .bind(businessId)
    .all<AdminInvite>();

  return invites.results ?? [];
}

export function getAdminEmailStatus(env?: EmailEnv | null): AdminEmailStatus {
  return {
    emailConfigured: isEmailConfigured(env)
  };
}

export async function loadAdminAssignableUsers(db: D1, businessId: string) {
  await ensureBusinessSchema(db);
  const hasIsActive = await usersHasIsActiveColumn(db);
  const users = hasIsActive
    ? await db
        .prepare(
          `
          SELECT
            u.id,
            display_name,
            email
          FROM users u
          JOIN business_users bu ON bu.user_id = u.id
          WHERE bu.business_id = ?
            AND COALESCE(bu.is_active, 1) = 1
            AND COALESCE(u.is_active, 1) = 1
          ORDER BY COALESCE(display_name, email) ASC
          `
        )
        .bind(businessId)
        .all<AdminAssignableUser>()
    : await db
        .prepare(
          `
          SELECT
            u.id,
            display_name,
            email
          FROM users u
          JOIN business_users bu ON bu.user_id = u.id
          WHERE bu.business_id = ?
            AND COALESCE(bu.is_active, 1) = 1
          ORDER BY COALESCE(display_name, email) ASC
          `
        )
        .bind(businessId)
        .all<AdminAssignableUser>();

  return users.results ?? [];
}

export async function loadAdminEmployeeProfile(db: D1, userId: string, businessId = '') {
  await ensureEmployeeProfilesTable(db);

  const profile = await db
    .prepare(
      `
      SELECT
        user_id,
        real_name,
        phone,
        birthday,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship
      FROM employee_profiles
      WHERE user_id = ? AND business_id = ?
      LIMIT 1
      `
    )
    .bind(userId, businessId)
    .first<AdminEmployeeProfile>();

  return profile ?? emptyEmployeeProfile(userId);
}

export async function loadPendingEmployeeProfileEditRequest(db: D1, userId: string, businessId = '') {
  await ensureEmployeeProfileEditRequestsTable(db);

  const request = await db
    .prepare(
      `
      SELECT
        id,
        user_id,
        requested_real_name,
        requested_birthday,
        status,
        manager_note,
        requested_at,
        resolved_at,
        resolved_by
      FROM employee_profile_edit_requests
      WHERE user_id = ? AND business_id = ? AND status = 'pending'
      ORDER BY requested_at DESC
      LIMIT 1
      `
    )
    .bind(userId, businessId)
    .first<EmployeeProfileEditRequest>();

  return request ?? null;
}

function defaultEmployeeOnboardingItems() {
  return [
    {
      item_type: 'form',
      form_key: 'personal_information',
      title: 'Personal information',
      description: 'Complete legal name, birthday, phone, and home address.',
      source_file_url: '',
      source_file_name: '',
      sort_order: 0
    },
    {
      item_type: 'form',
      form_key: 'emergency_contact',
      title: 'Emergency contact',
      description: 'Add the emergency contact the business should use if needed.',
      source_file_url: '',
      source_file_name: '',
      sort_order: 1
    },
    {
      item_type: 'form',
      form_key: 'payroll_setup',
      title: 'Payroll setup',
      description: 'Confirm worker classification, start date, pay type, and direct deposit authorization details.',
      source_file_url: '',
      source_file_name: '',
      sort_order: 2
    },
    {
      item_type: 'document',
      form_key: '',
      title: 'I-9 employment eligibility',
      description: 'Upload completed employment eligibility documentation for manager review.',
      source_file_url: '',
      source_file_name: '',
      sort_order: 3
    },
    {
      item_type: 'document',
      form_key: '',
      title: 'Tax withholding document',
      description: 'Upload the completed W-4 or applicable tax withholding document.',
      source_file_url: '',
      source_file_name: '',
      sort_order: 4
    },
    {
      item_type: 'acknowledgement',
      form_key: '',
      title: 'Handbook acknowledgement',
      description: 'Review the employee handbook or attached policy document, then acknowledge and sign.',
      source_file_url: '',
      source_file_name: '',
      sort_order: 5
    },
    {
      item_type: 'acknowledgement',
      form_key: '',
      title: 'Food safety acknowledgement',
      description: 'Review food safety and restaurant operating policies, then acknowledge and sign.',
      source_file_url: '',
      source_file_name: '',
      sort_order: 6
    }
  ] satisfies Array<{
    item_type: EmployeeOnboardingItem['item_type'];
    form_key: string;
    title: string;
    description: string;
    source_file_url: string;
    source_file_name: string;
    sort_order: number;
  }>;
}

function isAdminBusinessRole(role: string | null | undefined) {
  const normalized = String(role ?? '').trim().toLowerCase();
  return normalized === 'owner' || normalized === 'admin' || normalized === 'manager';
}

function normalizeOnboardingItemType(value: string): EmployeeOnboardingItem['item_type'] | null {
  if (value === 'form' || value === 'document' || value === 'acknowledgement') return value;
  if (value === 'profile') return 'form';
  return null;
}

function normalizeOnboardingFormKey(value: string, itemType: EmployeeOnboardingItem['item_type']) {
  if (itemType !== 'form') return '';
  const normalized = value.trim().toLowerCase();
  if (['personal_information', 'emergency_contact', 'payroll_setup'].includes(normalized)) return normalized;
  return 'personal_information';
}

function formString(formData: FormData, key: string, maxLength = 180) {
  return String(formData.get(key) ?? '').trim().slice(0, maxLength);
}

function requireFormFields(fields: Record<string, string>, required: string[]) {
  const missing = required.find((key) => !fields[key]);
  return missing ? false : true;
}

function buildOnboardingFormPayload(formData: FormData, formKey: string) {
  if (formKey === 'personal_information') {
    const fields = {
      legal_name: formString(formData, 'legal_name', 120),
      preferred_name: formString(formData, 'preferred_name', 120),
      birthday: formString(formData, 'birthday', 10),
      phone: formString(formData, 'phone', 48),
      address_line_1: formString(formData, 'address_line_1', 120),
      address_line_2: formString(formData, 'address_line_2', 120),
      city: formString(formData, 'city', 80),
      state: formString(formData, 'state', 80),
      postal_code: formString(formData, 'postal_code', 24)
    };
    if (!requireFormFields(fields, ['legal_name', 'birthday', 'phone', 'address_line_1', 'city', 'state', 'postal_code'])) {
      return { error: 'Complete every required personal information field.' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.birthday)) {
      return { error: 'Birthday must use a valid date.' };
    }
    return { payload: fields };
  }

  if (formKey === 'emergency_contact') {
    const fields = {
      emergency_contact_name: formString(formData, 'emergency_contact_name', 120),
      emergency_contact_phone: formString(formData, 'emergency_contact_phone', 48),
      emergency_contact_relationship: formString(formData, 'emergency_contact_relationship', 80)
    };
    if (!requireFormFields(fields, ['emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship'])) {
      return { error: 'Complete every emergency contact field.' };
    }
    return { payload: fields };
  }

  if (formKey === 'payroll_setup') {
    const directDepositAuthorized = String(formData.get('direct_deposit_authorized') ?? '0') === '1';
    const fields = {
      worker_classification:
        formString(formData, 'worker_classification', 32) === 'contractor' ? 'contractor' : 'employee',
      start_date: formString(formData, 'start_date', 10),
      pay_type: formString(formData, 'pay_type', 32) === 'salary' ? 'salary' : 'hourly',
      direct_deposit_authorized: directDepositAuthorized ? 'yes' : 'no',
      bank_name: formString(formData, 'bank_name', 120),
      routing_last_four: formString(formData, 'routing_last_four', 4),
      account_last_four: formString(formData, 'account_last_four', 4)
    };
    if (!requireFormFields(fields, ['worker_classification', 'start_date', 'pay_type'])) {
      return { error: 'Complete every required payroll setup field.' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.start_date)) {
      return { error: 'Start date must use a valid date.' };
    }
    if (directDepositAuthorized && !requireFormFields(fields, ['bank_name', 'routing_last_four', 'account_last_four'])) {
      return { error: 'Add the direct deposit authorization details or turn direct deposit authorization off.' };
    }
    if (
      directDepositAuthorized &&
      (!/^\d{4}$/.test(fields.routing_last_four) || !/^\d{4}$/.test(fields.account_last_four))
    ) {
      return { error: 'Direct deposit routing and account references must be the last four digits.' };
    }
    return { payload: fields };
  }

  return { error: 'This onboarding form is not configured correctly.' };
}

async function applyOnboardingFormPayloadToProfile(
  db: D1,
  businessId: string,
  userId: string,
  formKey: string,
  payload: Record<string, string>,
  updatedBy: string | null
) {
  if (formKey !== 'personal_information' && formKey !== 'emergency_contact') return;

  await ensureEmployeeProfilesTable(db);
  const current = await loadAdminEmployeeProfile(db, userId, businessId);
  const now = Math.floor(Date.now() / 1000);
  const next = {
    real_name: formKey === 'personal_information' ? payload.legal_name : current.real_name,
    phone: formKey === 'personal_information' ? payload.phone : current.phone,
    birthday: formKey === 'personal_information' ? payload.birthday : current.birthday,
    address_line_1: formKey === 'personal_information' ? payload.address_line_1 : current.address_line_1,
    address_line_2: formKey === 'personal_information' ? payload.address_line_2 : current.address_line_2,
    city: formKey === 'personal_information' ? payload.city : current.city,
    state: formKey === 'personal_information' ? payload.state : current.state,
    postal_code: formKey === 'personal_information' ? payload.postal_code : current.postal_code,
    emergency_contact_name:
      formKey === 'emergency_contact' ? payload.emergency_contact_name : current.emergency_contact_name,
    emergency_contact_phone:
      formKey === 'emergency_contact' ? payload.emergency_contact_phone : current.emergency_contact_phone,
    emergency_contact_relationship:
      formKey === 'emergency_contact'
        ? payload.emergency_contact_relationship
        : current.emergency_contact_relationship
  };

  await db
    .prepare(
      `
      INSERT INTO employee_profiles (
        business_id,
        user_id,
        real_name,
        phone,
        birthday,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship,
        updated_at,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(business_id, user_id) DO UPDATE SET
        real_name = excluded.real_name,
        phone = excluded.phone,
        birthday = excluded.birthday,
        address_line_1 = excluded.address_line_1,
        address_line_2 = excluded.address_line_2,
        city = excluded.city,
        state = excluded.state,
        postal_code = excluded.postal_code,
        emergency_contact_name = excluded.emergency_contact_name,
        emergency_contact_phone = excluded.emergency_contact_phone,
        emergency_contact_relationship = excluded.emergency_contact_relationship,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
      `
    )
    .bind(
      businessId,
      userId,
      next.real_name,
      next.phone,
      next.birthday,
      next.address_line_1,
      next.address_line_2,
      next.city,
      next.state,
      next.postal_code,
      next.emergency_contact_name,
      next.emergency_contact_phone,
      next.emergency_contact_relationship,
      now,
      updatedBy
    )
    .run();
}

async function resolveOnboardingTemplateSourceFile(
  formData: FormData,
  locals: App.Locals,
  sourceName: string,
  existingUrl = ''
) {
  let sourceFileUrl = String(formData.get('source_file_url') ?? existingUrl).trim();
  let sourceFileName = String(formData.get('existing_source_file_name') ?? '').trim();
  const upload = formData.get(sourceName);

  if (upload instanceof File && upload.size > 0) {
    if (upload.size > 15 * 1024 * 1024) {
      return { error: 'Onboarding source documents must be 15MB or smaller.' };
    }

    const contentType = upload.type || 'application/octet-stream';
    const extension = extensionFromFilename(upload.name);
    if (!isAllowedDocumentUpload(contentType, extension)) {
      return { error: 'Only PDF or image documents can be uploaded.' };
    }

    if (!locals.MEDIA_BUCKET) {
      return { error: 'Document storage is not configured.' };
    }

    try {
      const uploaded = await uploadEmployeeOnboardingMedia(
        locals.MEDIA_BUCKET,
        requireBusinessId(locals),
        `template-${locals.businessId ?? 'business'}`,
        upload
      );
      const previousKey = documentMediaKeyFromUrl(existingUrl);
      if (previousKey && previousKey !== uploaded.key) {
        await locals.MEDIA_BUCKET.delete(previousKey);
      }
      sourceFileUrl = uploaded.url;
      sourceFileName = upload.name;
    } catch {
      return { error: 'Only PDF or image documents can be uploaded.' };
    }
  } else if (!sourceFileUrl) {
    sourceFileName = '';
  }

  return { sourceFileUrl, sourceFileName };
}

export async function loadEmployeeOnboardingTemplate(db: D1, businessId: string) {
  await ensureEmployeeOnboardingTables(db);
  const template = await db
    .prepare(
      `
      SELECT
        id,
        business_id,
        CASE WHEN item_type = 'profile' THEN 'form' ELSE item_type END AS item_type,
        CASE
          WHEN item_type = 'profile' AND COALESCE(form_key, '') = '' THEN 'personal_information'
          ELSE form_key
        END AS form_key,
        title,
        description,
        source_file_url,
        source_file_name,
        sort_order,
        is_active,
        created_at,
        updated_at,
        created_by
      FROM employee_onboarding_template_items
      WHERE business_id = ?
      ORDER BY sort_order ASC, created_at ASC
      `
    )
    .bind(businessId)
    .all<EmployeeOnboardingTemplateItem>();

  return template.results ?? [];
}

export async function createEmployeeOnboardingTemplateItem(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureEmployeeOnboardingTables(db);

  const formData = await request.formData();
  const itemType = normalizeOnboardingItemType(String(formData.get('item_type') ?? '').trim());
  const formKey = normalizeOnboardingFormKey(String(formData.get('form_key') ?? '').trim(), itemType ?? 'acknowledgement');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const sortOrder = Number(formData.get('sort_order') ?? 0);
  const isActive = Number(formData.get('is_active') ?? 1) === 1 ? 1 : 0;

  if (!itemType) return fail(400, { error: 'Choose a valid onboarding item type.' });
  if (!title) return fail(400, { error: 'Title is required.' });

  const sourceResult = await resolveOnboardingTemplateSourceFile(formData, locals, 'source_file');
  if ('error' in sourceResult) return fail(400, { error: sourceResult.error });

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      INSERT INTO employee_onboarding_template_items (
        id,
        business_id,
        item_type,
        form_key,
        title,
        description,
        source_file_url,
        source_file_name,
        sort_order,
        is_active,
        created_at,
        updated_at,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      crypto.randomUUID(),
      businessId,
      itemType,
      formKey,
      title,
      description,
      sourceResult.sourceFileUrl,
      sourceResult.sourceFileName,
      Number.isFinite(sortOrder) ? sortOrder : 0,
      isActive,
      now,
      now,
      locals.userId ?? null
    )
    .run();

  return { success: true, message: 'Onboarding item added.' };
}

export async function updateEmployeeOnboardingTemplateItem(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureEmployeeOnboardingTables(db);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '').trim();
  const itemType = normalizeOnboardingItemType(String(formData.get('item_type') ?? '').trim());
  const formKey = normalizeOnboardingFormKey(String(formData.get('form_key') ?? '').trim(), itemType ?? 'acknowledgement');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const sortOrder = Number(formData.get('sort_order') ?? 0);
  const isActive = Number(formData.get('is_active') ?? 1) === 1 ? 1 : 0;
  const existingUrl = String(formData.get('existing_source_file_url') ?? '').trim();

  if (!id) return fail(400, { error: 'Missing onboarding item id.' });
  if (!itemType) return fail(400, { error: 'Choose a valid onboarding item type.' });
  if (!title) return fail(400, { error: 'Title is required.' });

  const sourceResult = await resolveOnboardingTemplateSourceFile(formData, locals, 'source_file', existingUrl);
  if ('error' in sourceResult) return fail(400, { error: sourceResult.error });

  await db
    .prepare(
      `
      UPDATE employee_onboarding_template_items
      SET item_type = ?,
        form_key = ?,
        title = ?,
        description = ?,
        source_file_url = ?,
        source_file_name = ?,
        sort_order = ?,
        is_active = ?,
        updated_at = ?
      WHERE id = ? AND business_id = ?
      `
    )
    .bind(
      itemType,
      formKey,
      title,
      description,
      sourceResult.sourceFileUrl,
      sourceResult.sourceFileName,
      Number.isFinite(sortOrder) ? sortOrder : 0,
      isActive,
      Math.floor(Date.now() / 1000),
      id,
      businessId
    )
    .run();

  return { success: true, message: 'Onboarding item saved.' };
}

export async function deleteEmployeeOnboardingTemplateItem(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureEmployeeOnboardingTables(db);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return fail(400, { error: 'Missing onboarding item id.' });

  const existing = await db
    .prepare(
      `
      SELECT source_file_url
      FROM employee_onboarding_template_items
      WHERE id = ? AND business_id = ?
      LIMIT 1
      `
    )
    .bind(id, businessId)
    .first<{ source_file_url: string }>();

  await db
    .prepare(`DELETE FROM employee_onboarding_template_items WHERE id = ? AND business_id = ?`)
    .bind(id, businessId)
    .run();

  const mediaKey = documentMediaKeyFromUrl(existing?.source_file_url ?? '');
  if (mediaKey && locals.MEDIA_BUCKET) {
    await locals.MEDIA_BUCKET.delete(mediaKey);
  }

  return { success: true, message: 'Onboarding item deleted.' };
}

async function refreshEmployeeOnboardingPackageStatus(
  db: D1,
  packageId: string,
  businessId: string,
  approvedBy?: string | null
) {
  const counts = await db
    .prepare(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status = 'needs_changes' THEN 1 ELSE 0 END) AS needs_changes_count,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_count
      FROM employee_onboarding_items
      WHERE package_id = ? AND business_id = ?
      `
    )
    .bind(packageId, businessId)
    .first<{
      total: number;
      pending_count: number | null;
      needs_changes_count: number | null;
      submitted_count: number | null;
      approved_count: number | null;
    }>();

  const total = counts?.total ?? 0;
  const pendingCount = counts?.pending_count ?? 0;
  const needsChangesCount = counts?.needs_changes_count ?? 0;
  const submittedCount = counts?.submitted_count ?? 0;
  const approvedCount = counts?.approved_count ?? 0;
  const now = Math.floor(Date.now() / 1000);

  let status: EmployeeOnboardingPackage['status'] = 'sent';
  let completedAt: number | null = null;
  let approvedAt: number | null = null;
  let reviewer: string | null = null;

  if (total > 0 && approvedCount === total) {
    status = 'approved';
    completedAt = now;
    approvedAt = now;
    reviewer = approvedBy ?? null;
  } else if (total > 0 && pendingCount === 0 && needsChangesCount === 0) {
    status = 'submitted';
    completedAt = now;
  } else if (submittedCount > 0 || approvedCount > 0 || needsChangesCount > 0) {
    status = 'in_progress';
  }

  await db
    .prepare(
      `
      UPDATE employee_onboarding_packages
      SET status = ?,
        completed_at = CASE WHEN ? IS NULL THEN completed_at ELSE ? END,
        approved_at = CASE WHEN ? IS NULL THEN approved_at ELSE ? END,
        approved_by = CASE WHEN ? IS NULL THEN approved_by ELSE ? END,
        updated_at = ?
      WHERE id = ? AND business_id = ?
      `
    )
    .bind(status, completedAt, completedAt, approvedAt, approvedAt, reviewer, reviewer, now, packageId, businessId)
    .run();
}

export async function loadEmployeeOnboarding(
  db: D1,
  userId: string,
  businessId: string
): Promise<EmployeeOnboardingState> {
  await ensureEmployeeOnboardingTables(db);

  const onboardingPackage = await db
    .prepare(
      `
      SELECT
        id,
        business_id,
        user_id,
        status,
        payroll_classification,
        sent_at,
        completed_at,
        approved_at,
        approved_by,
        created_by,
        updated_at,
        manager_note
      FROM employee_onboarding_packages
      WHERE user_id = ? AND business_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
      `
    )
    .bind(userId, businessId)
    .first<EmployeeOnboardingPackage>();

  if (!onboardingPackage) {
    return { package: null, items: [] };
  }

  const items = await db
    .prepare(
      `
      SELECT
        id,
        package_id,
        business_id,
        user_id,
        CASE WHEN item_type = 'profile' THEN 'form' ELSE item_type END AS item_type,
        CASE
          WHEN item_type = 'profile' AND COALESCE(form_key, '') = '' THEN 'personal_information'
          ELSE form_key
        END AS form_key,
        title,
        description,
        status,
        file_url,
        file_name,
        form_payload,
        source_file_url,
        source_file_name,
        signed_name,
        manager_note,
        sort_order,
        created_at,
        submitted_at,
        reviewed_at,
        reviewed_by
      FROM employee_onboarding_items
      WHERE package_id = ? AND business_id = ?
      ORDER BY sort_order ASC, created_at ASC
      `
    )
    .bind(onboardingPackage.id, businessId)
    .all<EmployeeOnboardingItem>();

  return {
    package: onboardingPackage,
    items: items.results ?? []
  };
}

async function createEmployeeOnboardingPackageForUser(
  db: D1,
  options: {
    businessId: string;
    userId: string;
    payrollClassification?: EmployeeOnboardingPackage['payroll_classification'];
    createdBy?: string | null;
  }
) {
  await ensureEmployeeOnboardingTables(db);

  const existingActive = await db
    .prepare(
      `
      SELECT id, status
      FROM employee_onboarding_packages
      WHERE user_id = ? AND business_id = ? AND status != 'approved'
      ORDER BY updated_at DESC
      LIMIT 1
      `
    )
    .bind(options.userId, options.businessId)
    .first<{ id: string; status: EmployeeOnboardingPackage['status'] }>();

  if (existingActive) {
    return { created: false, packageId: existingActive.id, status: existingActive.status };
  }

  const now = Math.floor(Date.now() / 1000);
  const packageId = crypto.randomUUID();
  const payrollClassification = options.payrollClassification === 'contractor' ? 'contractor' : 'employee';

  await db
    .prepare(
      `
      INSERT INTO employee_onboarding_packages (
        id,
        business_id,
        user_id,
        status,
        payroll_classification,
        sent_at,
        completed_at,
        approved_at,
        approved_by,
        created_by,
        updated_at,
        manager_note
      )
      VALUES (?, ?, ?, 'sent', ?, ?, NULL, NULL, NULL, ?, ?, '')
      `
    )
    .bind(packageId, options.businessId, options.userId, payrollClassification, now, options.createdBy ?? null, now)
    .run();

  const templateItems = (await loadEmployeeOnboardingTemplate(db, options.businessId)).filter(
    (item) => item.is_active === 1
  );
  const onboardingItems = templateItems.length > 0 ? templateItems : defaultEmployeeOnboardingItems();

  for (const item of onboardingItems) {
    await db
      .prepare(
        `
        INSERT INTO employee_onboarding_items (
          id,
          package_id,
          business_id,
          user_id,
          item_type,
          form_key,
          title,
          description,
          status,
          file_url,
          file_name,
          form_payload,
          source_file_url,
          source_file_name,
          signed_name,
          manager_note,
          sort_order,
          created_at,
          submitted_at,
          reviewed_at,
          reviewed_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', '', '', ?, ?, '', '', ?, ?, NULL, NULL, NULL)
        `
      )
      .bind(
        crypto.randomUUID(),
        packageId,
        options.businessId,
        options.userId,
        item.item_type,
        item.form_key,
        item.title,
        item.description,
        item.source_file_url,
        item.source_file_name,
        item.sort_order,
        now
      )
      .run();
  }

  return { created: true, packageId, status: 'sent' as const };
}

export async function ensureEmployeeOnboardingRequirement(
  db: D1,
  businessId: string,
  userId: string,
  createdBy?: string | null
) {
  if (!businessId || !userId) return { required: false, approved: true, status: 'not_required' as const };

  await ensureBusinessSchema(db);
  const membership = await db
    .prepare(
      `
      SELECT role, COALESCE(is_active, 1) AS is_active
      FROM business_users
      WHERE business_id = ? AND user_id = ?
      LIMIT 1
      `
    )
    .bind(businessId, userId)
    .first<{ role: string | null; is_active: number }>();

  if (!membership || membership.is_active !== 1 || isAdminBusinessRole(membership.role)) {
    return { required: false, approved: true, status: 'not_required' as const };
  }

  await ensureEmployeeOnboardingTables(db);
  const latest = await db
    .prepare(
      `
      SELECT id, status
      FROM employee_onboarding_packages
      WHERE business_id = ? AND user_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
      `
    )
    .bind(businessId, userId)
    .first<{ id: string; status: EmployeeOnboardingPackage['status'] }>();

  if (latest?.status === 'approved') {
    return { required: true, approved: true, status: latest.status, packageId: latest.id };
  }

  if (latest) {
    return { required: true, approved: false, status: latest.status, packageId: latest.id };
  }

  const created = await createEmployeeOnboardingPackageForUser(db, {
    businessId,
    userId,
    createdBy: createdBy ?? null
  });

  return {
    required: true,
    approved: false,
    status: created.status,
    packageId: created.packageId
  };
}

export async function loadEmployeeOnboardingAccessStatus(db: D1, businessId: string, userId: string) {
  return ensureEmployeeOnboardingRequirement(db, businessId, userId, null);
}

export async function loadEmployeeOnboardingDashboard(
  db: D1,
  businessId: string
): Promise<AdminOnboardingDashboardRow[]> {
  await ensureEmployeeOnboardingTables(db);

  const users = await loadAdminUsers(db, businessId);
  const packages = await db
    .prepare(
      `
      SELECT
        id,
        business_id,
        user_id,
        status,
        payroll_classification,
        sent_at,
        completed_at,
        approved_at,
        approved_by,
        created_by,
        updated_at,
        manager_note
      FROM employee_onboarding_packages
      WHERE business_id = ?
      ORDER BY updated_at DESC
      `
    )
    .bind(businessId)
    .all<EmployeeOnboardingPackage>();

  const itemCounts = await db
    .prepare(
      `
      SELECT
        package_id,
        COUNT(*) AS total_items,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_items,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted_items,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_items,
        SUM(CASE WHEN status = 'needs_changes' THEN 1 ELSE 0 END) AS needs_changes_items
      FROM employee_onboarding_items
      WHERE business_id = ?
      GROUP BY package_id
      `
    )
    .bind(businessId)
    .all<{
      package_id: string;
      total_items: number;
      pending_items: number | null;
      submitted_items: number | null;
      approved_items: number | null;
      needs_changes_items: number | null;
    }>();

  const latestPackageByUser = new Map<string, EmployeeOnboardingPackage>();
  for (const packet of packages.results ?? []) {
    if (!latestPackageByUser.has(packet.user_id)) {
      latestPackageByUser.set(packet.user_id, packet);
    }
  }

  const countsByPackage = new Map(
    (itemCounts.results ?? []).map((row) => [
      row.package_id,
      {
        total_items: row.total_items ?? 0,
        pending_items: row.pending_items ?? 0,
        submitted_items: row.submitted_items ?? 0,
        approved_items: row.approved_items ?? 0,
        needs_changes_items: row.needs_changes_items ?? 0
      }
    ])
  );

  return users
    .filter((user) => !isAdminBusinessRole(user.role))
    .map((user) => {
      const packet = latestPackageByUser.get(user.id) ?? null;
      const counts = packet ? countsByPackage.get(packet.id) : null;

      return {
        user_id: user.id,
        display_name: user.display_name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        package_id: packet?.id ?? null,
        package_status: packet?.status ?? 'not_sent',
        payroll_classification: packet?.payroll_classification ?? null,
        sent_at: packet?.sent_at ?? null,
        completed_at: packet?.completed_at ?? null,
        approved_at: packet?.approved_at ?? null,
        updated_at: packet?.updated_at ?? null,
        total_items: counts?.total_items ?? 0,
        pending_items: counts?.pending_items ?? 0,
        submitted_items: counts?.submitted_items ?? 0,
        approved_items: counts?.approved_items ?? 0,
        needs_changes_items: counts?.needs_changes_items ?? 0
      };
    });
}

export async function loadAdminNodeNames(db: D1, businessId: string) {
  if (!(await tableExists(db, 'sensor_nodes'))) return [];
  await ensureTenantSchema(db, true);
  const nodeResult = await db
    .prepare(
      `
      SELECT sensor_id, name
      FROM sensor_nodes
      WHERE business_id = ?
      ORDER BY sensor_id ASC
      `
    )
    .bind(businessId)
    .all<AdminNodeName>();
  return nodeResult.results ?? [];
}

export async function loadAdminWhiteboardIdeas(db: D1, businessId: string) {
  await ensureTenantSchema(db);
  const whiteboardReviewExists = await tableExists(db, 'whiteboard_review');
  const ideas = whiteboardReviewExists
    ? await db
        .prepare(
          `
          SELECT
            p.id,
            p.content,
            p.votes,
            COALESCE(r.status, 'approved') AS status,
            p.created_at,
            u.display_name AS submitted_name,
            u.email AS submitted_email
          FROM whiteboard_posts p
          LEFT JOIN whiteboard_review r ON r.post_id = p.id
          LEFT JOIN users u ON u.id = p.created_by
          WHERE p.business_id = ?
          ORDER BY
            CASE COALESCE(r.status, 'approved')
              WHEN 'pending' THEN 0
              WHEN 'approved' THEN 1
              ELSE 2
            END ASC,
            p.votes DESC,
            p.created_at DESC
          `
        )
        .bind(businessId)
        .all<AdminWhiteboardIdea>()
    : await db
        .prepare(
          `
          SELECT
            p.id,
            p.content,
            p.votes,
            'approved' AS status,
            p.created_at,
            u.display_name AS submitted_name,
            u.email AS submitted_email
          FROM whiteboard_posts p
          LEFT JOIN users u ON u.id = p.created_by
          WHERE p.business_id = ?
          ORDER BY p.votes DESC, p.created_at DESC
          `
        )
        .bind(businessId)
        .all<AdminWhiteboardIdea>();

  return ideas.results ?? [];
}

export async function cleanupExpiredRejectedWhiteboardIdeas(db: D1, businessId: string) {
  if (!(await tableExists(db, 'whiteboard_review'))) return;
  await ensureTenantSchema(db);

  const cutoff = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 7;
  const rejected = await db
    .prepare(
      `
      SELECT post_id
      FROM whiteboard_review
      WHERE status = 'rejected'
        AND COALESCE(reviewed_at, 0) < ?
        AND business_id = ?
      `
    )
    .bind(cutoff, businessId)
    .all<{ post_id: string }>();

  for (const row of rejected.results ?? []) {
    await db.prepare(`DELETE FROM whiteboard_review WHERE post_id = ? AND business_id = ?`).bind(row.post_id, businessId).run();
    await db.prepare(`DELETE FROM whiteboard_posts WHERE id = ? AND business_id = ?`).bind(row.post_id, businessId).run();
  }
}

export async function loadAdminDocuments(db: D1, businessId: string) {
  await ensureTenantSchema(db);
  const documents = await db
    .prepare(
      `
      SELECT id, slug, title, section, category, content, file_url, is_active
      FROM documents
      WHERE business_id = ?
      ORDER BY updated_at DESC, title ASC
      `
    )
    .bind(businessId)
    .all<AdminDocument>();
  return documents.results ?? [];
}

export async function loadAdminAnnouncement(db: D1, businessId: string) {
  await ensureAnnouncementsSchema(db);
  await ensureTenantSchema(db, true);
  return loadHomepageAnnouncement(db, businessId);
}

export async function loadAdminEmployeeSpotlight(db: D1, businessId: string) {
  await ensureEmployeeSpotlightSchema(db);
  await ensureTenantSchema(db, true);
  return loadEmployeeSpotlight(db, businessId);
}

export async function createCreatorCategory(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  const formData = await request.formData();
  const editorType = String(formData.get('editor_type') ?? '').trim().toLowerCase();
  const category = normalizeCategoryName(String(formData.get('category') ?? ''));

  if (editorType !== 'recipe' && editorType !== 'document') {
    return fail(400, { error: 'Invalid category editor type.' });
  }
  if (!category) {
    return fail(400, { error: 'Category name is required.' });
  }

  await ensureCreatorCategoryRegistry(db);
  await db
    .prepare(
      `
      INSERT OR IGNORE INTO creator_category_registry (id, business_id, editor_type, category, created_at)
      VALUES (?, ?, ?, ?, ?)
      `
    )
    .bind(crypto.randomUUID(), businessId, editorType, category, Math.floor(Date.now() / 1000))
    .run();

  return { success: true };
}

export async function updateCreatorCategory(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  const formData = await request.formData();
  const editorType = String(formData.get('editor_type') ?? '').trim().toLowerCase();
  const previousCategory = normalizeCategoryName(String(formData.get('previous_category') ?? ''));
  const nextCategory = normalizeCategoryName(String(formData.get('next_category') ?? ''));

  if (editorType !== 'recipe' && editorType !== 'document') {
    return fail(400, { error: 'Invalid category editor type.' });
  }
  if (!previousCategory || !nextCategory) {
    return fail(400, { error: 'Both current and new category names are required.' });
  }
  if (previousCategory === nextCategory) return { success: true };

  if (editorType === 'recipe') {
    await db
      .prepare(`UPDATE recipes SET category = ? WHERE TRIM(COALESCE(category, '')) = ? AND business_id = ?`)
      .bind(nextCategory, previousCategory, businessId)
      .run();
  } else {
    await db
      .prepare(`UPDATE documents SET category = ? WHERE TRIM(COALESCE(category, '')) = ? AND business_id = ?`)
      .bind(nextCategory, previousCategory, businessId)
      .run();
  }

  await ensureCreatorCategoryRegistry(db);
  await db
    .prepare(`DELETE FROM creator_category_registry WHERE business_id = ? AND editor_type = ? AND category = ?`)
    .bind(businessId, editorType, previousCategory)
    .run();
  await db
    .prepare(
      `
      INSERT OR IGNORE INTO creator_category_registry (id, business_id, editor_type, category, created_at)
      VALUES (?, ?, ?, ?, ?)
      `
    )
    .bind(crypto.randomUUID(), businessId, editorType, nextCategory, Math.floor(Date.now() / 1000))
    .run();

  return { success: true };
}

export async function deleteCreatorCategory(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  const formData = await request.formData();
  const editorType = String(formData.get('editor_type') ?? '').trim().toLowerCase();
  const category = normalizeCategoryName(String(formData.get('category') ?? ''));
  const deleteWithContent = String(formData.get('delete_with_content') ?? '').trim() === '1';

  if (editorType !== 'recipe' && editorType !== 'document') {
    return fail(400, { error: 'Invalid category editor type.' });
  }
  if (!category) {
    return fail(400, { error: 'Category name is required.' });
  }

  const inUse =
    editorType === 'recipe'
      ? await db
          .prepare(`SELECT COUNT(*) AS total FROM recipes WHERE TRIM(COALESCE(category, '')) = ? AND business_id = ?`)
          .bind(category, businessId)
          .first<{ total: number }>()
      : await db
          .prepare(`SELECT COUNT(*) AS total FROM documents WHERE TRIM(COALESCE(category, '')) = ? AND business_id = ?`)
          .bind(category, businessId)
          .first<{ total: number }>();

  if ((inUse?.total ?? 0) > 0 && !deleteWithContent) {
    return fail(400, { error: 'Category still has content. Move or delete content first.' });
  }

  if (deleteWithContent) {
    if (editorType === 'recipe') {
      await db
        .prepare(`DELETE FROM recipes WHERE TRIM(COALESCE(category, '')) = ? AND business_id = ?`)
        .bind(category, businessId)
        .run();
    } else {
      await db
        .prepare(`DELETE FROM documents WHERE TRIM(COALESCE(category, '')) = ? AND business_id = ?`)
        .bind(category, businessId)
        .run();
    }
  }

  await ensureCreatorCategoryRegistry(db);
  await db
    .prepare(`DELETE FROM creator_category_registry WHERE business_id = ? AND editor_type = ? AND category = ?`)
    .bind(businessId, editorType, category)
    .run();

  return { success: true };
}

export async function createListSection(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const domain = String(formData.get('domain') ?? '').trim().toLowerCase();
  const title = String(formData.get('title') ?? '').trim();
  const requestedSlug = String(formData.get('slug') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const firstItem = String(formData.get('first_item') ?? '').trim();
  const firstDetails = String(formData.get('first_details') ?? '').trim();
  const firstParCountRaw = Number(formData.get('first_par_count') ?? 0);
  const slug = normalizeSlug(requestedSlug || title);

  if (domain !== 'preplists' && domain !== 'inventory' && domain !== 'orders') {
    return fail(400, { error: 'Invalid list type.' });
  }
  if (!title) return fail(400, { error: 'Section title is required.' });
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return fail(400, { error: 'Section slug can only use letters, numbers, and hyphens.' });
  }
  if (firstItem && (!Number.isFinite(firstParCountRaw) || firstParCountRaw < 0)) {
    return fail(400, { error: 'First item par count must be a valid non-negative number.' });
  }

  const existing = await db
    .prepare(
      `
      SELECT id
      FROM list_sections
      WHERE domain = ? AND slug = ? AND business_id = ?
      LIMIT 1
      `
    )
    .bind(domain, slug, businessId)
    .first<{ id: string }>();
  if (existing) {
    return fail(400, { error: `A ${domain} section already exists with slug "${slug}".` });
  }

  const now = Math.floor(Date.now() / 1000);
  const sectionId = crypto.randomUUID();
  await db
    .prepare(
      `
      INSERT INTO list_sections (id, domain, slug, title, description, created_at, updated_at, business_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(sectionId, domain, slug, title, description || null, now, now, businessId)
    .run();

  if (firstItem) {
    const maxSort = await db
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM list_items WHERE section_id = ? AND business_id = ?`)
      .bind(sectionId, businessId)
      .first<{ max_sort: number }>();
    const columns = await db.prepare(`PRAGMA table_info(list_items)`).all<{ name: string }>();
    const detailsEnabled = (columns.results ?? []).some((column) => column.name === 'details');
    if (detailsEnabled) {
      await db
        .prepare(
          `
          INSERT INTO list_items (
            id, section_id, content, details, sort_order, is_checked,
            amount, par_count, created_at, updated_at, business_id
          )
          VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
          `
        )
        .bind(
          crypto.randomUUID(),
          sectionId,
          firstItem,
          firstDetails,
          (maxSort?.max_sort ?? -1) + 1,
          firstParCountRaw || 0,
          now,
          now,
          businessId
        )
        .run();
    } else {
      await db
        .prepare(
          `
          INSERT INTO list_items (
            id, section_id, content, sort_order, is_checked,
            amount, par_count, created_at, updated_at, business_id
          )
          VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
          `
        )
        .bind(
          crypto.randomUUID(),
          sectionId,
          firstItem,
          (maxSort?.max_sort ?? -1) + 1,
          firstParCountRaw || 0,
          now,
          now,
          businessId
        )
        .run();
    }
  }

  return { success: true };
}

export async function updateListSection(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const sectionId = String(formData.get('section_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  if (!sectionId) return fail(400, { error: 'Missing section id.' });
  if (!title) return fail(400, { error: 'Section title is required.' });

  await db
    .prepare(
      `
      UPDATE list_sections
      SET title = ?, description = ?, updated_at = ?
      WHERE id = ? AND business_id = ?
      `
    )
    .bind(title, description || null, Math.floor(Date.now() / 1000), sectionId, businessId)
    .run();

  return { success: true };
}

export async function deleteListSection(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const sectionId = String(formData.get('section_id') ?? '').trim();
  if (!sectionId) return fail(400, { error: 'Missing section id.' });

  await db.prepare(`DELETE FROM list_items WHERE section_id = ? AND business_id = ?`).bind(sectionId, businessId).run();
  await db.prepare(`DELETE FROM list_sections WHERE id = ? AND business_id = ?`).bind(sectionId, businessId).run();

  return { success: true };
}

export async function createChecklistCategory(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const title = String(formData.get('title') ?? '').trim();
  const requestedSlug = String(formData.get('slug') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const createShiftSections = String(formData.get('create_shift_sections') ?? '1') === '1';
  const baseSlug = normalizeSlug(requestedSlug || title);

  if (!title) return fail(400, { error: 'Checklist category title is required.' });
  if (!baseSlug || !/^[a-z0-9-]+$/.test(baseSlug)) {
    return fail(400, { error: 'Checklist category slug can only use letters, numbers, and hyphens.' });
  }

  if (!(await tableExists(db, 'checklist_sections')) || !(await tableExists(db, 'checklist_items'))) {
    return fail(503, { error: 'Checklist tables are not available yet.' });
  }

  const sections = createShiftSections
    ? [
        { slug: `${baseSlug}-opening`, title: `${title} Opening Checklist` },
        { slug: `${baseSlug}-midday`, title: `${title} Mid Day Checklist` },
        { slug: `${baseSlug}-closing`, title: `${title} Closing Checklist` }
      ]
    : [{ slug: baseSlug, title: `${title} Checklist` }];

  for (const section of sections) {
    const existing = await db
      .prepare(
        `
        SELECT id
        FROM checklist_sections
        WHERE slug = ? AND business_id = ?
        LIMIT 1
        `
      )
      .bind(section.slug, businessId)
      .first<{ id: string }>();
    if (existing) {
      return fail(400, { error: `Checklist section slug "${section.slug}" already exists.` });
    }
  }

  const now = Math.floor(Date.now() / 1000);
  for (const section of sections) {
    await db
      .prepare(
        `
        INSERT INTO checklist_sections (id, slug, title, description, created_at, updated_at, business_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(crypto.randomUUID(), section.slug, section.title, description || null, now, now, businessId)
      .run();
  }

  return { success: true };
}

export async function addListItem(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const sectionId = String(formData.get('section_id') ?? '');
  const content = String(formData.get('content') ?? '').trim();
  const details = String(formData.get('details') ?? '').trim();
  const parCount = Number(formData.get('par_count') ?? 0);
  if (!sectionId || !content || !Number.isFinite(parCount) || parCount < 0) {
    return fail(400, { error: 'Invalid list item input.' });
  }

  const section = await db
    .prepare(
      `
      SELECT id
      FROM list_sections
      WHERE id = ? AND business_id = ?
      LIMIT 1
      `
    )
    .bind(sectionId, businessId)
    .first<{ id: string }>();
  if (!section) return fail(404, { error: 'List section not found.' });

  const now = Math.floor(Date.now() / 1000);
  const maxSort = await db
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM list_items WHERE section_id = ? AND business_id = ?`)
    .bind(sectionId, businessId)
    .first<{ max_sort: number }>();

  const columns = await db.prepare(`PRAGMA table_info(list_items)`).all<{ name: string }>();
  const detailsEnabled = (columns.results ?? []).some((column) => column.name === 'details');

  if (detailsEnabled) {
    await db
      .prepare(
        `
        INSERT INTO list_items (
          id, section_id, content, details, sort_order, is_checked,
          amount, par_count, created_at, updated_at, business_id
        )
        VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
        `
      )
      .bind(crypto.randomUUID(), sectionId, content, details, (maxSort?.max_sort ?? -1) + 1, parCount, now, now, businessId)
      .run();
  } else {
    await db
      .prepare(
        `
        INSERT INTO list_items (
          id, section_id, content, sort_order, is_checked,
          amount, par_count, created_at, updated_at, business_id
        )
        VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
        `
      )
      .bind(crypto.randomUUID(), sectionId, content, (maxSort?.max_sort ?? -1) + 1, parCount, now, now, businessId)
      .run();
  }

  return { success: true };
}

export async function updateListItem(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  const content = String(formData.get('content') ?? '').trim();
  const details = String(formData.get('details') ?? '').trim();
  const parCount = Number(formData.get('par_count') ?? 0);
  if (!id || !content || !Number.isFinite(parCount) || parCount < 0) {
    return fail(400, { error: 'Invalid update input.' });
  }

  const columns = await db.prepare(`PRAGMA table_info(list_items)`).all<{ name: string }>();
  const detailsEnabled = (columns.results ?? []).some((column) => column.name === 'details');

  if (detailsEnabled) {
    await db
      .prepare(`UPDATE list_items SET content = ?, details = ?, par_count = ?, updated_at = ? WHERE id = ? AND business_id = ?`)
      .bind(content, details, parCount, Math.floor(Date.now() / 1000), id, businessId)
      .run();
  } else {
    await db
      .prepare(`UPDATE list_items SET content = ?, par_count = ?, updated_at = ? WHERE id = ? AND business_id = ?`)
      .bind(content, parCount, Math.floor(Date.now() / 1000), id, businessId)
      .run();
  }

  return { success: true };
}

export async function deleteListItem(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  if (!id) return fail(400, { error: 'Missing list item id.' });

  await db.prepare(`DELETE FROM list_items WHERE id = ? AND business_id = ?`).bind(id, businessId).run();
  return { success: true };
}

export async function addChecklistItem(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const sectionId = String(formData.get('section_id') ?? '');
  const content = String(formData.get('content') ?? '').trim();
  if (!sectionId || !content) {
    return fail(400, { error: 'Invalid checklist item input.' });
  }

  const section = await db
    .prepare(
      `
      SELECT id
      FROM checklist_sections
      WHERE id = ? AND business_id = ?
      LIMIT 1
      `
    )
    .bind(sectionId, businessId)
    .first<{ id: string }>();
  if (!section) return fail(404, { error: 'Checklist section not found.' });

  const now = Math.floor(Date.now() / 1000);
  const maxSort = await db
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM checklist_items WHERE section_id = ? AND business_id = ?`)
    .bind(sectionId, businessId)
    .first<{ max_sort: number }>();

  await db
    .prepare(
      `
      INSERT INTO checklist_items (
        id, section_id, content, sort_order, is_checked, created_at, updated_at, business_id
      )
      VALUES (?, ?, ?, ?, 0, ?, ?, ?)
      `
    )
    .bind(crypto.randomUUID(), sectionId, content, (maxSort?.max_sort ?? -1) + 1, now, now, businessId)
    .run();

  return { success: true };
}

export async function updateChecklistItem(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  const content = String(formData.get('content') ?? '').trim();
  if (!id || !content) {
    return fail(400, { error: 'Invalid checklist update input.' });
  }

  await db
    .prepare(`UPDATE checklist_items SET content = ?, updated_at = ? WHERE id = ? AND business_id = ?`)
    .bind(content, Math.floor(Date.now() / 1000), id, businessId)
    .run();

  return { success: true };
}

export async function deleteChecklistItem(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  if (!id) return fail(400, { error: 'Missing checklist item id.' });

  await db.prepare(`DELETE FROM checklist_items WHERE id = ? AND business_id = ?`).bind(id, businessId).run();
  return { success: true };
}

export async function createRecipe(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const f = await request.formData();
  const title = String(f.get('title') ?? '').trim();
  const category = normalizeRecipeCategory(String(f.get('category') ?? ''));
  const ingredients = String(f.get('ingredients') ?? '').trim();
  const materialsNeeded = String(f.get('materials_needed') ?? f.get('procedure') ?? '').trim();
  const instruction = String(f.get('instruction') ?? '').trim();
  const fallbackInstructions = String(f.get('instructions') ?? '').trim();

  const instructions = materialsNeeded && instruction
    ? `Materials needed:\n${materialsNeeded}\n\nInstruction:\n${instruction}`
    : fallbackInstructions;

  if (!title || !category || !ingredients || !instructions) {
    return fail(400, { error: 'All recipe fields are required.' });
  }
  await db
    .prepare(
      `
      INSERT INTO recipes (title, category, ingredients, instructions, created_at, business_id)
      VALUES (?, ?, ?, ?, datetime('now'), ?)
      `
    )
    .bind(title, category, ingredients, instructions, businessId)
    .run();

  return { success: true };
}

export async function updateRecipe(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const f = await request.formData();
  const id = Number(f.get('id'));
  const title = String(f.get('title') ?? '').trim();
  const category = normalizeRecipeCategory(String(f.get('category') ?? ''));
  const ingredients = String(f.get('ingredients') ?? '').trim();
  const materialsNeeded = String(f.get('materials_needed') ?? f.get('procedure') ?? '').trim();
  const instruction = String(f.get('instruction') ?? '').trim();
  const fallbackInstructions = String(f.get('instructions') ?? '').trim();

  const instructions =
    materialsNeeded && instruction
      ? `Materials needed:\n${materialsNeeded}\n\nInstruction:\n${instruction}`
      : fallbackInstructions;

  if (!Number.isFinite(id)) return fail(400, { error: 'Invalid recipe id.' });
  if (!title || !category || !ingredients || !instructions) {
    return fail(400, { error: 'All recipe fields are required.' });
  }

  await db
    .prepare(
      `
      UPDATE recipes
      SET title = ?, category = ?, ingredients = ?, instructions = ?
      WHERE id = ? AND business_id = ?
      `
    )
    .bind(title, category, ingredients, instructions, id, businessId)
    .run();

  return { success: true };
}

export async function deleteRecipe(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const f = await request.formData();
  const id = Number(f.get('id'));
  if (!Number.isFinite(id)) return fail(400, { error: 'Invalid recipe id.' });

  await db.prepare(`DELETE FROM recipes WHERE id = ? AND business_id = ?`).bind(id, businessId).run();
  return { success: true };
}

export async function createTodo(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const assignedTo = String(formData.get('assigned_to') ?? '').trim();
  if (!title) return fail(400, { error: 'Todo title is required.' });

  const now = Math.floor(Date.now() / 1000);
  const todoId = crypto.randomUUID();
  await db
    .prepare(
      `
      INSERT INTO todos (
        id, title, description, created_by, created_at, updated_at, business_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(todoId, title, description, locals.userId, now, now, businessId)
    .run();

  if (assignedTo) {
    await db
      .prepare(
        `
        INSERT OR REPLACE INTO todo_assignments (todo_id, user_id, assigned_at, business_id)
        VALUES (?, ?, ?, ?)
        `
      )
      .bind(todoId, assignedTo, now, businessId)
      .run();
  }

  return { success: true };
}

export async function deleteTodo(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  if (!id) return fail(400, { error: 'Missing todo id.' });

  await db.prepare(`DELETE FROM todo_assignments WHERE todo_id = ? AND business_id = ?`).bind(id, businessId).run();
  await db.prepare(`DELETE FROM todo_completion_log WHERE todo_id = ? AND business_id = ?`).bind(id, businessId).run();
  await db.prepare(`DELETE FROM todos WHERE id = ? AND business_id = ?`).bind(id, businessId).run();
  return { success: true };
}

export async function addNodeName(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  if (!(await tableExists(db, 'sensor_nodes'))) {
    return fail(400, { error: 'sensor_nodes table missing. Run db:migrate:nodenames first.' });
  }
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const sensorId = Number(formData.get('sensor_id'));
  const name = String(formData.get('name') ?? '').trim();
  if (!Number.isFinite(sensorId) || sensorId <= 0 || !name) {
    return fail(400, { error: 'Invalid node name input.' });
  }

  await db
    .prepare(
      `
      INSERT OR REPLACE INTO sensor_nodes (sensor_id, name, updated_at, business_id)
      VALUES (?, ?, ?, ?)
      `
    )
    .bind(sensorId, name, Math.floor(Date.now() / 1000), businessId)
    .run();

  return { success: true };
}

export async function deleteNodeName(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  if (!(await tableExists(db, 'sensor_nodes'))) {
    return fail(400, { error: 'sensor_nodes table missing. Run db:migrate:nodenames first.' });
  }
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const sensorId = Number(formData.get('sensor_id'));
  if (!Number.isFinite(sensorId) || sensorId <= 0) {
    return fail(400, { error: 'Invalid sensor id.' });
  }

  await db.prepare(`DELETE FROM sensor_nodes WHERE sensor_id = ? AND business_id = ?`).bind(sensorId, businessId).run();
  return { success: true };
}

export async function approveWhiteboard(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  if (!(await tableExists(db, 'whiteboard_review'))) {
    return fail(400, { error: 'whiteboard_review table missing. Run db:migrate:whiteboardmod first.' });
  }
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  if (!id) return fail(400, { error: 'Missing whiteboard id.' });

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      INSERT OR REPLACE INTO whiteboard_review (post_id, status, reviewed_by, reviewed_at, business_id)
      VALUES (?, 'approved', ?, ?, ?)
      `
    )
    .bind(id, locals.userId ?? null, now, businessId)
    .run();

  return { success: true };
}

export async function rejectWhiteboard(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  if (!(await tableExists(db, 'whiteboard_review'))) {
    return fail(400, { error: 'whiteboard_review table missing. Run db:migrate:whiteboardmod first.' });
  }
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  if (!id) return fail(400, { error: 'Missing whiteboard id.' });

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      INSERT OR REPLACE INTO whiteboard_review (post_id, status, reviewed_by, reviewed_at, business_id)
      VALUES (?, 'rejected', ?, ?, ?)
      `
    )
    .bind(id, locals.userId ?? null, now, businessId)
    .run();

  return { success: true };
}

export async function deleteWhiteboard(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  if (!id) return fail(400, { error: 'Missing whiteboard id.' });

  await db.prepare(`DELETE FROM whiteboard_review WHERE post_id = ? AND business_id = ?`).bind(id, businessId).run();
  await db.prepare(`DELETE FROM whiteboard_posts WHERE id = ? AND business_id = ?`).bind(id, businessId).run();

  return { success: true };
}

export async function createDocument(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const rawSlug = String(formData.get('slug') ?? '');
  const customSlug = String(formData.get('slug_custom') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const section = String(formData.get('section') ?? 'Docs').trim();
  const category = String(formData.get('category') ?? 'General').trim();
  const providedSlug = normalizeSlug(rawSlug === 'custom' ? customSlug : rawSlug);
  const slug = providedSlug || normalizeSlug(title) || normalizeSlug(category) || 'document';
  const content = String(formData.get('content') ?? '').trim();
  let fileUrl = String(formData.get('file_url') ?? '').trim();
  const isActive = Number(formData.get('is_active') ?? 1) === 1 ? 1 : 0;

  if (!title) return fail(400, { error: 'Title is required.' });
  if (!/^[a-z0-9-]+$/.test(slug)) return fail(400, { error: 'Slug can only use letters, numbers, and hyphens.' });

  const upload = formData.get('file');
  if (upload instanceof File && upload.size > 0) {
    if (upload.size > 15 * 1024 * 1024) {
      return fail(400, { error: 'Document upload must be 15MB or smaller.' });
    }

    const contentType = upload.type || 'application/octet-stream';
    const extension = extensionFromFilename(upload.name);
    if (!isAllowedDocumentUpload(contentType, extension)) {
      return fail(400, { error: 'Only PDF and image uploads are supported.' });
    }

    if (!locals.MEDIA_BUCKET) {
      return fail(503, { error: 'Document media bucket is not configured. Use File URL for now.' });
    }

    const uploaded = await uploadDocumentMedia(locals.MEDIA_BUCKET, businessId, slug, upload);
    fileUrl = uploaded.url;
  }

  if (!fileUrl) {
    return fail(400, { error: 'Upload a PDF or image file before saving.' });
  }

  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
      INSERT INTO documents (
        id, slug, title, section, category, content, file_url, is_active, created_at, updated_at, business_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(crypto.randomUUID(), slug, title, section, category, content || null, fileUrl || null, isActive, now, now, businessId)
    .run();

  return { success: true };
}

export async function updateDocument(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '').trim();
  const rawSlug = String(formData.get('slug') ?? '');
  const customSlug = String(formData.get('slug_custom') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const section = String(formData.get('section') ?? 'Docs').trim();
  const category = String(formData.get('category') ?? 'General').trim();
  const providedSlug = normalizeSlug(rawSlug === 'custom' ? customSlug : rawSlug);
  const slug = providedSlug || normalizeSlug(title) || normalizeSlug(category) || 'document';
  const content = String(formData.get('content') ?? '').trim();
  let fileUrl = String(formData.get('file_url') ?? '').trim();
  const existingFileUrl = String(formData.get('existing_file_url') ?? '').trim();
  const isActive = Number(formData.get('is_active') ?? 1) === 1 ? 1 : 0;

  if (!id || !title) return fail(400, { error: 'Document id and title are required.' });
  if (!/^[a-z0-9-]+$/.test(slug)) return fail(400, { error: 'Slug can only use letters, numbers, and hyphens.' });

  const upload = formData.get('file');
  if (upload instanceof File && upload.size > 0) {
    if (upload.size > 15 * 1024 * 1024) {
      return fail(400, { error: 'Document upload must be 15MB or smaller.' });
    }

    const contentType = upload.type || 'application/octet-stream';
    const extension = extensionFromFilename(upload.name);
    if (!isAllowedDocumentUpload(contentType, extension)) {
      return fail(400, { error: 'Only PDF and image uploads are supported.' });
    }

    if (!locals.MEDIA_BUCKET) {
      return fail(503, { error: 'Document media bucket is not configured. Use File URL for now.' });
    }

    const uploaded = await uploadDocumentMedia(locals.MEDIA_BUCKET, businessId, slug, upload);
    const previousKey = documentMediaKeyFromUrl(existingFileUrl);
    if (previousKey && previousKey !== uploaded.key) {
      await locals.MEDIA_BUCKET.delete(previousKey);
    }
    fileUrl = uploaded.url;
  }

  await db
    .prepare(
      `
      UPDATE documents
      SET slug = ?, title = ?, section = ?, category = ?, content = ?, file_url = ?, is_active = ?, updated_at = ?
      WHERE id = ? AND business_id = ?
      `
    )
    .bind(slug, title, section, category, content || null, fileUrl || null, isActive, Math.floor(Date.now() / 1000), id, businessId)
    .run();

  return { success: true };
}

export async function deleteDocument(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return fail(400, { error: 'Missing document id.' });

  const existing = await db
    .prepare(`SELECT file_url FROM documents WHERE id = ? AND business_id = ? LIMIT 1`)
    .bind(id, businessId)
    .first<{ file_url: string | null }>();

  await db.prepare(`DELETE FROM documents WHERE id = ? AND business_id = ?`).bind(id, businessId).run();

  const mediaKey = documentMediaKeyFromUrl(existing?.file_url ?? '');
  if (mediaKey && locals.MEDIA_BUCKET) {
    await locals.MEDIA_BUCKET.delete(mediaKey);
  }

  return { success: true };
}

export async function saveAnnouncement(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureAnnouncementsSchema(db);
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const content = String(formData.get('content') ?? '').trim();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
      INSERT INTO announcements (id, content, updated_by, updated_at, business_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at,
        business_id = excluded.business_id
      `
    )
    .bind(getHomepageAnnouncementId(businessId), content, locals.userId ?? null, now, businessId)
    .run();

  return { success: true };
}

export async function saveEmployeeSpotlight(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureEmployeeSpotlightSchema(db);
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const employeeName = String(formData.get('employee_name') ?? '').trim();
  const shoutout = String(formData.get('shoutout') ?? '').trim();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
      INSERT INTO employee_spotlight (id, employee_name, shoutout, updated_by, updated_at, business_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        employee_name = excluded.employee_name,
        shoutout = excluded.shoutout,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at,
        business_id = excluded.business_id
      `
    )
    .bind(getEmployeeSpotlightId(businessId), employeeName, shoutout, locals.userId ?? null, now, businessId)
    .run();

  return { success: true };
}

export async function makeUserAdmin(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) return fail(400, { error: 'Missing user id.' });
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'User not found in this business.' });
  }

  const target = await db
    .prepare(`SELECT id, COALESCE(role, 'user') AS role FROM users WHERE id = ? LIMIT 1`)
    .bind(userId)
    .first<{ id: string; role: string }>();

  if (!target) return fail(404, { error: 'User not found.' });

  await db
    .prepare(
      `
      UPDATE business_users
      SET role = 'admin', is_active = 1, updated_at = ?
      WHERE business_id = ? AND user_id = ?
      `
    )
    .bind(Math.floor(Date.now() / 1000), businessId, userId)
    .run();

  await writeAuditLog(db, {
    action: 'admin_role_granted',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    targetUserId: userId
  });

  return { success: true };
}

export async function approveUser(
  request: Request,
  locals: App.Locals,
  origin?: string,
  env?: EmailEnv | null
) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) return fail(400, { error: 'Missing user id.' });
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'User not found in this business.' });
  }
  if (!(await usersHasIsActiveColumn(db))) {
    return fail(400, { error: 'users.is_active column missing. Run auth migration first.' });
  }

  await db
    .prepare(`UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?`)
    .bind(Math.floor(Date.now() / 1000), userId)
    .run();
  await db
    .prepare(`UPDATE business_users SET is_active = 1, updated_at = ? WHERE business_id = ? AND user_id = ?`)
    .bind(Math.floor(Date.now() / 1000), businessId, userId)
    .run();

  await writeAuditLog(db, {
    action: 'user_access_approved',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    targetUserId: userId
  });

  await ensureEmployeeOnboardingRequirement(db, businessId, userId, locals.userId ?? null);

  const approvedUser = await db
    .prepare(`SELECT email, display_name FROM users WHERE id = ? LIMIT 1`)
    .bind(userId)
    .first<{ email: string; display_name: string | null }>();

  if (!approvedUser) {
    return { success: true, message: 'User approved.' };
  }

  const emailResult = await sendApprovalEmail({
    env,
    origin: origin ?? 'https://nexusnorthsystems.com',
    userEmail: approvedUser.email,
    displayName: approvedUser.display_name
  });

  return {
    success: true,
    message: emailResult.sent
      ? 'Access restored and approval email sent.'
      : `Access restored. ${emailResult.reason ?? 'Approval email was not sent.'}`
  };
}

async function getUserById(db: D1, userId: string) {
  return db
    .prepare(
      `
      SELECT id, COALESCE(role, 'user') AS role, COALESCE(is_active, 1) AS is_active
      FROM users
      WHERE id = ?
      LIMIT 1
      `
    )
    .bind(userId)
    .first<{ id: string; role: string; is_active: number }>();
}

async function countAdmins(db: D1, businessId: string) {
  await ensureBusinessSchema(db);
  const result = await db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM business_users
      WHERE business_id = ?
        AND COALESCE(is_active, 1) = 1
        AND role IN ('owner', 'admin', 'manager')
      `
    )
    .bind(businessId)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

async function hasOtherActiveBusinessMembership(db: D1, userId: string, businessId: string) {
  await ensureBusinessSchema(db);
  const row = await db
    .prepare(
      `
      SELECT business_id
      FROM business_users
      WHERE user_id = ?
        AND business_id != ?
        AND COALESCE(is_active, 1) = 1
      LIMIT 1
      `
    )
    .bind(userId, businessId)
    .first<{ business_id: string }>();
  return Boolean(row?.business_id);
}

async function revokeUserAccess(db: D1, userId: string, now: number) {
  void now;
  await revokeUserSessions(db, userId, { revokeDevices: true });
}

export async function denyUser(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) return fail(400, { error: 'Missing user id.' });
  if (!(await usersHasIsActiveColumn(db))) {
    return fail(400, { error: 'users.is_active column missing. Run auth migration first.' });
  }
  if (userId === locals.userId) {
    return fail(400, { error: 'You cannot deny your own account.' });
  }

  const target = await getUserById(db, userId);
  if (!target) return fail(404, { error: 'User not found.' });
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'User not found in this business.' });
  }
  if ((await countAdmins(db, businessId)) <= 1) {
    const businessUser = await db
      .prepare(`SELECT role FROM business_users WHERE business_id = ? AND user_id = ? LIMIT 1`)
      .bind(businessId, userId)
      .first<{ role: string }>();
    if (['owner', 'admin', 'manager'].includes(businessUser?.role ?? '')) {
      return fail(400, { error: 'At least one admin must remain active.' });
    }
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(`UPDATE business_users SET is_active = 0, updated_at = ? WHERE business_id = ? AND user_id = ?`)
    .bind(now, businessId, userId)
    .run();

  if (!(await hasOtherActiveBusinessMembership(db, userId, businessId))) {
    await db
      .prepare(`UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?`)
      .bind(now, userId)
      .run();
    await revokeUserAccess(db, userId, now);
  }

  await writeAuditLog(db, {
    action: 'user_access_restricted',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    targetUserId: userId
  });

  return { success: true };
}

export async function deleteUser(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) return fail(400, { error: 'Missing user id.' });
  if (userId === locals.userId) {
    return fail(400, { error: 'You cannot delete your own account.' });
  }

  const target = await getUserById(db, userId);
  if (!target) return fail(404, { error: 'User not found.' });
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'User not found in this business.' });
  }
  if ((await countAdmins(db, businessId)) <= 1) {
    const businessUser = await db
      .prepare(`SELECT role FROM business_users WHERE business_id = ? AND user_id = ? LIMIT 1`)
      .bind(businessId, userId)
      .first<{ role: string }>();
    if (['owner', 'admin', 'manager'].includes(businessUser?.role ?? '')) {
      return fail(400, { error: 'At least one admin must remain.' });
    }
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(`DELETE FROM business_users WHERE business_id = ? AND user_id = ?`)
    .bind(businessId, userId)
    .run();

  if (!(await hasOtherActiveBusinessMembership(db, userId, businessId))) {
    await revokeUserAccess(db, userId, now);
    await db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
  }

  await writeAuditLog(db, {
    action: 'user_deleted_from_business',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    targetUserId: userId
  });

  return { success: true };
}

export async function toggleSpecialsAccess(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureDailySpecialsSchema(db);
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) return fail(400, { error: 'Missing user id.' });
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'User not found in this business.' });
  }

  const existing = await db
    .prepare(
      `
      SELECT user_id
      FROM daily_specials_editors
      WHERE user_id = ? AND COALESCE(business_id, ?) = ?
      LIMIT 1
      `
    )
    .bind(userId, businessId, businessId)
    .first<{ user_id: string }>();

  if (existing) {
    await db
      .prepare(`DELETE FROM daily_specials_editors WHERE user_id = ? AND COALESCE(business_id, ?) = ?`)
      .bind(userId, businessId, businessId)
      .run();
    return { success: true };
  }

  await db
    .prepare(
      `
      INSERT INTO daily_specials_editors (user_id, granted_by, updated_at, business_id)
      VALUES (?, ?, ?, ?)
      `
    )
    .bind(userId, locals.userId ?? null, Math.floor(Date.now() / 1000), businessId)
    .run();

  return { success: true };
}

export async function toggleScheduleDepartmentApproval(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureScheduleSchema(db);
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  const department = String(formData.get('department') ?? '').trim();
  if (!userId) return fail(400, { error: 'Missing user id.' });
  const departments = await loadScheduleDepartments(db, businessId);
  if (!isValidScheduleDepartment(department, departments)) {
    return fail(400, { error: 'Invalid schedule department.' });
  }
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'That user could not be found in this business.' });
  }

  const existing = await db
    .prepare(
      `
      SELECT department
      FROM user_schedule_departments
      WHERE user_id = ? AND department = ? AND COALESCE(business_id, ?) = ?
      LIMIT 1
      `
    )
    .bind(userId, department, businessId, businessId)
    .first<{ department: string }>();

  if (existing) {
    await db
      .prepare(
        `
        DELETE FROM user_schedule_departments
        WHERE user_id = ? AND department = ? AND COALESCE(business_id, ?) = ?
        `
      )
      .bind(userId, department, businessId, businessId)
      .run();

    return { success: true };
  }

  await db
    .prepare(
      `
      INSERT INTO user_schedule_departments (user_id, department, updated_at, business_id)
      VALUES (?, ?, ?, ?)
      `
    )
    .bind(userId, department, Math.floor(Date.now() / 1000), businessId)
    .run();

  return { success: true };
}

export async function saveEmployeeProfile(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureEmployeeProfilesTable(db);

  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) return fail(400, { error: 'Missing user id.' });
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'Employee not found in this business.' });
  }

  const target = await getUserById(db, userId);
  if (!target) return fail(404, { error: 'Employee not found.' });

  const profile = {
    real_name: String(formData.get('real_name') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    birthday: String(formData.get('birthday') ?? '').trim(),
    address_line_1: String(formData.get('address_line_1') ?? '').trim(),
    address_line_2: String(formData.get('address_line_2') ?? '').trim(),
    city: String(formData.get('city') ?? '').trim(),
    state: String(formData.get('state') ?? '').trim(),
    postal_code: String(formData.get('postal_code') ?? '').trim(),
    emergency_contact_name: String(formData.get('emergency_contact_name') ?? '').trim(),
    emergency_contact_phone: String(formData.get('emergency_contact_phone') ?? '').trim(),
    emergency_contact_relationship: String(formData.get('emergency_contact_relationship') ?? '').trim()
  };

  if (profile.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(profile.birthday)) {
    return fail(400, { error: 'Birthday must use a valid date.' });
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      INSERT INTO employee_profiles (
        business_id,
        user_id,
        real_name,
        phone,
        birthday,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship,
        updated_at,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(business_id, user_id) DO UPDATE SET
        real_name = excluded.real_name,
        phone = excluded.phone,
        birthday = excluded.birthday,
        address_line_1 = excluded.address_line_1,
        address_line_2 = excluded.address_line_2,
        city = excluded.city,
        state = excluded.state,
        postal_code = excluded.postal_code,
        emergency_contact_name = excluded.emergency_contact_name,
        emergency_contact_phone = excluded.emergency_contact_phone,
        emergency_contact_relationship = excluded.emergency_contact_relationship,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
      `
    )
    .bind(
      businessId,
      userId,
      profile.real_name,
      profile.phone,
      profile.birthday,
      profile.address_line_1,
      profile.address_line_2,
      profile.city,
      profile.state,
      profile.postal_code,
      profile.emergency_contact_name,
      profile.emergency_contact_phone,
      profile.emergency_contact_relationship,
      now,
      locals.userId ?? null
    )
    .run();

  return { success: true, message: 'Employee profile saved.' };
}

export async function sendEmployeeOnboardingPackage(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureEmployeeOnboardingTables(db);

  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  const payrollClassification =
    String(formData.get('payroll_classification') ?? 'employee') === 'contractor' ? 'contractor' : 'employee';

  if (!userId) return fail(400, { error: 'Missing employee id.' });
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'Employee not found in this business.' });
  }

  const membership = await db
    .prepare(
      `
      SELECT role, COALESCE(is_active, 1) AS is_active
      FROM business_users
      WHERE business_id = ? AND user_id = ?
      LIMIT 1
      `
    )
    .bind(businessId, userId)
    .first<{ role: string | null; is_active: number }>();

  if (!membership || membership.is_active !== 1) {
    return fail(400, { error: 'Employee must be active before onboarding.' });
  }

  if (isAdminBusinessRole(membership.role)) {
    return fail(400, { error: 'Onboarding is for employee accounts.' });
  }

  const created = await createEmployeeOnboardingPackageForUser(db, {
    businessId,
    userId,
    payrollClassification,
    createdBy: locals.userId ?? null
  });

  if (!created.created) {
    return fail(400, { error: 'This employee already has an active onboarding package.' });
  }

  return { success: true, message: 'Onboarding package sent.' };
}

export async function submitEmployeeOnboardingItem(request: Request, locals: App.Locals) {
  if (!locals.userId) throw redirect(303, '/login');
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureEmployeeOnboardingTables(db);

  const formData = await request.formData();
  const itemId = String(formData.get('item_id') ?? '').trim();
  const signedName = String(formData.get('signed_name') ?? '').trim();
  const upload = formData.get('file');

  if (!itemId) return fail(400, { error: 'Missing onboarding item.' });

  const item = await db
    .prepare(
      `
      SELECT
        i.id,
        i.package_id,
        i.business_id,
        i.user_id,
        CASE WHEN i.item_type = 'profile' THEN 'form' ELSE i.item_type END AS item_type,
        CASE
          WHEN i.item_type = 'profile' AND COALESCE(i.form_key, '') = '' THEN 'personal_information'
          ELSE i.form_key
        END AS form_key,
        i.title,
        i.description,
        i.status,
        i.file_url,
        i.file_name,
        i.form_payload,
        i.signed_name,
        i.manager_note,
        i.sort_order,
        i.created_at,
        i.submitted_at,
        i.reviewed_at,
        i.reviewed_by,
        p.status AS package_status
      FROM employee_onboarding_items i
      JOIN employee_onboarding_packages p ON p.id = i.package_id
      WHERE i.id = ? AND i.user_id = ? AND i.business_id = ?
      LIMIT 1
      `
    )
    .bind(itemId, locals.userId, businessId)
    .first<EmployeeOnboardingItem & { package_status: EmployeeOnboardingPackage['status'] }>();

  if (!item) return fail(404, { error: 'Onboarding item not found.' });
  if (item.package_status === 'approved') {
    return fail(400, { error: 'This onboarding package is already approved.' });
  }

  let fileUrl = item.file_url;
  let fileName = item.file_name;
  let formPayload = item.form_payload;

  if (item.item_type === 'document') {
    if (upload instanceof File && upload.size > 0) {
      if (upload.size > 15 * 1024 * 1024) {
        return fail(400, { error: 'Document uploads must be 15MB or smaller.' });
      }
      if (!locals.MEDIA_BUCKET) {
        return fail(503, { error: 'Document storage is not configured.' });
      }

      try {
        const uploaded = await uploadEmployeeOnboardingMedia(locals.MEDIA_BUCKET, businessId, locals.userId, upload);
        const previousKey = documentMediaKeyFromUrl(item.file_url);
        if (previousKey) {
          await locals.MEDIA_BUCKET.delete(previousKey);
        }
        fileUrl = uploaded.url;
        fileName = upload.name;
      } catch {
        return fail(400, { error: 'Only PDF or image documents can be uploaded.' });
      }
    }

    if (!fileUrl) {
      return fail(400, { error: 'Upload the requested document before submitting.' });
    }
  } else if (item.item_type === 'form') {
    const formResult = buildOnboardingFormPayload(formData, item.form_key);
    if ('error' in formResult) return fail(400, { error: formResult.error });
    if (!signedName) return fail(400, { error: 'Typed name is required.' });
    await applyOnboardingFormPayloadToProfile(
      db,
      businessId,
      locals.userId,
      item.form_key,
      formResult.payload,
      locals.userId
    );
    formPayload = JSON.stringify(formResult.payload);
  } else if (String(formData.get('acknowledged') ?? '0') !== '1') {
    return fail(400, { error: 'Confirm the acknowledgement before submitting.' });
  } else if (!signedName) {
    return fail(400, { error: 'Typed name is required.' });
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      UPDATE employee_onboarding_items
      SET status = 'submitted',
        file_url = ?,
        file_name = ?,
        form_payload = ?,
        signed_name = ?,
        manager_note = '',
        submitted_at = ?,
        reviewed_at = NULL,
        reviewed_by = NULL
      WHERE id = ? AND user_id = ? AND business_id = ?
      `
    )
    .bind(fileUrl, fileName, formPayload, signedName, now, item.id, locals.userId, businessId)
    .run();

  await refreshEmployeeOnboardingPackageStatus(db, item.package_id, businessId);

  return { success: true, message: 'Onboarding item submitted.' };
}

async function reviewEmployeeOnboardingItem(
  request: Request,
  locals: App.Locals,
  status: Extract<EmployeeOnboardingItem['status'], 'approved' | 'needs_changes'>
) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureEmployeeOnboardingTables(db);

  const formData = await request.formData();
  const itemId = String(formData.get('item_id') ?? '').trim();
  const managerNote = String(formData.get('manager_note') ?? '').trim();

  if (!itemId) return fail(400, { error: 'Missing onboarding item.' });
  if (status === 'needs_changes' && !managerNote) {
    return fail(400, { error: 'Add a note so the employee knows what to fix.' });
  }

  const item = await db
    .prepare(
      `
      SELECT id, package_id, user_id
      FROM employee_onboarding_items
      WHERE id = ? AND business_id = ?
      LIMIT 1
      `
    )
    .bind(itemId, businessId)
    .first<{ id: string; package_id: string; user_id: string }>();

  if (!item) return fail(404, { error: 'Onboarding item not found.' });
  if (!(await userBelongsToBusiness(db, item.user_id, businessId))) {
    return fail(404, { error: 'Employee not found in this business.' });
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      UPDATE employee_onboarding_items
      SET status = ?,
        manager_note = ?,
        reviewed_at = ?,
        reviewed_by = ?
      WHERE id = ? AND business_id = ?
      `
    )
    .bind(status, managerNote, now, locals.userId ?? null, item.id, businessId)
    .run();

  await refreshEmployeeOnboardingPackageStatus(
    db,
    item.package_id,
    businessId,
    status === 'approved' ? (locals.userId ?? null) : null
  );

  return {
    success: true,
    message: status === 'approved' ? 'Onboarding item approved.' : 'Changes requested.'
  };
}

export const approveEmployeeOnboardingItem = (request: Request, locals: App.Locals) =>
  reviewEmployeeOnboardingItem(request, locals, 'approved');

export const requestEmployeeOnboardingChanges = (request: Request, locals: App.Locals) =>
  reviewEmployeeOnboardingItem(request, locals, 'needs_changes');

export async function createUserInvite(
  request: Request,
  locals: App.Locals,
  origin?: string,
  env?: EmailEnv | null
) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureBusinessSchema(db);

  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim();
  const emailNormalized = email.toLowerCase();
  if (!email || !email.includes('@')) {
    return fail(400, { error: 'A valid email is required.' });
  }

  const [businessLimit, adminLimit, emailLimit] = await Promise.all([
    checkRateLimit(db, {
      action: 'invite_business',
      identifier: businessId,
      limit: 40,
      windowSeconds: 60 * 60,
      blockSeconds: 60 * 60
    }),
    checkRateLimit(db, {
      action: 'invite_admin',
      identifier: `${businessId}:${locals.userId ?? 'unknown'}`,
      limit: 20,
      windowSeconds: 60 * 60,
      blockSeconds: 60 * 60
    }),
    checkRateLimit(db, {
      action: 'invite_email',
      identifier: `${businessId}:${emailNormalized}`,
      limit: 3,
      windowSeconds: 24 * 60 * 60,
      blockSeconds: 24 * 60 * 60
    })
  ]);

  if (!businessLimit.allowed || !adminLimit.allowed || !emailLimit.allowed) {
    await writeAuditLog(db, {
      action: 'invite_rate_limited',
      request,
      businessId,
      actorUserId: locals.userId ?? null,
      email
    });
    return rateLimitFailure();
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60 * 24 * 14;
  const inviteCode = generateInviteCode();

  await db
    .prepare(
      `
      INSERT INTO business_invites (
        id, business_id, email, email_normalized, invite_code, role, invited_by, created_at, expires_at, revoked_at
      )
      VALUES (?, ?, ?, ?, ?, 'staff', ?, ?, ?, NULL)
      `
    )
    .bind(crypto.randomUUID(), businessId, email, emailNormalized, inviteCode, locals.userId ?? null, now, expiresAt)
    .run();

  await writeAuditLog(db, {
    action: 'invite_created',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    email
  });

  const emailResult = await sendInviteEmail({
    env,
    origin: origin ?? 'https://nexusnorthsystems.com',
    inviteeEmail: email,
    inviteCode,
    expiresAt
  });

  return {
    success: true,
    message: emailResult.sent
      ? 'Invite created and email sent.'
      : `Invite created. ${emailResult.reason ?? 'Invite email was not sent.'}`
  };
}

export async function revokeUserInvite(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureBusinessSchema(db);

  const formData = await request.formData();
  const inviteId = String(formData.get('invite_id') ?? '').trim();
  if (!inviteId) return fail(400, { error: 'Missing invite id.' });

  await db
    .prepare(`UPDATE business_invites SET revoked_at = ? WHERE id = ? AND business_id = ?`)
    .bind(Math.floor(Date.now() / 1000), inviteId, businessId)
    .run();

  await writeAuditLog(db, {
    action: 'invite_revoked',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    metadata: { inviteId }
  });

  return { success: true };
}

export async function revokeEmployeeSessions(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) return fail(400, { error: 'Missing user id.' });
  if (userId === locals.userId) {
    return fail(400, { error: 'Use Profile & Settings to manage your own sessions.' });
  }
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'User not found in this business.' });
  }

  await revokeUserSessions(db, userId, { revokeDevices: false });
  await writeAuditLog(db, {
    action: 'admin_revoked_user_sessions',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    targetUserId: userId
  });

  return { success: true, message: 'Active sessions revoked.' };
}
