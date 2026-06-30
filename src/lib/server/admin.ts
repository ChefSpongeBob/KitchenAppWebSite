import { dev } from '$app/environment';
import { fail, redirect } from '@sveltejs/kit';
import type { ReadableStream as WorkerReadableStream } from '@cloudflare/workers-types';
import {
  ensureAnnouncementsSchema,
  loadHomepageAnnouncement,
  saveHomepageAnnouncement
} from '$lib/server/announcements';
import { ensureDailySpecialsSchema } from '$lib/server/dailySpecials';
import {
  ensureEmployeeSpotlightSchema,
  getEmployeeSpotlightId,
  loadEmployeeSpotlight
} from '$lib/server/employeeSpotlight';
import {
  ensureScheduleSchema,
  loadScheduleDepartmentApprovalsByUser,
  loadScheduleDepartments,
  loadScheduleManagerDepartments
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
import {
  canAccessEmployeeSensitiveData,
  decryptSensitiveJsonPayload,
  encryptSensitiveJsonPayload,
  HR_SENSITIVE_PERMISSION,
  isSensitiveEncryptionConfigured,
  isSensitiveOnboardingFormKey,
  sensitiveConfigurationFailure,
  writeSensitiveRecordAudit
} from '$lib/server/sensitive';
import {
  isBusinessAdminRole,
  ALL_BUSINESS_CAPABILITIES,
  defaultPermissionTemplateForRole,
  hasBusinessCapability,
  normalizeBusinessRole,
  normalizePermissionTemplate,
  resolveBusinessCapabilities,
  type BusinessCapability,
  type BusinessCapabilityOverrides
} from '$lib/server/permissions';
import {
  deleteAttachmentsForSourceItem,
  deleteAttachmentsForSourceItems,
  deleteAttachmentsForTarget,
  loadItemAttachmentsForItems,
  type ItemAttachment
} from '$lib/server/itemAttachments';
import { recordOperationalEventBestEffort } from '$lib/server/operationalEvents';
import { normalizeFormText, normalizePlainTextInput } from '$lib/server/inputSanitizer';

type D1 = App.Platform['env']['DB'];
let creatorCategoryRegistryEnsured = false;
let employeeProfilesTableEnsured = false;
let employeeProfileEditRequestsTableEnsured = false;
let employeeOnboardingTablesEnsured = false;
let userInvitesTableEnsured = false;
const WHITEBOARD_CLEANUP_BATCH_SIZE = 50;
const WHITEBOARD_CLEANUP_INTERVAL_SECONDS = 15 * 60;
const lastWhiteboardCleanupAtByBusiness = new Map<string, number>();

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
  attachments?: ItemAttachment[];
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
  attachments?: ItemAttachment[];
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

export type AdminReminder = {
  id: string;
  content: string;
  created_at: number;
  updated_at: number;
};

export type AdminUser = {
  id: string;
  display_name: string | null;
  email: string;
  role: string;
  permission_template: string;
  is_active: number;
  can_manage_specials: number;
  can_manage_announcements: number;
  approved_departments: ScheduleDepartment[];
  capability_overrides: BusinessCapabilityOverrides;
  effective_capabilities: BusinessCapability[];
};

export type AdminInvite = {
  id: string;
  email: string;
  invite_code: string;
  role: string;
  permission_template: string;
  employment_type: string;
  job_title: string;
  department: string;
  primary_schedule_department: string;
  schedule_departments: string[];
  start_date: string;
  pay_type: string;
  onboarding_required: number;
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
  sensitive_redacted?: boolean;
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
        ${adminOnly ? "AND role IN ('owner', 'admin', 'manager', 'general_manager', 'foh_manager', 'boh_manager', 'hourly_manager')" : ''}
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
  return '';
}

function isAllowedDocumentUpload(contentType: string, extension: string) {
  if (contentType === 'application/pdf') return true;
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType)) return true;
  return ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension);
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

  if (!isAllowedDocumentUpload(contentType, extension)) {
    throw new Error('Unsupported document type.');
  }

  const normalizedSlug = normalizeSlug(slug) || 'document';
  const key = `businesses/${businessId}/documents/${normalizedSlug}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  await bucket.put(key, file.stream() as unknown as WorkerReadableStream, {
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
  await bucket.put(key, file.stream() as unknown as WorkerReadableStream, {
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
  if (!dev) return true;

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
  if (!dev) return true;

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
  if (!dev) {
    creatorCategoryRegistryEnsured = true;
    return;
  }
  if (creatorCategoryRegistryEnsured) return;

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
  creatorCategoryRegistryEnsured = true;
}

export async function ensureEmployeeProfilesTable(db: D1) {
  if (!dev) {
    employeeProfilesTableEnsured = true;
    return;
  }
  if (employeeProfilesTableEnsured) return;

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
  employeeProfilesTableEnsured = true;
}

export async function ensureEmployeeProfileEditRequestsTable(db: D1) {
  if (!dev) {
    employeeProfileEditRequestsTableEnsured = true;
    return;
  }
  if (employeeProfileEditRequestsTableEnsured) return;

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
  employeeProfileEditRequestsTableEnsured = true;
}

export async function ensureEmployeeOnboardingTables(db: D1) {
  if (!dev) {
    employeeOnboardingTablesEnsured = true;
    return;
  }
  if (employeeOnboardingTablesEnsured) return;

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
  employeeOnboardingTablesEnsured = true;
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
  if (!dev) {
    userInvitesTableEnsured = true;
    return;
  }
  if (userInvitesTableEnsured) return;

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
  userInvitesTableEnsured = true;
}

function generateInviteCode() {
  return `INV-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

export async function loadAdminSections(db: D1, businessId: string) {
  await ensureTenantSchema(db);
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
        i.details,
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

  const itemIds = Array.from(grouped.values()).flatMap((section) => section.items.map((item) => item.id));
  const attachmentsByItem = await loadItemAttachmentsForItems(db, businessId, 'list_item', itemIds);
  for (const section of grouped.values()) {
    section.items = section.items.map((item) => ({
      ...item,
      attachments: attachmentsByItem.get(item.id) ?? []
    }));
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

  const itemIds = Array.from(grouped.values()).flatMap((section) => section.items.map((item) => item.id));
  const attachmentsByItem = await loadItemAttachmentsForItems(db, businessId, 'checklist_item', itemIds);
  for (const section of grouped.values()) {
    section.items = section.items.map((item) => ({
      ...item,
      attachments: attachmentsByItem.get(item.id) ?? []
    }));
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
  const recipes = new Map<string, string>();
  const documents = new Map<string, string>();
  const addRecipeCategory = (value: string) => {
    const category = normalizeCategoryName(value);
    if (category) recipes.set(category.toLowerCase(), category);
  };
  const addDocumentCategory = (value: string) => {
    const category = normalizeCategoryName(value);
    if (category) documents.set(category.toLowerCase(), category);
  };

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
      addRecipeCategory(String(row.category ?? ''));
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
      if (row.editor_type === 'recipe') addRecipeCategory(category);
      if (row.editor_type === 'document') addDocumentCategory(category);
    }
  } catch {
    // Leave empty when registry table is unavailable.
  }

  return {
    preplists: Array.from(preplists.values()),
    inventory: Array.from(inventory.values()),
    orders: Array.from(orders.values()),
    recipes: Array.from(recipes.values()).sort((a, b) => a.localeCompare(b)),
    documents: Array.from(documents.values()).sort((a, b) => a.localeCompare(b))
  };
}

export async function loadAdminDocumentCategories(db: D1, businessId: string) {
  await ensureTenantSchema(db);
  await ensureCreatorCategoryRegistry(db);

  const rows = await db
    .prepare(
      `
      SELECT category
      FROM creator_category_registry
      WHERE business_id = ?
        AND editor_type = 'document'
      ORDER BY category ASC
      `
    )
    .bind(businessId)
    .all<{ category: string }>();

  return Array.from(
    new Set(
      (rows.results ?? [])
        .map((row) => String(row.category ?? '').trim())
        .filter((category) => category.toLowerCase() !== 'menu')
        .filter(Boolean)
    )
  );
}

