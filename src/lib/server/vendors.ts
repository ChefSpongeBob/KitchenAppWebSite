import { dev } from '$app/environment';
import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin';
import { ensureTenantSchema, requireBusinessId } from '$lib/server/tenant';
import { normalizeFormText } from '$lib/server/inputSanitizer';

type DB = App.Platform['env']['DB'];

let vendorSchemaEnsured = false;

export type VendorResource = {
  id: string;
  name: string;
  websiteUrl: string;
  phone: string;
  contactName: string;
  notes: string;
  isActive: number;
  updatedAt: number;
};

async function ensureVendorSchema(db: DB) {
  if (!dev) {
    vendorSchemaEnsured = true;
    return;
  }
  if (vendorSchemaEnsured) return;

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS vendor_resources (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        name TEXT NOT NULL,
        website_url TEXT,
        phone TEXT,
        contact_name TEXT,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_vendor_resources_business_active_name
      ON vendor_resources(business_id, is_active, name)
      `
    )
    .run();

  vendorSchemaEnsured = true;
}

function optionalString(formData: FormData, key: string, maxLength: number) {
  return normalizeFormText(formData, key, { maxLength });
}

function normalizeWebsite(raw: string) {
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function readVendorForm(formData: FormData) {
  const name = optionalString(formData, 'name', 90);
  const websiteRaw = optionalString(formData, 'website_url', 180);
  const websiteUrl = normalizeWebsite(websiteRaw);
  const phone = optionalString(formData, 'phone', 48);
  const contactName = optionalString(formData, 'contact_name', 90);
  const notes = optionalString(formData, 'notes', 280);
  const isActive = Number(formData.get('is_active') ?? 1) === 1 ? 1 : 0;

  if (!name) return { error: 'Vendor name is required.' } as const;
  if (websiteRaw && !websiteUrl) return { error: 'Enter a valid vendor website.' } as const;

  return { name, websiteUrl: websiteUrl ?? '', phone, contactName, notes, isActive } as const;
}

export async function loadVendors(db: DB, businessId: string) {
  await ensureVendorSchema(db);
  await ensureTenantSchema(db, true);

  const rows = await db
    .prepare(
      `
      SELECT id, name, website_url, phone, contact_name, notes, is_active, updated_at
      FROM vendor_resources
      WHERE business_id = ?
      ORDER BY is_active DESC, name COLLATE NOCASE ASC
      `
    )
    .bind(businessId)
    .all<{
      id: string;
      name: string;
      website_url: string | null;
      phone: string | null;
      contact_name: string | null;
      notes: string | null;
      is_active: number;
      updated_at: number;
    }>();

  return (rows.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    websiteUrl: row.website_url ?? '',
    phone: row.phone ?? '',
    contactName: row.contact_name ?? '',
    notes: row.notes ?? '',
    isActive: row.is_active,
    updatedAt: row.updated_at
  })) satisfies VendorResource[];
}

export async function createVendor(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });

  const businessId = requireBusinessId(locals);
  await ensureVendorSchema(db);
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const vendor = readVendorForm(formData);
  if ('error' in vendor) return fail(400, { error: vendor.error });

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      INSERT INTO vendor_resources (
        id, business_id, name, website_url, phone, contact_name, notes, is_active,
        created_at, updated_at, created_by, updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      crypto.randomUUID(),
      businessId,
      vendor.name,
      vendor.websiteUrl || null,
      vendor.phone || null,
      vendor.contactName || null,
      vendor.notes || null,
      vendor.isActive,
      now,
      now,
      locals.userId ?? null,
      locals.userId ?? null
    )
    .run();

  return { success: true, message: 'Vendor saved.' };
}

export async function updateVendor(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });

  const businessId = requireBusinessId(locals);
  await ensureVendorSchema(db);
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const id = optionalString(formData, 'id', 80);
  if (!id) return fail(400, { error: 'Missing vendor id.' });
  const vendor = readVendorForm(formData);
  if ('error' in vendor) return fail(400, { error: vendor.error });

  await db
    .prepare(
      `
      UPDATE vendor_resources
      SET name = ?, website_url = ?, phone = ?, contact_name = ?, notes = ?,
        is_active = ?, updated_at = ?, updated_by = ?
      WHERE id = ? AND business_id = ?
      `
    )
    .bind(
      vendor.name,
      vendor.websiteUrl || null,
      vendor.phone || null,
      vendor.contactName || null,
      vendor.notes || null,
      vendor.isActive,
      Math.floor(Date.now() / 1000),
      locals.userId ?? null,
      id,
      businessId
    )
    .run();

  return { success: true, message: 'Vendor updated.' };
}

export async function deleteVendor(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });

  const businessId = requireBusinessId(locals);
  await ensureVendorSchema(db);
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const id = optionalString(formData, 'id', 80);
  if (!id) return fail(400, { error: 'Missing vendor id.' });

  await db.prepare(`DELETE FROM vendor_resources WHERE id = ? AND business_id = ?`).bind(id, businessId).run();
  return { success: true, message: 'Vendor deleted.' };
}
