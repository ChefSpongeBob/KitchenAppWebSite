import { dev } from '$app/env';
import { fail } from '@sveltejs/kit';
import { ensureTenantSchema, requireBusinessId } from '#lib/server/tenant.ts';
import { hasBusinessCapability } from '#lib/server/permissions.ts';
import { requireFeatureAccess } from '#lib/server/featureAccess.ts';
import { documentFeatureKey } from '#lib/features/appFeatures.ts';

type DB = App.RuntimeEnv['DB'];

export type ItemAttachmentTargetType = 'recipe' | 'document';
export type ItemAttachmentSourceType = 'list_item' | 'checklist_item';

export type ItemAttachment = {
  id: string;
  sourceType: ItemAttachmentSourceType;
  sourceItemId: string;
  targetType: ItemAttachmentTargetType;
  targetId: string;
  title: string;
  category: string;
  content: string;
  fileUrl: string;
  ingredients: string;
  instructions: string;
};

let itemAttachmentSchemaEnsured = false;

async function ensureItemAttachmentSchema(db: DB) {
  if (!dev) {
    itemAttachmentSchemaEnsured = true;
    return;
  }
  if (itemAttachmentSchemaEnsured) return;

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS item_attachments (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('list_item', 'checklist_item')),
        source_item_id TEXT NOT NULL,
        target_type TEXT NOT NULL CHECK (target_type IN ('recipe', 'document')),
        target_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        created_by TEXT,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_item_attachments_unique
      ON item_attachments(business_id, source_type, source_item_id, target_type, target_id)
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_item_attachments_source
      ON item_attachments(business_id, source_type, source_item_id)
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_item_attachments_target
      ON item_attachments(business_id, target_type, target_id)
      `
    )
    .run();

  itemAttachmentSchemaEnsured = true;
}

function parseSourceType(value: FormDataEntryValue | null): ItemAttachmentSourceType | null {
  const sourceType = String(value ?? '').trim();
  return sourceType === 'list_item' || sourceType === 'checklist_item' ? sourceType : null;
}

function canManageItemAttachments(locals: App.Locals) {
  return hasBusinessCapability(
    locals.businessRole ?? locals.userRole,
    locals.businessPermissionTemplate,
    'manage_content',
    locals.businessCapabilities
  );
}

function parseTargetType(value: FormDataEntryValue | null): ItemAttachmentTargetType | null {
  const targetType = String(value ?? '').trim();
  return targetType === 'recipe' || targetType === 'document' ? targetType : null;
}

async function sourceItemExists(
  db: DB,
  businessId: string,
  sourceType: ItemAttachmentSourceType,
  sourceItemId: string
) {
  const table = sourceType === 'list_item' ? 'list_items' : 'checklist_items';
  const row = await db
    .prepare(`SELECT id FROM ${table} WHERE id = ? AND business_id = ? LIMIT 1`)
    .bind(sourceItemId, businessId)
    .first<{ id: string }>();
  return Boolean(row?.id);
}

async function targetExists(
  db: DB,
  businessId: string,
  targetType: ItemAttachmentTargetType,
  targetId: string,
  locals: App.Locals
) {
  const row =
    targetType === 'recipe'
      ? await db
          .prepare(`SELECT id FROM recipes WHERE CAST(id AS TEXT) = ? AND business_id = ? LIMIT 1`)
          .bind(targetId, businessId)
          .first<{ id: string; slug?: string; section?: string; category?: string }>()
      : await db
          .prepare(`SELECT id, slug, section, category FROM documents WHERE id = ? AND business_id = ? AND COALESCE(is_active, 1) = 1 LIMIT 1`)
          .bind(targetId, businessId)
          .first<{ id: string; slug: string; section: string; category: string }>();

  if (row) requireFeatureAccess(locals, targetType === 'recipe' ? 'recipes' : documentFeatureKey(row));
  return Boolean(row?.id);
}

function mapAttachmentRow(row: {
  id: string;
  source_type: ItemAttachmentSourceType;
  source_item_id: string;
  target_type: ItemAttachmentTargetType;
  target_id: string;
  recipe_title: string | null;
  recipe_category: string | null;
  ingredients: string | null;
  instructions: string | null;
  document_title: string | null;
  document_category: string | null;
  content: string | null;
  file_url: string | null;
}) {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceItemId: row.source_item_id,
    targetType: row.target_type,
    targetId: row.target_id,
    title: row.target_type === 'recipe' ? (row.recipe_title ?? '') : (row.document_title ?? ''),
    category: row.target_type === 'recipe' ? (row.recipe_category ?? '') : (row.document_category ?? ''),
    content: row.content ?? '',
    fileUrl: row.file_url ?? '',
    ingredients: row.ingredients ?? '',
    instructions: row.instructions ?? ''
  } satisfies ItemAttachment;
}

export async function loadItemAttachmentsForItems(
  db: DB,
  businessId: string,
  sourceType: ItemAttachmentSourceType,
  itemIds: string[]
) {
  await ensureItemAttachmentSchema(db);
  await ensureTenantSchema(db, true);

  const uniqueIds = Array.from(new Set(itemIds.filter(Boolean)));
  const emptyMap = new Map<string, ItemAttachment[]>();
  if (uniqueIds.length === 0) return emptyMap;

  const rows = await db
    .prepare(
      `
      SELECT
        a.id,
        a.source_type,
        a.source_item_id,
        a.target_type,
        a.target_id,
        r.title AS recipe_title,
        r.category AS recipe_category,
        r.ingredients,
        r.instructions,
        d.title AS document_title,
        d.category AS document_category,
        d.content,
        d.file_url
      FROM item_attachments a
      LEFT JOIN recipes r
        ON a.target_type = 'recipe'
        AND CAST(r.id AS TEXT) = a.target_id
        AND r.business_id = a.business_id
      LEFT JOIN documents d
        ON a.target_type = 'document'
        AND d.id = a.target_id
        AND d.business_id = a.business_id
        AND COALESCE(d.is_active, 1) = 1
      LEFT JOIN app_feature_flags_business source_feature
        ON source_feature.business_id = a.business_id AND source_feature.feature_key = 'lists'
      LEFT JOIN app_feature_flags_business target_feature
        ON target_feature.business_id = a.business_id
        AND target_feature.feature_key = CASE
          WHEN a.target_type = 'recipe' THEN 'recipes'
          WHEN LOWER(TRIM(COALESCE(d.category, ''))) = 'menu'
            OR LOWER(TRIM(COALESCE(d.section, ''))) = 'menu'
            OR LOWER(TRIM(COALESCE(d.slug, ''))) LIKE 'menu%' THEN 'menus'
          ELSE 'documents' END
      WHERE a.business_id = ?
        AND COALESCE(source_feature.mode, 'all') != 'off'
        AND COALESCE(target_feature.mode, 'all') != 'off'
        AND a.source_type = ?
        AND a.source_item_id IN (SELECT value FROM json_each(?))
      ORDER BY a.created_at ASC
      `
    )
    .bind(businessId, sourceType, JSON.stringify(uniqueIds))
    .all<{
      id: string;
      source_type: ItemAttachmentSourceType;
      source_item_id: string;
      target_type: ItemAttachmentTargetType;
      target_id: string;
      recipe_title: string | null;
      recipe_category: string | null;
      ingredients: string | null;
      instructions: string | null;
      document_title: string | null;
      document_category: string | null;
      content: string | null;
      file_url: string | null;
    }>();

  const grouped = new Map<string, ItemAttachment[]>();
  for (const row of rows.results ?? []) {
    const attachment = mapAttachmentRow(row);
    if (!attachment.title) continue;
    const current = grouped.get(attachment.sourceItemId) ?? [];
    current.push(attachment);
    grouped.set(attachment.sourceItemId, current);
  }

  return grouped;
}

async function saveItemAttachment(db: DB, businessId: string, sourceType: ItemAttachmentSourceType,
  sourceItemId: string, targetType: ItemAttachmentTargetType, targetId: string, userId?: string | null) {
  const sourceTable = sourceType === 'list_item' ? 'list_items' : 'checklist_items';
  const targetTable = targetType === 'recipe' ? 'recipes' : 'documents';
  const exists = `EXISTS (SELECT 1 FROM ${sourceTable} WHERE id = ? AND business_id = ?)
    AND EXISTS (SELECT 1 FROM ${targetTable} WHERE CAST(id AS TEXT) = ? AND business_id = ?
      ${targetType === 'document' ? 'AND COALESCE(is_active, 1) = 1' : ''})`;
  const result = await db.prepare(`INSERT INTO item_attachments
    (id, business_id, source_type, source_item_id, target_type, target_id, created_at, created_by)
    SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${exists}
    ON CONFLICT(business_id, source_type, source_item_id, target_type, target_id) DO NOTHING`)
    .bind(crypto.randomUUID(), businessId, sourceType, sourceItemId, targetType, targetId, Math.floor(Date.now() / 1000),
      userId ?? null, sourceItemId, businessId, targetId, businessId).run();
  if (result.meta.changes) return { success: true };
  const duplicate = await db.prepare(`SELECT id FROM item_attachments WHERE business_id = ? AND source_type = ?
    AND source_item_id = ? AND target_type = ? AND target_id = ? AND ${exists}`)
    .bind(businessId, sourceType, sourceItemId, targetType, targetId, sourceItemId, businessId, targetId, businessId).first();
  return duplicate ? { success: true } : fail(404, { error: 'Item or attachment not found. Refresh and try again.' });
}

export async function createItemAttachment(request: Request, locals: App.Locals) {
  if (!canManageItemAttachments(locals)) return fail(403, { error: 'Admin only.' });
  requireFeatureAccess(locals, 'lists');
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureItemAttachmentSchema(db);
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const sourceType = parseSourceType(formData.get('source_type'));
  const targetRef = String(formData.get('target_ref') ?? '').trim();
  const targetRefSeparator = targetRef.indexOf(':');
  const targetRefType = targetRefSeparator > -1 ? targetRef.slice(0, targetRefSeparator) : '';
  const targetRefId = targetRefSeparator > -1 ? targetRef.slice(targetRefSeparator + 1) : '';
  const targetType = parseTargetType(formData.get('target_type')) ?? parseTargetType(targetRefType);
  const sourceItemId = String(formData.get('source_item_id') ?? '').trim();
  const targetId = String(formData.get('target_id') ?? targetRefId ?? '').trim();

  if (!sourceType || !targetType || !sourceItemId || !targetId) {
    return fail(400, { error: 'Choose an item and attachment.' });
  }

  if (!(await sourceItemExists(db, businessId, sourceType, sourceItemId))) {
    return fail(404, { error: 'Item not found.' });
  }

  if (!(await targetExists(db, businessId, targetType, targetId, locals))) {
    return fail(404, { error: 'Attachment target not found.' });
  }

  return saveItemAttachment(db, businessId, sourceType, sourceItemId, targetType, targetId, locals.userId);
}

export async function attachTargetToItem(request: Request, locals: App.Locals) {
  if (!canManageItemAttachments(locals)) return fail(403, { error: 'Admin only.' });
  requireFeatureAccess(locals, 'lists');
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureItemAttachmentSchema(db);
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const sourceRef = String(formData.get('source_ref') ?? '').trim();
  const sourceRefSeparator = sourceRef.indexOf(':');
  const sourceRefType = sourceRefSeparator > -1 ? sourceRef.slice(0, sourceRefSeparator) : '';
  const sourceRefId = sourceRefSeparator > -1 ? sourceRef.slice(sourceRefSeparator + 1) : '';
  const sourceType = parseSourceType(formData.get('source_type')) ?? parseSourceType(sourceRefType);
  const sourceItemId = String(formData.get('source_item_id') ?? sourceRefId ?? '').trim();
  const targetType = parseTargetType(formData.get('target_type'));
  const targetId = String(formData.get('target_id') ?? '').trim();

  if (!sourceType || !sourceItemId || !targetType || !targetId) {
    return fail(400, { error: 'Choose an item and attachment.' });
  }

  if (!(await sourceItemExists(db, businessId, sourceType, sourceItemId))) {
    return fail(404, { error: 'Item not found.' });
  }

  if (!(await targetExists(db, businessId, targetType, targetId, locals))) {
    return fail(404, { error: 'Attachment target not found.' });
  }

  return saveItemAttachment(db, businessId, sourceType, sourceItemId, targetType, targetId, locals.userId);
}

export async function deleteItemAttachment(request: Request, locals: App.Locals) {
  if (!canManageItemAttachments(locals)) return fail(403, { error: 'Admin only.' });
  requireFeatureAccess(locals, 'lists');
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  const businessId = requireBusinessId(locals);
  await ensureItemAttachmentSchema(db);
  await ensureTenantSchema(db, true);

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return fail(400, { error: 'Missing attachment id.' });

  const existing = await db.prepare(`SELECT target_type, target_id FROM item_attachments WHERE id = ? AND business_id = ?`)
    .bind(id, businessId).first<{ target_type: ItemAttachmentTargetType; target_id: string }>();
  if (!existing || !(await targetExists(db, businessId, existing.target_type, existing.target_id, locals))) {
    return fail(404, { error: 'Attachment not found.' });
  }

  await db.prepare(`DELETE FROM item_attachments WHERE id = ? AND business_id = ?`).bind(id, businessId).run();
  return { success: true };
}