export async function loadAdminRecipeCategories(db: D1, businessId: string) {
  await ensureTenantSchema(db);
  await ensureCreatorCategoryRegistry(db);

  const rows = await db
    .prepare(
      `
      SELECT category
      FROM creator_category_registry
      WHERE business_id = ?
        AND editor_type = 'recipe'
      ORDER BY category ASC
      `
    )
    .bind(businessId)
    .all<{ category: string }>();

  return Array.from(
    new Set(
      (rows.results ?? [])
        .map((row) => normalizeCategoryName(String(row.category ?? '')))
        .filter(Boolean)
    )
  );
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

export async function loadAdminReminders(db: D1, businessId: string) {
  await ensureTenantSchema(db);
  if (!(await tableExists(db, 'admin_reminders'))) return [];

  const reminders = await db
    .prepare(
      `
      SELECT id, content, created_at, updated_at
      FROM admin_reminders
      WHERE business_id = ?
      ORDER BY updated_at DESC, created_at DESC
      `
    )
    .bind(businessId)
    .all<AdminReminder>();
  return reminders.results ?? [];
}

export async function loadAdminUsers(db: D1, businessId: string) {
  await ensureBusinessSchema(db);
  await ensureAnnouncementsSchema(db);
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
            COALESCE(bu.permission_template, bu.role, 'staff') AS permission_template,
            CASE WHEN COALESCE(u.is_active, 1) = 1 AND COALESCE(bu.is_active, 1) = 1 THEN 1 ELSE 0 END AS is_active,
            CASE WHEN dse.user_id IS NULL THEN 0 ELSE 1 END AS can_manage_specials,
            CASE WHEN ae.user_id IS NULL THEN 0 ELSE 1 END AS can_manage_announcements
          FROM business_users bu
          JOIN users u ON u.id = bu.user_id
          LEFT JOIN daily_specials_editors dse ON dse.user_id = u.id AND dse.business_id = ?
          LEFT JOIN announcement_editors ae ON ae.user_id = u.id AND ae.business_id = ?
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
            COALESCE(bu.permission_template, bu.role, 'staff') AS permission_template,
            COALESCE(bu.is_active, 1) AS is_active,
            CASE WHEN dse.user_id IS NULL THEN 0 ELSE 1 END AS can_manage_specials,
            CASE WHEN ae.user_id IS NULL THEN 0 ELSE 1 END AS can_manage_announcements
          FROM business_users bu
          JOIN users u ON u.id = bu.user_id
          LEFT JOIN daily_specials_editors dse ON dse.user_id = u.id AND dse.business_id = ?
          LEFT JOIN announcement_editors ae ON ae.user_id = u.id AND ae.business_id = ?
          WHERE bu.business_id = ?
          ORDER BY COALESCE(u.display_name, u.email) ASC
          `
        )
        .bind(businessId, businessId, businessId)
        .all<AdminUser>();

  const users = result.results ?? [];
  const [approvalsByUser, departments, capabilityOverrideRows] = await Promise.all([
    loadScheduleDepartmentApprovalsByUser(
      db,
      users.map((user) => user.id),
      businessId
    ),
    loadScheduleDepartments(db, businessId),
    db
      .prepare(
        `
        SELECT user_id, permission_key, is_enabled
        FROM employee_role_permissions
        WHERE business_id = ?
        `
      )
      .bind(businessId)
      .all<{ user_id: string; permission_key: string; is_enabled: number }>()
      .catch(() => ({ results: [] as Array<{ user_id: string; permission_key: string; is_enabled: number }> }))
  ]);
  const validCapabilities = new Set<string>(ALL_BUSINESS_CAPABILITIES);
  const capabilityOverridesByUser = new Map<string, BusinessCapabilityOverrides>();
  for (const row of capabilityOverrideRows.results ?? []) {
    if (!validCapabilities.has(row.permission_key)) continue;
    const overrides = capabilityOverridesByUser.get(row.user_id) ?? {};
    overrides[row.permission_key as BusinessCapability] = row.is_enabled === 1;
    capabilityOverridesByUser.set(row.user_id, overrides);
  }

  return users.map((user) => ({
    ...user,
    approved_departments:
      (approvalsByUser.get(user.id) ?? []).length > 0 || !isBusinessAdminRole(user.role)
        ? approvalsByUser.get(user.id) ?? []
        : departments,
    capability_overrides: capabilityOverridesByUser.get(user.id) ?? {},
    effective_capabilities: resolveBusinessCapabilities(
      user.role,
      user.permission_template,
      capabilityOverridesByUser.get(user.id) ?? {}
    )
  }));
}

export async function loadAdminInvites(db: D1, businessId: string) {
  await ensureBusinessSchema(db);

  const invites = await db
    .prepare(
      `
      SELECT
        id,
        email,
        invite_code,
        role,
        permission_template,
        employment_type,
        job_title,
        department,
        primary_schedule_department,
        schedule_departments_json,
        start_date,
        pay_type,
        onboarding_required,
        created_at,
        expires_at,
        used_at,
        revoked_at
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

  return (invites.results ?? []).map((invite) => ({
    ...invite,
    schedule_departments: parseScheduleDepartmentsJson(
      (invite as AdminInvite & { schedule_departments_json?: string }).schedule_departments_json,
      invite.primary_schedule_department || invite.department
    )
  }));
}

function normalizeInviteAccessType(value: string) {
  const normalized = normalizeBusinessRole(value);
  return normalized === 'user' ? 'staff' : normalized;
}

function canManageUserPermissions(locals: App.Locals) {
  return hasBusinessCapability(
    locals.businessRole,
    locals.businessPermissionTemplate,
    'manage_permissions',
    locals.businessCapabilities
  );
}

function isOwnerRole(role: string | null | undefined) {
  return normalizeBusinessRole(role) === 'owner';
}

function isManagerRole(role: string | null | undefined) {
  return normalizeBusinessRole(role) === 'manager';
}

function parseScheduleDepartmentsJson(value: string | null | undefined, fallback = '') {
  try {
    const parsed = JSON.parse(value || '[]');
    if (Array.isArray(parsed)) {
      const cleaned = parsed.map((item) => String(item ?? '').trim()).filter(Boolean);
      if (cleaned.length > 0) return Array.from(new Set(cleaned));
    }
  } catch {
    // Fall back to the legacy single-department fields below.
  }
  const normalizedFallback = fallback.trim();
  return normalizedFallback ? [normalizedFallback] : [];
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

export type EmployeePosPermissions = {
  pos_external_id: string;
  can_clock_in: number;
  can_use_pos: number;
  can_open_cash_drawer: number;
  can_refund: number;
  can_void: number;
  can_manager_override: number;
};

export type EmployeeCertification = {
  id: string;
  certification_type: string;
  title: string;
  issuer: string;
  certificate_number: string;
  file_url: string;
  file_name: string;
  issued_at: number | null;
  expires_at: number | null;
  status: string;
  reviewed_at: number | null;
  created_at: number;
  updated_at: number;
};

export type EmployeeVerificationCheck = {
  id: string;
  check_type: string;
  status: string;
  provider_reference: string;
  result_summary: string;
  requested_at: number | null;
  completed_at: number | null;
  reviewed_at: number | null;
  created_at: number;
  updated_at: number;
};

export type EmployeeDocumentAccessAudit = {
  id: string;
  action: string;
  actor_name: string | null;
  actor_email: string | null;
  created_at: number;
};

function emptyEmployeePosPermissions(): EmployeePosPermissions {
  return {
    pos_external_id: '',
    can_clock_in: 1,
    can_use_pos: 0,
    can_open_cash_drawer: 0,
    can_refund: 0,
    can_void: 0,
    can_manager_override: 0
  };
}

export async function loadEmployeeHrPosAccess(db: D1, userId: string, businessId = '') {
  const [pos, certifications, verificationChecks, directHrAccess, documentAudit] = await Promise.all([
    db
      .prepare(
        `
        SELECT
          pos_external_id,
          can_clock_in,
          can_use_pos,
          can_open_cash_drawer,
          can_refund,
          can_void,
          can_manager_override
        FROM employee_pos_permissions
        WHERE business_id = ? AND user_id = ?
        LIMIT 1
        `
      )
      .bind(businessId, userId)
      .first<EmployeePosPermissions>()
      .catch(() => null),
    db
      .prepare(
        `
        SELECT
          id,
          certification_type,
          title,
          issuer,
          certificate_number,
          file_url,
          file_name,
          issued_at,
          expires_at,
          status,
          reviewed_at,
          created_at,
          updated_at
        FROM employee_certifications
        WHERE business_id = ? AND user_id = ?
        ORDER BY COALESCE(expires_at, updated_at) ASC, updated_at DESC
        `
      )
      .bind(businessId, userId)
      .all<EmployeeCertification>()
      .catch(() => ({ results: [] as EmployeeCertification[] })),
    db
      .prepare(
        `
        SELECT
          id,
          check_type,
          status,
          provider_reference,
          result_summary,
          requested_at,
          completed_at,
          reviewed_at,
          created_at,
          updated_at
        FROM employee_verification_checks
        WHERE business_id = ? AND user_id = ?
        ORDER BY updated_at DESC
        `
      )
      .bind(businessId, userId)
      .all<EmployeeVerificationCheck>()
      .catch(() => ({ results: [] as EmployeeVerificationCheck[] })),
    db
      .prepare(
        `
        SELECT is_enabled
        FROM employee_role_permissions
        WHERE business_id = ? AND user_id = ? AND permission_key = ?
        LIMIT 1
        `
      )
      .bind(businessId, userId, HR_SENSITIVE_PERMISSION)
      .first<{ is_enabled: number }>()
      .catch(() => null),
    db
      .prepare(
        `
        SELECT
          audit.id,
          audit.action,
          actor.display_name AS actor_name,
          actor.email AS actor_email,
          audit.created_at
        FROM employee_document_access_audit audit
        LEFT JOIN users actor ON actor.id = audit.actor_user_id
        WHERE audit.business_id = ? AND audit.user_id = ?
        ORDER BY audit.created_at DESC
        LIMIT 12
        `
      )
      .bind(businessId, userId)
      .all<EmployeeDocumentAccessAudit>()
      .catch(() => ({ results: [] as EmployeeDocumentAccessAudit[] }))
  ]);

  return {
    pos: pos ?? emptyEmployeePosPermissions(),
    certifications: certifications.results ?? [],
    verificationChecks: verificationChecks.results ?? [],
    directHrAccess: directHrAccess?.is_enabled === 1,
    documentAudit: documentAudit.results ?? []
  };
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

function normalizeStateLabel(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase().slice(0, 24);
}

async function loadBusinessRegisteredState(db: D1, businessId: string) {
  await ensureBusinessSchema(db);
  const row = await db
    .prepare(`SELECT address_state FROM businesses WHERE id = ? LIMIT 1`)
    .bind(businessId)
    .first<{ address_state: string | null }>();
  return normalizeStateLabel(row?.address_state);
}

type DefaultEmployeeOnboardingItem = {
  item_type: EmployeeOnboardingItem['item_type'];
  form_key: string;
  title: string;
  description: string;
  source_file_url: string;
  source_file_name: string;
  sort_order: number;
};

function defaultEmployeeOnboardingItems(state = ''): DefaultEmployeeOnboardingItem[] {
  const normalizedState = normalizeStateLabel(state);
  const stateItems: DefaultEmployeeOnboardingItem[] = normalizedState
    ? [
        {
          item_type: 'form',
          form_key: 'state_withholding',
          title: `${normalizedState} withholding`,
          description: 'Complete state withholding details for payroll setup.',
          source_file_url: '',
          source_file_name: '',
          sort_order: 5
        }
      ]
    : [];
  const items: DefaultEmployeeOnboardingItem[] = [
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
      item_type: 'form',
      form_key: 'federal_i9',
      title: 'Federal I-9',
      description: 'Complete employee employment eligibility attestation.',
      source_file_url: '',
      source_file_name: '',
      sort_order: 3
    },
    {
      item_type: 'form',
      form_key: 'federal_w4',
      title: 'Federal W-4',
      description: 'Complete federal withholding information for payroll.',
      source_file_url: '',
      source_file_name: '',
      sort_order: 4
    },
    ...stateItems,
    {
      item_type: 'acknowledgement',
      form_key: '',
      title: 'Handbook acknowledgement',
      description: 'Review the employee handbook, then acknowledge and sign.',
      source_file_url: '',
      source_file_name: '',
      sort_order: normalizedState ? 6 : 5
    },
    {
      item_type: 'acknowledgement',
      form_key: '',
      title: 'Policy acknowledgement',
      description: 'Review attached company policies, then acknowledge and sign.',
      source_file_url: '',
      source_file_name: '',
      sort_order: normalizedState ? 7 : 6
    }
  ];

  return items;
}

export function buildEmployeeOnboardingRecommendations(state = '') {
  return defaultEmployeeOnboardingItems(state).map((item) => ({
    title: item.title,
    type: item.item_type,
    description: item.description,
    needsUpload: item.item_type === 'document'
  }));
}

export async function loadEmployeeOnboardingRecommendations(db: D1, businessId: string) {
  const state = await loadBusinessRegisteredState(db, businessId);
  return {
    state,
    items: buildEmployeeOnboardingRecommendations(state)
  };
}

type ComplianceClassification = {
  requirementKey: string;
  title: string;
  category: string;
  documentType: string;
  requiresDocument: boolean;
  requiresSignature: boolean;
  retentionYears: number | null;
  sensitiveScope: string | null;
  sensitiveRecordType: string | null;
};

function normalizeComplianceKey(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'general'
  );
}

function classifyOnboardingComplianceItem(item: {
  item_type: EmployeeOnboardingItem['item_type'];
  form_key: string;
  title: string;
}) {
  const title = item.title.trim();
  const lower = `${item.form_key} ${title}`.toLowerCase();
  const base = {
    title,
    requiresDocument: item.item_type === 'document',
    requiresSignature: item.item_type === 'form' || item.item_type === 'acknowledgement',
    retentionYears: null,
    sensitiveScope: null,
    sensitiveRecordType: null
  } satisfies Omit<ComplianceClassification, 'requirementKey' | 'category' | 'documentType'>;

  if (item.form_key === 'personal_information') {
    return {
      ...base,
      requirementKey: 'personal_information',
      category: 'profile',
      documentType: 'personal_information',
      sensitiveScope: 'personal',
      sensitiveRecordType: 'profile'
    };
  }
  if (item.form_key === 'emergency_contact') {
    return {
      ...base,
      requirementKey: 'emergency_contact',
      category: 'profile',
      documentType: 'emergency_contact',
      sensitiveScope: 'personal',
      sensitiveRecordType: 'emergency_contact'
    };
  }
  if (item.form_key === 'payroll_setup') {
    return {
      ...base,
      requirementKey: 'payroll_setup',
      category: 'payroll',
      documentType: 'payroll_setup',
      retentionYears: 4,
      sensitiveScope: 'bank',
      sensitiveRecordType: 'direct_deposit'
    };
  }
  if (lower.includes('i-9') || lower.includes('employment eligibility')) {
    return {
      ...base,
      requirementKey: 'i9_employment_eligibility',
      category: 'employment_eligibility',
      documentType: 'i9',
      sensitiveScope: 'identity',
      sensitiveRecordType: 'employment_eligibility'
    };
  }
  if (lower.includes('tax') || lower.includes('w-4') || lower.includes('withholding')) {
    return {
      ...base,
      requirementKey: 'tax_withholding',
      category: 'tax',
      documentType: 'tax_withholding',
      retentionYears: 4,
      sensitiveScope: 'tax',
      sensitiveRecordType: 'withholding'
    };
  }
  if (lower.includes('handbook')) {
    return {
      ...base,
      requirementKey: 'handbook_acknowledgement',
      category: 'policy',
      documentType: 'handbook_acknowledgement'
    };
  }
  if (lower.includes('food') || lower.includes('safety')) {
    return {
      ...base,
      requirementKey: 'food_safety_acknowledgement',
      category: 'certification',
      documentType: 'food_safety'
    };
  }

  return {
    ...base,
    requirementKey: normalizeComplianceKey(`${item.item_type}_${item.form_key || title}`),
    category: item.item_type === 'document' ? 'document' : item.item_type,
    documentType: normalizeComplianceKey(item.form_key || title)
  };
}

function complianceStatusFromOnboardingStatus(status: EmployeeOnboardingItem['status']) {
  if (status === 'needs_changes') return 'needs_changes';
  return status;
}

async function ensureEmployeeComplianceRequirement(
  db: D1,
  businessId: string,
  classification: ComplianceClassification,
  updatedBy: string | null,
  now: number
) {
  const existing = await db
    .prepare(
      `
      SELECT id
      FROM employee_compliance_requirements
      WHERE business_id = ? AND requirement_key = ?
      LIMIT 1
      `
    )
    .bind(businessId, classification.requirementKey)
    .first<{ id: string }>();
  if (existing?.id) return existing.id;

  const id = crypto.randomUUID();
  await db
    .prepare(
      `
      INSERT INTO employee_compliance_requirements (
        id,
        business_id,
        requirement_key,
        title,
        category,
        applies_to_type,
        is_required,
        requires_document,
        requires_signature,
        default_due_days,
        renewal_interval_days,
        retention_years,
        is_active,
        created_at,
        updated_at,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, 'employee', 1, ?, ?, NULL, NULL, ?, 1, ?, ?, ?)
      `
    )
    .bind(
      id,
      businessId,
      classification.requirementKey,
      classification.title,
      classification.category,
      classification.requiresDocument ? 1 : 0,
      classification.requiresSignature ? 1 : 0,
      classification.retentionYears,
      now,
      now,
      updatedBy
    )
    .run();
  return id;
}

async function ensureSensitiveVaultPlaceholder(
  db: D1,
  businessId: string,
  userId: string,
  classification: ComplianceClassification,
  updatedBy: string | null,
  now: number
) {
  if (!classification.sensitiveScope || !classification.sensitiveRecordType) return;

  await db
    .prepare(
      `
      INSERT INTO employee_sensitive_record_vault (
        id,
        business_id,
        user_id,
        record_scope,
        record_type,
        status,
        created_at,
        updated_at,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, 'empty', ?, ?, ?)
      ON CONFLICT(business_id, user_id, record_scope, record_type) DO UPDATE SET
        updated_at = employee_sensitive_record_vault.updated_at
      `
    )
    .bind(
      crypto.randomUUID(),
      businessId,
      userId,
      classification.sensitiveScope,
      classification.sensitiveRecordType,
      now,
      now,
      updatedBy
    )
    .run();
}

function sanitizeSensitiveOnboardingPayload(formKey: string, payload: Record<string, string>) {
  if (formKey === 'payroll_setup') {
    return {
      worker_classification: payload.worker_classification,
      start_date: payload.start_date,
      pay_type: payload.pay_type,
      direct_deposit_authorized: payload.direct_deposit_authorized,
      protected_record: 'Encrypted HR record'
    };
  }

  if (formKey === 'federal_i9') {
    return {
      citizenship_status: payload.citizenship_status,
      ssn_last_four: payload.ssn_last_four,
      document_choice: payload.document_choice,
      protected_record: 'Encrypted HR record'
    };
  }

  if (formKey === 'federal_w4') {
    return {
      filing_status: payload.filing_status,
      multiple_jobs: payload.multiple_jobs,
      extra_withholding: payload.extra_withholding,
      exempt: payload.exempt,
      protected_record: 'Encrypted HR record'
    };
  }

  if (formKey === 'state_withholding') {
    return {
      state: payload.state,
      filing_status: payload.filing_status,
      additional_withholding: payload.additional_withholding,
      exempt: payload.exempt,
      protected_record: 'Encrypted HR record'
    };
  }

  return {
    protected_record: 'Encrypted HR record'
  };
}

async function storeSensitiveOnboardingFormPayload(
  db: D1,
  env: Partial<App.Platform['env']> | undefined,
  item: Pick<EmployeeOnboardingItem, 'business_id' | 'user_id' | 'item_type' | 'form_key' | 'title'>,
  payload: Record<string, string>,
  updatedBy: string | null,
  now = Math.floor(Date.now() / 1000)
) {
  if (!isSensitiveOnboardingFormKey(item.form_key)) return null;
  if (!isSensitiveEncryptionConfigured(env)) throw new Error('sensitive_encryption_missing');

  const classification = classifyOnboardingComplianceItem(item);
  if (!classification.sensitiveScope || !classification.sensitiveRecordType) return null;

  await ensureSensitiveVaultPlaceholder(db, item.business_id, item.user_id, classification, updatedBy, now);
  const encrypted = await encryptSensitiveJsonPayload(env, payload, {
    businessId: item.business_id,
    userId: item.user_id,
    recordScope: classification.sensitiveScope,
    recordType: classification.sensitiveRecordType
  });
  const displayLastFour =
    payload.ssn_last_four ||
    payload.account_last_four ||
    payload.routing_last_four ||
    payload.postal_code?.slice(-4) ||
    '';

  const record = await db
    .prepare(
      `
      SELECT id
      FROM employee_sensitive_record_vault
      WHERE business_id = ?
        AND user_id = ?
        AND record_scope = ?
        AND record_type = ?
      LIMIT 1
      `
    )
    .bind(item.business_id, item.user_id, classification.sensitiveScope, classification.sensitiveRecordType)
    .first<{ id: string }>();

  await db
    .prepare(
      `
      UPDATE employee_sensitive_record_vault
      SET status = 'active',
        encrypted_payload = ?,
        payload_iv = ?,
        payload_tag = ?,
        key_version = ?,
        encryption_algorithm = ?,
        display_last_four = ?,
        updated_at = ?,
        updated_by = ?
      WHERE business_id = ?
        AND user_id = ?
        AND record_scope = ?
        AND record_type = ?
      `
    )
    .bind(
      encrypted.encryptedPayload,
      encrypted.payloadIv,
      encrypted.payloadTag,
      encrypted.keyVersion,
      encrypted.encryptionAlgorithm,
      displayLastFour,
      now,
      updatedBy,
      item.business_id,
      item.user_id,
      classification.sensitiveScope,
      classification.sensitiveRecordType
    )
    .run();

  if (record?.id) {
    await writeSensitiveRecordAudit(db, {
      businessId: item.business_id,
      userId: item.user_id,
      vaultRecordId: record.id,
      actorUserId: updatedBy,
      action: 'sensitive_record_encrypted_write',
      metadata: {
        recordScope: classification.sensitiveScope,
        recordType: classification.sensitiveRecordType
      }
    });
  }

  return record?.id ?? null;
}

async function decryptSensitiveOnboardingFormPayload(
  db: D1,
  env: Partial<App.Platform['env']> | undefined,
  item: Pick<EmployeeOnboardingItem, 'business_id' | 'user_id' | 'item_type' | 'form_key' | 'title'>,
  actorUserId: string | null | undefined,
  shouldAudit = false
) {
  if (!isSensitiveOnboardingFormKey(item.form_key) || !isSensitiveEncryptionConfigured(env)) return null;
  const classification = classifyOnboardingComplianceItem(item);
  if (!classification.sensitiveScope || !classification.sensitiveRecordType) return null;

  const record = await db
    .prepare(
      `
      SELECT
        id,
        encrypted_payload,
        payload_iv,
        key_version,
        encryption_algorithm
      FROM employee_sensitive_record_vault
      WHERE business_id = ?
        AND user_id = ?
        AND record_scope = ?
        AND record_type = ?
        AND status = 'active'
      LIMIT 1
      `
    )
    .bind(item.business_id, item.user_id, classification.sensitiveScope, classification.sensitiveRecordType)
    .first<{
      id: string;
      encrypted_payload: string;
      payload_iv: string;
      key_version: string;
      encryption_algorithm: string;
    }>();

  if (!record?.encrypted_payload) return null;

  const payload = await decryptSensitiveJsonPayload<Record<string, string>>(env, record, {
    businessId: item.business_id,
    userId: item.user_id,
    recordScope: classification.sensitiveScope,
    recordType: classification.sensitiveRecordType
  });

  if (payload && shouldAudit) {
    await writeSensitiveRecordAudit(db, {
      businessId: item.business_id,
      userId: item.user_id,
      vaultRecordId: record.id,
      actorUserId: actorUserId ?? null,
      action: 'sensitive_record_decrypted_read',
      metadata: {
        recordScope: classification.sensitiveScope,
        recordType: classification.sensitiveRecordType
      }
    });
  }

  return payload;
}

async function upsertComplianceDocumentForOnboardingItem(
  db: D1,
  item: Pick<
    EmployeeOnboardingItem,
    | 'id'
    | 'business_id'
    | 'user_id'
    | 'item_type'
    | 'form_key'
    | 'title'
    | 'status'
    | 'file_url'
    | 'file_name'
    | 'signed_name'
    | 'submitted_at'
    | 'reviewed_at'
    | 'reviewed_by'
  >,
  updatedBy: string | null,
  now = Math.floor(Date.now() / 1000)
) {
  const classification = classifyOnboardingComplianceItem(item);
  const requirementId = await ensureEmployeeComplianceRequirement(db, item.business_id, classification, updatedBy, now);
  await ensureSensitiveVaultPlaceholder(db, item.business_id, item.user_id, classification, updatedBy, now);

  await db
    .prepare(
      `
      INSERT INTO employee_compliance_documents (
        id,
        business_id,
        user_id,
        requirement_id,
        onboarding_item_id,
        document_type,
        status,
        file_url,
        file_name,
        signed_name,
        submitted_at,
        reviewed_at,
        reviewed_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(business_id, onboarding_item_id) DO UPDATE SET
        requirement_id = excluded.requirement_id,
        document_type = excluded.document_type,
        status = excluded.status,
        file_url = excluded.file_url,
        file_name = excluded.file_name,
        signed_name = excluded.signed_name,
        submitted_at = excluded.submitted_at,
        reviewed_at = excluded.reviewed_at,
        reviewed_by = excluded.reviewed_by,
        updated_at = excluded.updated_at
      `
    )
    .bind(
      crypto.randomUUID(),
      item.business_id,
      item.user_id,
      requirementId,
      item.id,
      classification.documentType,
      complianceStatusFromOnboardingStatus(item.status),
      item.file_url,
      item.file_name,
      item.signed_name,
      item.submitted_at,
      item.reviewed_at,
      item.reviewed_by,
      now,
      now
    )
    .run();
}

function normalizeOnboardingItemType(value: string): EmployeeOnboardingItem['item_type'] | null {
  if (value === 'form' || value === 'document' || value === 'acknowledgement') return value;
  if (value === 'profile') return 'form';
  return null;
}

function normalizeOnboardingFormKey(value: string, itemType: EmployeeOnboardingItem['item_type']) {
  if (itemType !== 'form') return '';
  const normalized = value.trim().toLowerCase();
  if (
    [
      'personal_information',
      'emergency_contact',
      'payroll_setup',
      'federal_i9',
      'federal_w4',
      'state_withholding'
    ].includes(normalized)
  ) {
    return normalized;
  }
  return 'personal_information';
}

function formString(formData: FormData, key: string, maxLength = 180) {
  return normalizeFormText(formData, key, { maxLength });
}

function formMultilineString(formData: FormData, key: string, maxLength = 1000) {
  return normalizeFormText(formData, key, { maxLength, multiline: true });
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

  if (formKey === 'federal_i9') {
    const fields = {
      legal_last_name: formString(formData, 'legal_last_name', 80),
      legal_first_name: formString(formData, 'legal_first_name', 80),
      other_last_names: formString(formData, 'other_last_names', 120),
      address_line_1: formString(formData, 'address_line_1', 120),
      city: formString(formData, 'city', 80),
      state: formString(formData, 'state', 80),
      postal_code: formString(formData, 'postal_code', 24),
      date_of_birth: formString(formData, 'date_of_birth', 10),
      ssn_last_four: formString(formData, 'ssn_last_four', 4),
      email: formString(formData, 'email', 160),
      phone: formString(formData, 'phone', 48),
      citizenship_status: formString(formData, 'citizenship_status', 48),
      document_choice: formString(formData, 'document_choice', 80),
      alien_registration_number: formString(formData, 'alien_registration_number', 80),
      i94_number: formString(formData, 'i94_number', 80),
      passport_number: formString(formData, 'passport_number', 80),
      passport_country: formString(formData, 'passport_country', 80)
    };
    if (
      !requireFormFields(fields, [
        'legal_last_name',
        'legal_first_name',
        'address_line_1',
        'city',
        'state',
        'postal_code',
        'date_of_birth',
        'citizenship_status'
      ])
    ) {
      return { error: 'Complete every required I-9 field.' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date_of_birth)) {
      return { error: 'Date of birth must use a valid date.' };
    }
    if (fields.ssn_last_four && !/^\d{4}$/.test(fields.ssn_last_four)) {
      return { error: 'SSN reference must be the last four digits.' };
    }
    return { payload: fields };
  }

  if (formKey === 'federal_w4') {
    const fields = {
      filing_status: formString(formData, 'filing_status', 48),
      multiple_jobs: String(formData.get('multiple_jobs') ?? '0') === '1' ? 'yes' : 'no',
      dependents_amount: formString(formData, 'dependents_amount', 16),
      other_income: formString(formData, 'other_income', 16),
      deductions: formString(formData, 'deductions', 16),
      extra_withholding: formString(formData, 'extra_withholding', 16),
      exempt: String(formData.get('exempt') ?? '0') === '1' ? 'yes' : 'no'
    };
    if (!requireFormFields(fields, ['filing_status'])) {
      return { error: 'Choose a federal filing status.' };
    }
    return { payload: fields };
  }

  if (formKey === 'state_withholding') {
    const fields = {
      state: formString(formData, 'state', 80),
      filing_status: formString(formData, 'filing_status', 48),
      allowances: formString(formData, 'allowances', 16),
      additional_withholding: formString(formData, 'additional_withholding', 16),
      exempt: String(formData.get('exempt') ?? '0') === '1' ? 'yes' : 'no',
      state_notes: formString(formData, 'state_notes', 240)
    };
    if (!requireFormFields(fields, ['state', 'filing_status'])) {
      return { error: 'Complete state and filing status for state withholding.' };
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
  const title = formString(formData, 'title', 160);
  const description = formMultilineString(formData, 'description', 1000);
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

export async function installStandardEmployeeOnboardingTemplate(_request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureEmployeeOnboardingTables(db);

  const state = await loadBusinessRegisteredState(db, businessId);
  await db
    .prepare(
      `
      UPDATE employee_onboarding_template_items
      SET item_type = 'form',
        form_key = CASE
          WHEN LOWER(title) LIKE '%i-9%' OR LOWER(title) LIKE '%employment eligibility%' THEN 'federal_i9'
          WHEN LOWER(title) LIKE '%w-4%' OR LOWER(title) LIKE '%federal withholding%' THEN 'federal_w4'
          WHEN LOWER(title) LIKE '%withholding%' THEN 'state_withholding'
          ELSE form_key
        END,
        updated_at = ?
      WHERE business_id = ?
        AND item_type = 'document'
        AND COALESCE(form_key, '') = ''
        AND (
          LOWER(title) LIKE '%i-9%'
          OR LOWER(title) LIKE '%employment eligibility%'
          OR LOWER(title) LIKE '%w-4%'
          OR LOWER(title) LIKE '%federal withholding%'
          OR LOWER(title) LIKE '%withholding%'
        )
      `
    )
    .bind(Math.floor(Date.now() / 1000), businessId)
    .run();

  const defaults = defaultEmployeeOnboardingItems(state);
  const existingRows = await db
    .prepare(
      `
      SELECT LOWER(title) AS title, item_type, COALESCE(form_key, '') AS form_key
      FROM employee_onboarding_template_items
      WHERE business_id = ?
      `
    )
    .bind(businessId)
    .all<{ title: string; item_type: string; form_key: string }>();
  const existingKeys = new Set(
    (existingRows.results ?? []).map(
      (row) => `${row.item_type}:${row.form_key}:${String(row.title ?? '').trim().toLowerCase()}`
    )
  );

  const now = Math.floor(Date.now() / 1000);
  let created = 0;

  for (const item of defaults) {
    const key = `${item.item_type}:${item.form_key}:${item.title.trim().toLowerCase()}`;
    if (existingKeys.has(key)) continue;

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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        `
      )
      .bind(
        crypto.randomUUID(),
        businessId,
        item.item_type,
        item.form_key,
        item.title,
        item.description,
        item.source_file_url,
        item.source_file_name,
        item.sort_order,
        now,
        now,
        locals.userId ?? null
      )
      .run();
    created += 1;
  }

  return {
    success: true,
    message: created ? 'Standard packet added.' : 'Standard packet already exists.'
  };
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
  const title = formString(formData, 'title', 160);
  const description = formMultilineString(formData, 'description', 1000);
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

  if (status === 'approved') {
    await db
      .prepare(
        `
        UPDATE employee_employment_records
        SET employment_status = CASE
            WHEN employment_status = 'terminated' THEN employment_status
            ELSE 'active'
          END,
          updated_at = ?,
          updated_by = COALESCE(?, updated_by)
        WHERE business_id = ?
          AND onboarding_package_id = ?
        `
      )
      .bind(now, reviewer, businessId, packageId)
      .run();
  }
}

function profilePayloadForCompletedOnboardingItem(
  profile: AdminEmployeeProfile,
  formKey: string,
  fallbackLegalName = ''
) {
  if (formKey === 'personal_information') {
    const payload = {
      legal_name: profile.real_name || fallbackLegalName,
      preferred_name: '',
      birthday: profile.birthday,
      phone: profile.phone,
      address_line_1: profile.address_line_1,
      address_line_2: profile.address_line_2,
      city: profile.city,
      state: profile.state,
      postal_code: profile.postal_code
    };
    return requireFormFields(payload, ['legal_name', 'birthday', 'phone', 'address_line_1', 'city', 'state', 'postal_code'])
      ? payload
      : null;
  }

  if (formKey === 'emergency_contact') {
    const payload = {
      emergency_contact_name: profile.emergency_contact_name,
      emergency_contact_phone: profile.emergency_contact_phone,
      emergency_contact_relationship: profile.emergency_contact_relationship
    };
    return requireFormFields(payload, [
      'emergency_contact_name',
      'emergency_contact_phone',
      'emergency_contact_relationship'
    ])
      ? payload
      : null;
  }

  return null;
}

async function hydrateProfileBackedOnboardingItems(
  db: D1,
  userId: string,
  businessId: string,
  packageSentAt: number,
  items: EmployeeOnboardingItem[],
  packageId?: string
) {
  if (!items.some((item) => item.status === 'pending' && (item.form_key === 'personal_information' || item.form_key === 'emergency_contact'))) {
    return items;
  }

  const profile = await loadAdminEmployeeProfile(db, userId, businessId);
  const user = await db
    .prepare(
      `
      SELECT display_name, email
      FROM users
      WHERE id = ?
      LIMIT 1
      `
    )
    .bind(userId)
    .first<{ display_name: string | null; email: string | null }>();
  const fallbackLegalName = String(user?.display_name || user?.email || '').trim();
  const now = Math.floor(Date.now() / 1000);
  const completedItems: EmployeeOnboardingItem[] = [];

  const hydrated = items.map((item) => {
    if (item.status !== 'pending') return item;
    const payload = profilePayloadForCompletedOnboardingItem(profile, item.form_key, fallbackLegalName);
    if (!payload) return item;
    const updated = {
      ...item,
      status: 'submitted' as const,
      form_payload: item.form_payload || JSON.stringify({ protected_record: 'Profile record' }),
      submitted_at: item.submitted_at ?? packageSentAt
    };
    completedItems.push(updated);
    return updated;
  });

  if (packageId && completedItems.length > 0) {
    await db.batch(
      completedItems.map((item) =>
        db
          .prepare(
            `
            UPDATE employee_onboarding_items
            SET status = 'submitted',
              form_payload = CASE WHEN COALESCE(form_payload, '') = '' THEN ? ELSE form_payload END,
              submitted_at = COALESCE(submitted_at, ?),
              reviewed_at = NULL,
              reviewed_by = NULL,
              manager_note = ''
            WHERE id = ? AND package_id = ? AND business_id = ? AND status = 'pending'
            `
          )
          .bind(item.form_payload || JSON.stringify({ protected_record: 'Profile record' }), item.submitted_at ?? now, item.id, packageId, businessId)
      )
    );

    for (const item of completedItems) {
      await upsertComplianceDocumentForOnboardingItem(
        db,
        {
          ...item,
          status: 'submitted',
          file_url: item.file_url ?? '',
          file_name: item.file_name ?? '',
          signed_name: item.signed_name ?? '',
          submitted_at: item.submitted_at ?? now,
          reviewed_at: null,
          reviewed_by: null
        },
        userId,
        now
      );
    }

    await refreshEmployeeOnboardingPackageStatus(db, packageId, businessId);
  }

  return hydrated;
}

export async function loadEmployeeOnboarding(
  db: D1,
  userId: string,
  businessId: string,
  options: {
    env?: Partial<App.Platform['env']>;
    actorUserId?: string | null;
    actorBusinessRole?: string | null;
    actorPermissionTemplate?: string | null;
    actorCapabilities?: readonly import('$lib/server/permissions').BusinessCapability[] | null;
    auditSensitiveRead?: boolean;
  } = {}
): Promise<EmployeeOnboardingState> {
  await ensureEmployeeOnboardingTables(db);
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

  if (membership?.is_active === 1 && normalizeBusinessRole(membership.role) === 'owner') {
    return { package: null, items: [] };
  }

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

  const rawItems = await hydrateProfileBackedOnboardingItems(
    db,
    userId,
    businessId,
    onboardingPackage.sent_at,
    items.results ?? [],
    onboardingPackage.id
  );
  const canReadSensitive = await canAccessEmployeeSensitiveData(
    db,
    businessId,
    options.actorUserId ?? null,
    options.actorBusinessRole ?? null,
    userId,
    options.actorPermissionTemplate ?? null,
    options.actorCapabilities ?? null
  );

  const hydratedItems = await Promise.all(
    rawItems.map(async (item) => {
      if (!isSensitiveOnboardingFormKey(item.form_key)) return item;

      if (!canReadSensitive) {
        return {
          ...item,
          form_payload: item.form_payload || JSON.stringify(sanitizeSensitiveOnboardingPayload(item.form_key, {})),
          sensitive_redacted: true
        };
      }

      const decrypted = await decryptSensitiveOnboardingFormPayload(
        db,
        options.env,
        item,
        options.actorUserId ?? null,
        Boolean(options.auditSensitiveRead && options.actorUserId && options.actorUserId !== userId)
      );
      if (!decrypted) return item;
      return {
        ...item,
        form_payload: JSON.stringify(decrypted),
        sensitive_redacted: false
      };
    })
  );

  return {
    package: onboardingPackage,
    items: hydratedItems
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
    .bind(options.businessId, options.userId)
    .first<{ role: string | null; is_active: number }>();

  if (membership && normalizeBusinessRole(membership.role) === 'owner') {
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `
        UPDATE employee_employment_records
        SET employment_status = CASE
            WHEN employment_status = 'terminated' THEN employment_status
            ELSE 'active'
          END,
          employment_type = 'owner',
          onboarding_package_id = NULL,
          updated_at = ?,
          updated_by = COALESCE(?, updated_by)
        WHERE business_id = ? AND user_id = ?
        `
      )
      .bind(now, options.createdBy ?? null, options.businessId, options.userId)
      .run();
    return { created: false, packageId: null, status: 'not_required' as const };
  }

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
  const businessState = await loadBusinessRegisteredState(db, options.businessId);
  const onboardingItems = templateItems.length > 0 ? templateItems : defaultEmployeeOnboardingItems(businessState);

  for (const item of onboardingItems) {
    const onboardingItemId = crypto.randomUUID();
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
        onboardingItemId,
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

    await upsertComplianceDocumentForOnboardingItem(
      db,
      {
        id: onboardingItemId,
        business_id: options.businessId,
        user_id: options.userId,
        item_type: item.item_type,
        form_key: item.form_key,
        title: item.title,
        status: 'pending',
        file_url: '',
        file_name: '',
        signed_name: '',
        submitted_at: null,
        reviewed_at: null,
        reviewed_by: null
      },
      options.createdBy ?? null,
      now
    );
  }

  await db
    .prepare(
      `
      INSERT INTO employee_employment_records (
        business_id,
        user_id,
        employment_status,
        employment_type,
        onboarding_package_id,
        created_at,
        updated_at,
        updated_by
      )
      VALUES (?, ?, 'onboarding', ?, ?, ?, ?, ?)
      ON CONFLICT(business_id, user_id) DO UPDATE SET
        employment_status = CASE
          WHEN employee_employment_records.employment_status = 'terminated' THEN employee_employment_records.employment_status
          WHEN employee_employment_records.employment_type = 'owner' THEN 'active'
          ELSE 'onboarding'
        END,
        employment_type = CASE
          WHEN employee_employment_records.employment_type = 'owner' THEN employee_employment_records.employment_type
          ELSE excluded.employment_type
        END,
        onboarding_package_id = CASE
          WHEN employee_employment_records.employment_type = 'owner' THEN employee_employment_records.onboarding_package_id
          ELSE excluded.onboarding_package_id
        END,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
      `
    )
    .bind(
      options.businessId,
      options.userId,
      payrollClassification,
      packageId,
      now,
      now,
      options.createdBy ?? null
    )
    .run();

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

  if (!membership || membership.is_active !== 1) {
    return { required: false, approved: true, status: 'not_required' as const };
  }

  await ensureEmployeeOnboardingTables(db);
  const employment = await db
    .prepare(
      `
      SELECT employment_type
      FROM employee_employment_records
      WHERE business_id = ? AND user_id = ?
      LIMIT 1
      `
    )
    .bind(businessId, userId)
    .first<{ employment_type: string | null }>();
  const employmentType = String(employment?.employment_type ?? '').trim().toLowerCase();
  const businessRole = normalizeBusinessRole(membership.role);
  if (employmentType === 'contractor' || employmentType === 'owner' || businessRole === 'owner') {
    if (businessRole === 'owner' && employmentType !== 'owner') {
      const now = Math.floor(Date.now() / 1000);
      await db
        .prepare(
          `
          UPDATE employee_employment_records
          SET employment_status = CASE
              WHEN employment_status = 'terminated' THEN employment_status
              ELSE 'active'
            END,
            employment_type = 'owner',
            onboarding_package_id = NULL,
            updated_at = ?,
            updated_by = COALESCE(?, updated_by)
          WHERE business_id = ? AND user_id = ?
          `
        )
        .bind(now, createdBy ?? null, businessId, userId)
        .run();
    }
    return { required: false, approved: true, status: 'not_required' as const };
  }

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

  if (isBusinessAdminRole(membership.role) && !employmentType) {
    return { required: false, approved: true, status: 'not_required' as const };
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
  const employmentRows = await db
    .prepare(
      `
      SELECT user_id, employment_type
      FROM employee_employment_records
      WHERE business_id = ?
      `
    )
    .bind(businessId)
    .all<{ user_id: string; employment_type: string | null }>();
  const employmentTypeByUser = new Map(
    (employmentRows.results ?? []).map((row) => [
      row.user_id,
      String(row.employment_type ?? '').trim().toLowerCase()
    ])
  );

  return users
    .filter((user) => {
      if (normalizeBusinessRole(user.role) === 'owner') return false;
      const employmentType = employmentTypeByUser.get(user.id) ?? '';
      if (employmentType === 'contractor') return false;
      if (latestPackageByUser.has(user.id)) return true;
      if (employmentType === 'employee') return true;
      return !isBusinessAdminRole(user.role);
    })
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

  const now = Math.floor(Date.now() / 1000);
  const lastCleanupAt = lastWhiteboardCleanupAtByBusiness.get(businessId) ?? 0;
  if (now - lastCleanupAt < WHITEBOARD_CLEANUP_INTERVAL_SECONDS) return;
  lastWhiteboardCleanupAtByBusiness.set(businessId, now);

  const cutoff = now - 60 * 60 * 24 * 7;
  const rejected = await db
    .prepare(
      `
      SELECT post_id
      FROM whiteboard_review
      WHERE status = 'rejected'
        AND COALESCE(reviewed_at, 0) < ?
        AND business_id = ?
      ORDER BY COALESCE(reviewed_at, 0) ASC
      LIMIT ?
      `
    )
    .bind(cutoff, businessId, WHITEBOARD_CLEANUP_BATCH_SIZE)
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
  const title = formString(formData, 'title', 120);
  const requestedSlug = String(formData.get('slug') ?? '').trim();
  const description = formMultilineString(formData, 'description', 400);
  const firstItem = formString(formData, 'first_item', 160);
  const firstDetails = formMultilineString(formData, 'first_details', 500);
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
  const title = formString(formData, 'title', 120);
  const description = formMultilineString(formData, 'description', 400);

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

  const items = await db
    .prepare(`SELECT id FROM list_items WHERE section_id = ? AND business_id = ?`)
    .bind(sectionId, businessId)
    .all<{ id: string }>();
  await deleteAttachmentsForSourceItems(
    db,
    businessId,
    'list_item',
    (items.results ?? []).map((item) => item.id)
  );
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
  const title = formString(formData, 'title', 120);
  const requestedSlug = String(formData.get('slug') ?? '').trim();
  const description = formMultilineString(formData, 'description', 400);
  const baseSlug = normalizeSlug(requestedSlug || title);

  if (!title) return fail(400, { error: 'Checklist category title is required.' });
  if (!baseSlug || !/^[a-z0-9-]+$/.test(baseSlug)) {
    return fail(400, { error: 'Checklist category slug can only use letters, numbers, and hyphens.' });
  }

  if (!(await tableExists(db, 'checklist_sections')) || !(await tableExists(db, 'checklist_items'))) {
    return fail(503, { error: 'Checklist tables are not available yet.' });
  }

  const sections = [{ slug: baseSlug, title: checklistSectionTitle(title) }];

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

function checklistCategoryBaseTitle(title: string) {
  return title.trim().replace(/\s+checklist$/i, '').trim() || title.trim();
}

function checklistSectionTitle(title: string) {
  const baseTitle = checklistCategoryBaseTitle(title);
  return `${baseTitle} Checklist`;
}

export async function updateChecklistCategory(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const previousBaseSlug = normalizeSlug(String(formData.get('base_slug') ?? ''));
  const nextTitle = formString(formData, 'title', 120);
  const nextBaseSlug = normalizeSlug(String(formData.get('next_slug') ?? nextTitle));
  const description = formMultilineString(formData, 'description', 400);

  if (!previousBaseSlug || !nextTitle) {
    return fail(400, { error: 'Checklist category title is required.' });
  }
  if (!nextBaseSlug || !/^[a-z0-9-]+$/.test(nextBaseSlug)) {
    return fail(400, { error: 'Checklist category slug can only use letters, numbers, and hyphens.' });
  }

  const sections = await db
    .prepare(
      `
      SELECT id, slug
      FROM checklist_sections
      WHERE business_id = ? AND slug = ?
      ORDER BY slug ASC
      `
    )
    .bind(businessId, previousBaseSlug)
    .all<{ id: string; slug: string }>();

  const currentSections = sections.results ?? [];
  if (currentSections.length === 0) {
    return fail(404, { error: 'Checklist category not found.' });
  }

  const currentIds = new Set(currentSections.map((section) => section.id));
  const conflict = await db
    .prepare(
      `
      SELECT id
      FROM checklist_sections
      WHERE business_id = ? AND slug = ?
      LIMIT 1
      `
    )
    .bind(businessId, nextBaseSlug)
    .first<{ id: string }>();
  if (conflict && !currentIds.has(conflict.id)) {
    return fail(400, { error: `Checklist section slug "${nextBaseSlug}" already exists.` });
  }

  const now = Math.floor(Date.now() / 1000);
  for (const section of currentSections) {
    await db
      .prepare(
        `
        UPDATE checklist_sections
        SET slug = ?, title = ?, description = ?, updated_at = ?
        WHERE id = ? AND business_id = ?
        `
      )
      .bind(nextBaseSlug, checklistSectionTitle(nextTitle), description || null, now, section.id, businessId)
      .run();
  }

  return { success: true };
}

export async function deleteChecklistCategory(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const baseSlug = normalizeSlug(String(formData.get('base_slug') ?? ''));
  if (!baseSlug) return fail(400, { error: 'Missing checklist category.' });

  const sections = await db
    .prepare(
      `
      SELECT id
      FROM checklist_sections
      WHERE business_id = ? AND slug = ?
      `
    )
    .bind(businessId, baseSlug)
    .all<{ id: string }>();

  const sectionIds = (sections.results ?? []).map((section) => section.id);
  if (sectionIds.length === 0) return fail(404, { error: 'Checklist category not found.' });

  for (const sectionId of sectionIds) {
    const items = await db
      .prepare(`SELECT id FROM checklist_items WHERE section_id = ? AND business_id = ?`)
      .bind(sectionId, businessId)
      .all<{ id: string }>();
    await deleteAttachmentsForSourceItems(
      db,
      businessId,
      'checklist_item',
      (items.results ?? []).map((item) => item.id)
    );
    await db.prepare(`DELETE FROM checklist_items WHERE section_id = ? AND business_id = ?`).bind(sectionId, businessId).run();
    await db.prepare(`DELETE FROM checklist_sections WHERE id = ? AND business_id = ?`).bind(sectionId, businessId).run();
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
  const content = formMultilineString(formData, 'content', 500);
  const details = formMultilineString(formData, 'details', 500);
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
  const content = formMultilineString(formData, 'content', 500);
  const details = formMultilineString(formData, 'details', 500);
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

  await deleteAttachmentsForSourceItem(db, businessId, 'list_item', id);
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
  const content = formString(formData, 'content', 180);
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
  const content = formString(formData, 'content', 180);
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

  await deleteAttachmentsForSourceItem(db, businessId, 'checklist_item', id);
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
  const title = normalizeFormText(f, 'title', { maxLength: 160 });
  const category = normalizeCategoryName(String(f.get('category') ?? ''));
  const ingredients = normalizeFormText(f, 'ingredients', { maxLength: 4000, multiline: true });
  const materialsNeeded = normalizePlainTextInput(f.get('materials_needed') ?? f.get('procedure'), {
    maxLength: 3000,
    multiline: true
  });
  const instruction = normalizeFormText(f, 'instruction', { maxLength: 6000, multiline: true });
  const fallbackInstructions = normalizeFormText(f, 'instructions', { maxLength: 9000, multiline: true });

  const instructions = materialsNeeded && instruction
    ? `Materials needed:\n${materialsNeeded}\n\nInstruction:\n${instruction}`
    : fallbackInstructions;

  if (!title || !category || !ingredients || !instructions) {
    return fail(400, { error: 'All recipe fields are required.' });
  }
  await ensureCreatorCategoryRegistry(db);
  await db
    .prepare(
      `
      INSERT INTO recipes (title, category, ingredients, instructions, created_at, business_id)
      VALUES (?, ?, ?, ?, datetime('now'), ?)
      `
    )
    .bind(title, category, ingredients, instructions, businessId)
    .run();
  await db
    .prepare(
      `
      INSERT OR IGNORE INTO creator_category_registry (id, business_id, editor_type, category, created_at)
      VALUES (?, ?, 'recipe', ?, ?)
      `
    )
    .bind(crypto.randomUUID(), businessId, category, Math.floor(Date.now() / 1000))
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
  const title = normalizeFormText(f, 'title', { maxLength: 160 });
  const category = normalizeCategoryName(String(f.get('category') ?? ''));
  const ingredients = normalizeFormText(f, 'ingredients', { maxLength: 4000, multiline: true });
  const materialsNeeded = normalizePlainTextInput(f.get('materials_needed') ?? f.get('procedure'), {
    maxLength: 3000,
    multiline: true
  });
  const instruction = normalizeFormText(f, 'instruction', { maxLength: 6000, multiline: true });
  const fallbackInstructions = normalizeFormText(f, 'instructions', { maxLength: 9000, multiline: true });

  const instructions =
    materialsNeeded && instruction
      ? `Materials needed:\n${materialsNeeded}\n\nInstruction:\n${instruction}`
      : fallbackInstructions;

  if (!Number.isFinite(id)) return fail(400, { error: 'Invalid recipe id.' });
  if (!title || !category || !ingredients || !instructions) {
    return fail(400, { error: 'All recipe fields are required.' });
  }
  await ensureCreatorCategoryRegistry(db);

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
  await db
    .prepare(
      `
      INSERT OR IGNORE INTO creator_category_registry (id, business_id, editor_type, category, created_at)
      VALUES (?, ?, 'recipe', ?, ?)
      `
    )
    .bind(crypto.randomUUID(), businessId, category, Math.floor(Date.now() / 1000))
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

  await deleteAttachmentsForTarget(db, businessId, 'recipe', String(id));
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
  const title = formString(formData, 'title', 160);
  const description = formMultilineString(formData, 'description', 600);
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

export async function createAdminReminder(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const content = formString(formData, 'content', 180);
  if (!content) return fail(400, { error: 'Reminder is required.' });

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      INSERT INTO admin_reminders (id, business_id, content, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(crypto.randomUUID(), businessId, content, locals.userId ?? null, locals.userId ?? null, now, now)
    .run();

  return { success: true };
}

export async function updateAdminReminder(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '').trim();
  const content = formString(formData, 'content', 180);
  if (!id || !content) return fail(400, { error: 'Reminder is required.' });

  await db
    .prepare(
      `
      UPDATE admin_reminders
      SET content = ?, updated_by = ?, updated_at = ?
      WHERE id = ? AND business_id = ?
      `
    )
    .bind(content, locals.userId ?? null, Math.floor(Date.now() / 1000), id, businessId)
    .run();

  return { success: true };
}

export async function deleteAdminReminder(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureTenantSchema(db);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return fail(400, { error: 'Missing reminder id.' });

  await db.prepare(`DELETE FROM admin_reminders WHERE id = ? AND business_id = ?`).bind(id, businessId).run();
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
  const title = formString(formData, 'title', 180);
  const section = formString(formData, 'section', 80) || 'Docs';
  const category = formString(formData, 'category', 120) || 'General';
  const providedSlug = normalizeSlug(rawSlug === 'custom' ? customSlug : rawSlug);
  const slug = providedSlug || normalizeSlug(title) || normalizeSlug(category) || 'document';
  const content = formMultilineString(formData, 'content', 2000);
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

    try {
      const uploaded = await uploadDocumentMedia(locals.MEDIA_BUCKET, businessId, slug, upload);
      fileUrl = uploaded.url;
    } catch {
      return fail(503, { error: 'File upload storage is unavailable locally.' });
    }
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
  const title = formString(formData, 'title', 180);
  const section = formString(formData, 'section', 80) || 'Docs';
  const category = formString(formData, 'category', 120) || 'General';
  const providedSlug = normalizeSlug(rawSlug === 'custom' ? customSlug : rawSlug);
  const slug = providedSlug || normalizeSlug(title) || normalizeSlug(category) || 'document';
  const content = formMultilineString(formData, 'content', 2000);
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

    try {
      const uploaded = await uploadDocumentMedia(locals.MEDIA_BUCKET, businessId, slug, upload);
      const previousKey = documentMediaKeyFromUrl(existingFileUrl);
      if (previousKey && previousKey !== uploaded.key) {
        await locals.MEDIA_BUCKET.delete(previousKey);
      }
      fileUrl = uploaded.url;
    } catch {
      return fail(503, { error: 'File upload storage is unavailable locally.' });
    }
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

  await deleteAttachmentsForTarget(db, businessId, 'document', id);
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
  const content = formMultilineString(formData, 'content', 2000);
  await saveHomepageAnnouncement(db, businessId, locals.userId, content);

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
  const employeeName = formString(formData, 'employee_name', 120);
  const shoutout = formMultilineString(formData, 'shoutout', 500);
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
  if (!canManageUserPermissions(locals)) return fail(403, { error: 'Permission access required.' });
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
      SET role = 'manager', permission_template = 'general_manager', is_active = 1, updated_at = ?
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

export async function removeUserAdmin(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  if (!canManageUserPermissions(locals)) return fail(403, { error: 'Permission access required.' });
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) return fail(400, { error: 'Missing user id.' });
  if (userId === locals.userId) return fail(400, { error: 'You cannot restrict your own manager access.' });
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'User not found in this business.' });
  }

  const businessUser = await db
    .prepare(`SELECT role FROM business_users WHERE business_id = ? AND user_id = ? LIMIT 1`)
    .bind(businessId, userId)
    .first<{ role: string }>();

  if (!businessUser) return fail(404, { error: 'User not found in this business.' });
  if (businessUser.role === 'owner') return fail(400, { error: 'Owner access cannot be restricted here.' });
  if (!isBusinessAdminRole(businessUser.role)) return { success: true };
  if ((await countAdmins(db, businessId)) <= 1) {
    return fail(400, { error: 'At least one management account must remain active.' });
  }

  await db
    .prepare(
      `
      UPDATE business_users
      SET role = 'staff', permission_template = 'staff', updated_at = ?
      WHERE business_id = ? AND user_id = ?
      `
    )
    .bind(Math.floor(Date.now() / 1000), businessId, userId)
    .run();

  await writeAuditLog(db, {
    action: 'admin_role_restricted',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    targetUserId: userId
  });

  return { success: true };
}

export async function updateUserBusinessPermissions(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  if (!canManageUserPermissions(locals)) return fail(403, { error: 'Permission access required.' });
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  const role = normalizeInviteAccessType(String(formData.get('business_role') ?? 'staff'));
  const permissionTemplate = normalizePermissionTemplate(String(formData.get('permission_template') ?? role));
  if (!userId) return fail(400, { error: 'Missing user id.' });
  if (userId === locals.userId && role !== 'owner' && (await countAdmins(db, businessId)) <= 1) {
    return fail(400, { error: 'At least one management account must remain active.' });
  }
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'User not found in this business.' });
  }

  const current = await db
    .prepare(`SELECT role FROM business_users WHERE business_id = ? AND user_id = ? LIMIT 1`)
    .bind(businessId, userId)
    .first<{ role: string }>();
  if (!current) return fail(404, { error: 'User not found in this business.' });
  const actorIsOwner = isOwnerRole(locals.businessRole);
  if (isOwnerRole(current.role) && role !== 'owner') {
    return fail(400, { error: 'Owner access cannot be changed here.' });
  }
  if (!actorIsOwner && (userId === locals.userId || isOwnerRole(current.role) || isManagerRole(current.role))) {
    return fail(403, { error: 'Only the owner can change manager access.' });
  }
  if (!actorIsOwner && isManagerRole(role)) {
    return fail(403, { error: 'Only the owner can grant manager access.' });
  }
  if (
    !actorIsOwner &&
    resolveBusinessCapabilities(role, permissionTemplate).some(
      (capability) => capability === 'admin_access' || capability === 'manage_permissions'
    )
  ) {
    return fail(403, { error: 'Only the owner can grant manager access.' });
  }
  if (role === 'owner' && !isOwnerRole(current.role)) {
    return fail(400, { error: 'Owner access cannot be assigned here.' });
  }

  await ensureBusinessSchema(db);
  await db
    .prepare(
      `
      UPDATE business_users
      SET role = ?, permission_template = ?, is_active = 1, updated_at = ?
      WHERE business_id = ? AND user_id = ?
      `
    )
    .bind(role, permissionTemplate, Math.floor(Date.now() / 1000), businessId, userId)
    .run();

  await writeAuditLog(db, {
    action: 'business_permissions_updated',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    targetUserId: userId,
    metadata: { role, permissionTemplate }
  });

  return { success: true, message: 'Permissions updated.' };
}

export async function updateUserCapabilityOverrides(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  if (!canManageUserPermissions(locals)) return fail(403, { error: 'Permission access required.' });
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) return fail(400, { error: 'Missing user id.' });

  const target = await db
    .prepare(
      `
      SELECT role, COALESCE(permission_template, role, 'staff') AS permission_template
      FROM business_users
      WHERE business_id = ? AND user_id = ?
      LIMIT 1
      `
    )
    .bind(businessId, userId)
    .first<{ role: string; permission_template: string }>();
  if (!target) return fail(404, { error: 'User not found in this business.' });

  const actorIsOwner = isOwnerRole(locals.businessRole);
  if (isOwnerRole(target.role)) return fail(400, { error: 'Owner permissions are locked.' });
  if (!actorIsOwner && (userId === locals.userId || isManagerRole(target.role))) {
    return fail(403, { error: 'Only the owner can change manager permissions.' });
  }

  const selected = new Set(
    formData
      .getAll('capabilities')
      .map((value) => String(value ?? '').trim())
      .filter((value): value is BusinessCapability =>
        ALL_BUSINESS_CAPABILITIES.includes(value as BusinessCapability)
      )
  );
  if (!actorIsOwner && (selected.has('admin_access') || selected.has('manage_permissions'))) {
    return fail(403, { error: 'Only the owner can grant manager access.' });
  }
  const actorCapabilities = new Set(locals.businessCapabilities ?? []);
  const targetDefaults = new Set(resolveBusinessCapabilities(target.role, target.permission_template));
  const now = Math.floor(Date.now() / 1000);
  const statements: Array<ReturnType<D1['prepare']>> = [];

  for (const capability of ALL_BUSINESS_CAPABILITIES) {
    if (!actorIsOwner && !actorCapabilities.has(capability)) continue;
    const desired = selected.has(capability);
    const defaultEnabled = targetDefaults.has(capability);
    if (desired === defaultEnabled) {
      statements.push(
        db
          .prepare(
            `
            DELETE FROM employee_role_permissions
            WHERE business_id = ? AND user_id = ? AND permission_key = ?
            `
          )
          .bind(businessId, userId, capability)
      );
      continue;
    }
    statements.push(
      db
        .prepare(
          `
          INSERT INTO employee_role_permissions (
            business_id, user_id, permission_key, is_enabled, granted_by, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(business_id, user_id, permission_key) DO UPDATE SET
            is_enabled = excluded.is_enabled,
            granted_by = excluded.granted_by,
            updated_at = excluded.updated_at
          `
        )
        .bind(businessId, userId, capability, desired ? 1 : 0, locals.userId ?? null, now)
    );
  }

  if (statements.length > 0) await db.batch(statements);
  await writeAuditLog(db, {
    action: 'business_capabilities_updated',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    targetUserId: userId,
    metadata: { selected: Array.from(selected) }
  });

  return { success: true, message: 'Permissions updated.' };
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
    origin: origin ?? env?.APP_BASE_URL ?? 'http://localhost:5173',
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
        AND role IN ('owner', 'admin', 'manager', 'general_manager', 'foh_manager', 'boh_manager', 'hourly_manager')
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
    if (isBusinessAdminRole(businessUser?.role)) {
      return fail(400, { error: 'At least one management account must remain active.' });
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
    if (isBusinessAdminRole(businessUser?.role)) {
      return fail(400, { error: 'At least one management account must remain.' });
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
      WHERE user_id = ? AND business_id = ?
      LIMIT 1
      `
    )
    .bind(userId, businessId)
    .first<{ user_id: string }>();

  if (existing) {
    await db
      .prepare(`DELETE FROM daily_specials_editors WHERE user_id = ? AND business_id = ?`)
      .bind(userId, businessId)
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

export async function toggleAnnouncementAccess(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);

  await ensureAnnouncementsSchema(db);
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
      FROM announcement_editors
      WHERE business_id = ? AND user_id = ?
      LIMIT 1
      `
    )
    .bind(businessId, userId)
    .first<{ user_id: string }>();

  if (existing) {
    await db
      .prepare(`DELETE FROM announcement_editors WHERE business_id = ? AND user_id = ?`)
      .bind(businessId, userId)
      .run();
    return { success: true };
  }

  await db
    .prepare(
      `
      INSERT INTO announcement_editors (business_id, user_id, granted_by, updated_at)
      VALUES (?, ?, ?, ?)
      `
    )
    .bind(businessId, userId, locals.userId ?? null, Math.floor(Date.now() / 1000))
    .run();

  return { success: true };
}

export async function toggleScheduleDepartmentApproval(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  if (
    !hasBusinessCapability(
      locals.businessRole,
      locals.businessPermissionTemplate,
      'manage_schedule',
      locals.businessCapabilities
    )
  ) {
    return fail(403, { error: 'Schedule access required.' });
  }
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
  const allowedDepartments = await loadScheduleManagerDepartments(db, locals, businessId);
  if (!allowedDepartments.includes(department)) {
    return fail(403, { error: 'That schedule department is outside your access.' });
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

async function canManageEmployeeHrPos(db: D1, locals: App.Locals, businessId: string, targetUserId: string) {
  if (canManageUserPermissions(locals)) return true;
  return canAccessEmployeeSensitiveData(
    db,
    businessId,
    locals.userId,
    locals.businessRole,
    targetUserId,
    locals.businessPermissionTemplate,
    locals.businessCapabilities
  );
}

function checkboxValue(formData: FormData, key: string, fallback = 0) {
  if (!formData.has(key)) return fallback;
  const value = String(formData.get(key) ?? '').trim().toLowerCase();
  return value === '1' || value === 'on' || value === 'true' ? 1 : 0;
}

function dateToUnixSeconds(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const time = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(time) ? Math.floor(time / 1000) : null;
}

function normalizeRecordStatus(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (['pending', 'active', 'approved', 'needs_review', 'expired', 'failed', 'complete', 'completed'].includes(normalized)) {
    return normalized === 'completed' ? 'complete' : normalized;
  }
  return 'pending';
}

export async function saveEmployeePosPermissions(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) return fail(400, { error: 'Missing user id.' });
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'Employee not found in this business.' });
  }
  if (!(await canManageEmployeeHrPos(db, locals, businessId, userId))) {
    return fail(403, { error: 'HR access required.' });
  }

  const now = Math.floor(Date.now() / 1000);
  const posExternalId = String(formData.get('pos_external_id') ?? '').trim().slice(0, 120);
  await db
    .prepare(
      `
      INSERT INTO employee_pos_permissions (
        business_id,
        user_id,
        pos_external_id,
        can_clock_in,
        can_use_pos,
        can_open_cash_drawer,
        can_refund,
        can_void,
        can_manager_override,
        updated_at,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(business_id, user_id) DO UPDATE SET
        pos_external_id = excluded.pos_external_id,
        can_clock_in = excluded.can_clock_in,
        can_use_pos = excluded.can_use_pos,
        can_open_cash_drawer = excluded.can_open_cash_drawer,
        can_refund = excluded.can_refund,
        can_void = excluded.can_void,
        can_manager_override = excluded.can_manager_override,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
      `
    )
    .bind(
      businessId,
      userId,
      posExternalId,
      checkboxValue(formData, 'can_clock_in'),
      checkboxValue(formData, 'can_use_pos'),
      checkboxValue(formData, 'can_open_cash_drawer'),
      checkboxValue(formData, 'can_refund'),
      checkboxValue(formData, 'can_void'),
      checkboxValue(formData, 'can_manager_override'),
      now,
      locals.userId ?? null
    )
    .run();

  await writeAuditLog(db, {
    action: 'employee_pos_permissions_updated',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    targetUserId: userId
  });

  return { success: true, message: 'POS access saved.' };
}

export async function toggleEmployeeHrAccess(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  if (!canManageUserPermissions(locals)) return fail(403, { error: 'Permission access required.' });
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) return fail(400, { error: 'Missing user id.' });
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'Employee not found in this business.' });
  }

  const existing = await db
    .prepare(
      `
      SELECT is_enabled
      FROM employee_role_permissions
      WHERE business_id = ? AND user_id = ? AND permission_key = ?
      LIMIT 1
      `
    )
    .bind(businessId, userId, HR_SENSITIVE_PERMISSION)
    .first<{ is_enabled: number }>();
  const nextValue = existing?.is_enabled === 1 ? 0 : 1;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
      INSERT INTO employee_role_permissions (
        business_id, user_id, permission_key, is_enabled, granted_by, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(business_id, user_id, permission_key) DO UPDATE SET
        is_enabled = excluded.is_enabled,
        granted_by = excluded.granted_by,
        updated_at = excluded.updated_at
      `
    )
    .bind(businessId, userId, HR_SENSITIVE_PERMISSION, nextValue, locals.userId ?? null, now)
    .run();

  await writeAuditLog(db, {
    action: nextValue ? 'employee_hr_access_granted' : 'employee_hr_access_removed',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    targetUserId: userId
  });

  return { success: true, message: nextValue ? 'HR access granted.' : 'HR access removed.' };
}

export async function addEmployeeCertification(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  const title = formString(formData, 'title', 160);
  if (!userId || !title) return fail(400, { error: 'Certification title is required.' });
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'Employee not found in this business.' });
  }
  if (!(await canManageEmployeeHrPos(db, locals, businessId, userId))) {
    return fail(403, { error: 'HR access required.' });
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      INSERT INTO employee_certifications (
        id,
        business_id,
        user_id,
        certification_type,
        title,
        issuer,
        certificate_number,
        issued_at,
        expires_at,
        status,
        reviewed_at,
        reviewed_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      crypto.randomUUID(),
      businessId,
      userId,
      formString(formData, 'certification_type', 80) || 'general',
      title,
      formString(formData, 'issuer', 160),
      formString(formData, 'certificate_number', 120),
      dateToUnixSeconds(formData.get('issued_at')),
      dateToUnixSeconds(formData.get('expires_at')),
      normalizeRecordStatus(formData.get('status')),
      now,
      locals.userId ?? null,
      now,
      now
    )
    .run();

  return { success: true, message: 'Certification added.' };
}

export async function deleteEmployeeCertification(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  const formData = await request.formData();
  const certificationId = String(formData.get('certification_id') ?? '').trim();
  if (!certificationId) return fail(400, { error: 'Missing certification.' });

  const row = await db
    .prepare(`SELECT user_id FROM employee_certifications WHERE id = ? AND business_id = ? LIMIT 1`)
    .bind(certificationId, businessId)
    .first<{ user_id: string }>();
  if (!row) return fail(404, { error: 'Certification not found.' });
  if (!(await canManageEmployeeHrPos(db, locals, businessId, row.user_id))) {
    return fail(403, { error: 'HR access required.' });
  }

  await db.prepare(`DELETE FROM employee_certifications WHERE id = ? AND business_id = ?`).bind(certificationId, businessId).run();
  return { success: true, message: 'Certification removed.' };
}

export async function addEmployeeVerificationCheck(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  const checkType = formString(formData, 'check_type', 100);
  if (!userId || !checkType) return fail(400, { error: 'Check type is required.' });
  if (!(await userBelongsToBusiness(db, userId, businessId))) {
    return fail(404, { error: 'Employee not found in this business.' });
  }
  if (!(await canManageEmployeeHrPos(db, locals, businessId, userId))) {
    return fail(403, { error: 'HR access required.' });
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      INSERT INTO employee_verification_checks (
        id,
        business_id,
        user_id,
        check_type,
        status,
        provider_reference,
        result_summary,
        requested_at,
        completed_at,
        reviewed_at,
        reviewed_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      crypto.randomUUID(),
      businessId,
      userId,
      checkType,
      normalizeRecordStatus(formData.get('status')),
      formString(formData, 'provider_reference', 160),
      formMultilineString(formData, 'result_summary', 500),
      now,
      null,
      now,
      locals.userId ?? null,
      now,
      now
    )
    .run();

  return { success: true, message: 'Verification added.' };
}

export async function updateEmployeeVerificationCheck(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  const formData = await request.formData();
  const checkId = String(formData.get('check_id') ?? '').trim();
  const status = normalizeRecordStatus(formData.get('status'));
  if (!checkId) return fail(400, { error: 'Missing verification check.' });

  const row = await db
    .prepare(`SELECT user_id FROM employee_verification_checks WHERE id = ? AND business_id = ? LIMIT 1`)
    .bind(checkId, businessId)
    .first<{ user_id: string }>();
  if (!row) return fail(404, { error: 'Verification check not found.' });
  if (!(await canManageEmployeeHrPos(db, locals, businessId, row.user_id))) {
    return fail(403, { error: 'HR access required.' });
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      UPDATE employee_verification_checks
      SET status = ?,
          result_summary = ?,
          completed_at = CASE WHEN ? IN ('approved', 'complete', 'failed') THEN COALESCE(completed_at, ?) ELSE completed_at END,
          reviewed_at = ?,
          reviewed_by = ?,
          updated_at = ?
      WHERE id = ? AND business_id = ?
      `
    )
    .bind(
      status,
      formMultilineString(formData, 'result_summary', 500),
      status,
      now,
      now,
      locals.userId ?? null,
      now,
      checkId,
      businessId
    )
    .run();

  return { success: true, message: 'Verification updated.' };
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
  if (
    !(await canAccessEmployeeSensitiveData(
      db,
      businessId,
      locals.userId,
      locals.businessRole,
      userId,
      locals.businessPermissionTemplate,
      locals.businessCapabilities
    ))
  ) {
    return fail(403, { error: 'HR access is required.' });
  }

  const target = await getUserById(db, userId);
  if (!target) return fail(404, { error: 'Employee not found.' });

  const profile = {
    real_name: formString(formData, 'real_name', 120),
    phone: formString(formData, 'phone', 48),
    birthday: String(formData.get('birthday') ?? '').trim(),
    address_line_1: formString(formData, 'address_line_1', 120),
    address_line_2: formString(formData, 'address_line_2', 120),
    city: formString(formData, 'city', 80),
    state: formString(formData, 'state', 80),
    postal_code: formString(formData, 'postal_code', 24),
    emergency_contact_name: formString(formData, 'emergency_contact_name', 120),
    emergency_contact_phone: formString(formData, 'emergency_contact_phone', 48),
    emergency_contact_relationship: formString(formData, 'emergency_contact_relationship', 80)
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

  if (normalizeBusinessRole(membership.role) === 'owner') {
    return fail(400, { error: 'Owners do not need employee onboarding packets.' });
  }

  if (payrollClassification === 'contractor') {
    return fail(400, { error: 'Contractors do not receive employee onboarding packets.' });
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

  await writeAuditLog(db, {
    action: 'employee_onboarding_package_sent',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    targetUserId: userId,
    metadata: {
      packageId: created.packageId,
      payrollClassification
    }
  });
  await recordOperationalEventBestEffort(
    db,
    {
      businessId,
      eventType: 'onboarding.package.sent',
      category: 'onboarding',
      actorUserId: locals.userId ?? null,
      targetUserId: userId,
      subjectType: 'employee_onboarding_package',
      subjectId: created.packageId,
      title: 'Onboarding package sent',
      payload: { payrollClassification }
    },
    request
  );

  return { success: true, message: 'Onboarding package sent.' };
}

export async function submitEmployeeOnboardingItem(
  request: Request,
  locals: App.Locals,
  env?: Partial<App.Platform['env']>
) {
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
  const now = Math.floor(Date.now() / 1000);

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
    if (isSensitiveOnboardingFormKey(item.form_key)) {
      try {
        await storeSensitiveOnboardingFormPayload(db, env, item, formResult.payload, locals.userId, now);
      } catch (error) {
        if (error instanceof Error && error.message === 'sensitive_encryption_missing') {
          return sensitiveConfigurationFailure();
        }
        throw error;
      }
      formPayload = JSON.stringify(sanitizeSensitiveOnboardingPayload(item.form_key, formResult.payload));
    } else {
      formPayload = JSON.stringify(formResult.payload);
    }
  } else if (String(formData.get('acknowledged') ?? '0') !== '1') {
    return fail(400, { error: 'Confirm the acknowledgement before submitting.' });
  } else if (!signedName) {
    return fail(400, { error: 'Typed name is required.' });
  }

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

  await upsertComplianceDocumentForOnboardingItem(
    db,
    {
      ...item,
      status: 'submitted',
      file_url: fileUrl,
      file_name: fileName,
      signed_name: signedName,
      submitted_at: now,
      reviewed_at: null,
      reviewed_by: null
    },
    locals.userId,
    now
  );

  await refreshEmployeeOnboardingPackageStatus(db, item.package_id, businessId);

  await writeAuditLog(db, {
    action: 'employee_onboarding_item_submitted',
    request,
    businessId,
    actorUserId: locals.userId,
    targetUserId: locals.userId,
    metadata: {
      packageId: item.package_id,
      itemId: item.id,
      itemType: item.item_type,
      formKey: item.form_key,
      sensitive: isSensitiveOnboardingFormKey(item.form_key)
    }
  });
  await recordOperationalEventBestEffort(
    db,
    {
      businessId,
      eventType: 'onboarding.item.submitted',
      category: 'onboarding',
      actorUserId: locals.userId,
      targetUserId: locals.userId,
      subjectType: 'employee_onboarding_item',
      subjectId: item.id,
      title: 'Onboarding item submitted',
      payload: {
        packageId: item.package_id,
        itemType: item.item_type,
        formKey: item.form_key,
        sensitive: isSensitiveOnboardingFormKey(item.form_key)
      }
    },
    request
  );

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
        status,
        file_url,
        file_name,
        signed_name,
        submitted_at
      FROM employee_onboarding_items
      WHERE id = ? AND business_id = ?
      LIMIT 1
      `
    )
    .bind(itemId, businessId)
    .first<
      Pick<
        EmployeeOnboardingItem,
        | 'id'
        | 'package_id'
        | 'business_id'
        | 'user_id'
        | 'item_type'
        | 'form_key'
        | 'title'
        | 'status'
        | 'file_url'
        | 'file_name'
        | 'signed_name'
        | 'submitted_at'
      >
    >();

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

  await upsertComplianceDocumentForOnboardingItem(
    db,
    {
      ...item,
      status,
      reviewed_at: now,
      reviewed_by: locals.userId ?? null
    },
    locals.userId ?? null,
    now
  );

  await refreshEmployeeOnboardingPackageStatus(
    db,
    item.package_id,
    businessId,
    status === 'approved' ? (locals.userId ?? null) : null
  );

  await writeAuditLog(db, {
    action:
      status === 'approved'
        ? 'employee_onboarding_item_approved'
        : 'employee_onboarding_item_changes_requested',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    targetUserId: item.user_id,
    metadata: {
      packageId: item.package_id,
      itemId: item.id,
      itemType: item.item_type,
      formKey: item.form_key
    }
  });
  await recordOperationalEventBestEffort(
    db,
    {
      businessId,
      eventType:
        status === 'approved'
          ? 'onboarding.item.approved'
          : 'onboarding.item.changes_requested',
      category: 'onboarding',
      actorUserId: locals.userId ?? null,
      targetUserId: item.user_id,
      subjectType: 'employee_onboarding_item',
      subjectId: item.id,
      title: status === 'approved' ? 'Onboarding item approved' : 'Onboarding changes requested',
      payload: {
        packageId: item.package_id,
        itemType: item.item_type,
        formKey: item.form_key
      }
    },
    request
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
  const accessType = normalizeInviteAccessType(String(formData.get('access_type') ?? 'staff'));
  if (accessType === 'owner' && !isOwnerRole(locals.businessRole)) {
    return fail(403, { error: 'Only the owner can invite another owner.' });
  }
  const requestedPermissionTemplate = normalizePermissionTemplate(
    String(formData.get('permission_template') ?? '')
  );
  const permissionTemplate =
    requestedPermissionTemplate === 'staff' && accessType !== 'staff'
      ? defaultPermissionTemplateForRole(accessType)
      : requestedPermissionTemplate;
  const employmentType = String(formData.get('employment_type') ?? 'employee') === 'contractor' ? 'contractor' : 'employee';
  const jobTitle = formString(formData, 'job_title', 120);
  const primaryDepartment = formString(formData, 'primary_schedule_department', 120);
  const allowedDepartments = await loadScheduleDepartments(db, businessId);
  const scheduleDepartments = Array.from(
    new Set(
      formData
        .getAll('schedule_departments')
        .map((value) => String(value ?? '').trim())
        .filter((value) => allowedDepartments.includes(value))
    )
  );
  if (primaryDepartment && allowedDepartments.includes(primaryDepartment) && !scheduleDepartments.includes(primaryDepartment)) {
    scheduleDepartments.unshift(primaryDepartment);
  }
  const department = primaryDepartment || scheduleDepartments[0] || '';
  const startDate = String(formData.get('start_date') ?? '').trim().slice(0, 10);
  const payTypeRaw = String(formData.get('pay_type') ?? '').trim().toLowerCase();
  const payType = payTypeRaw === 'hourly' || payTypeRaw === 'salary' ? payTypeRaw : '';
  const onboardingRequired = accessType === 'owner' || employmentType === 'contractor' ? 0 : 1;
  if (!email || !email.includes('@')) {
    return fail(400, { error: 'A valid email is required.' });
  }
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return fail(400, { error: 'Start date must use a valid date.' });
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
  const inviteId = crypto.randomUUID();

  await db
    .prepare(
      `
      INSERT INTO business_invites (
        id,
        business_id,
        email,
        email_normalized,
        invite_code,
        role,
        invited_by,
        permission_template,
        employment_type,
        job_title,
        department,
        primary_schedule_department,
        schedule_departments_json,
        start_date,
        pay_type,
        onboarding_required,
        created_at,
        expires_at,
        revoked_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `
    )
    .bind(
      inviteId,
      businessId,
      email,
      emailNormalized,
      inviteCode,
      accessType,
      locals.userId ?? null,
      permissionTemplate,
      employmentType,
      jobTitle,
      department,
      department,
      JSON.stringify(scheduleDepartments),
      startDate,
      payType,
      onboardingRequired,
      now,
      expiresAt
    )
    .run();

  const selectedPacketItemIds = new Set(
    formData
      .getAll('packet_item_ids')
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
  );
  if (onboardingRequired === 1 && selectedPacketItemIds.size > 0) {
    const selectedTemplateItems = (await loadEmployeeOnboardingTemplate(db, businessId)).filter(
      (item) => item.is_active === 1 && selectedPacketItemIds.has(item.id)
    );
    const requirementStatements: Array<ReturnType<D1['prepare']>> = [];
    for (const item of selectedTemplateItems) {
      const requirementId = await ensureEmployeeComplianceRequirement(
        db,
        businessId,
        classifyOnboardingComplianceItem(item),
        locals.userId ?? null,
        now
      );
      requirementStatements.push(
        db
          .prepare(
            `
            INSERT OR IGNORE INTO employee_onboarding_invite_requirements (
              business_id,
              invite_id,
              requirement_id,
              created_at
            )
            VALUES (?, ?, ?, ?)
            `
          )
          .bind(businessId, inviteId, requirementId, now)
      );
    }
    if (requirementStatements.length > 0) await db.batch(requirementStatements);
  }

  await writeAuditLog(db, {
    action: 'invite_created',
    request,
    businessId,
    actorUserId: locals.userId ?? null,
    email,
    metadata: {
      inviteId,
      accessType,
      permissionTemplate,
      employmentType,
      jobTitle: Boolean(jobTitle),
      department: Boolean(department),
      departmentCount: scheduleDepartments.length,
      startDate: Boolean(startDate),
      packetRequirementCount: selectedPacketItemIds.size
    }
  });

  const emailResult = await sendInviteEmail({
    env,
    origin: origin ?? env?.APP_BASE_URL ?? 'http://localhost:5173',
    inviteeEmail: email,
    inviteCode,
    expiresAt,
    businessName: locals.businessName,
    onboardingRequired: onboardingRequired === 1
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
