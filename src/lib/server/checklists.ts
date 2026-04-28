import { fail } from '@sveltejs/kit';
import { ensureTenantSchema } from '$lib/server/tenant';

type DB = App.Platform['env']['DB'];
type ChecklistLocals = {
  DB?: DB;
  businessId?: string | null;
};

type ChecklistItem = {
  id: string;
  content: string;
  is_checked: number;
};

type DefaultItem = {
  content: string;
};

type ChecklistPageOptions = {
  subtitle: string;
  resetLabel: string;
  defaults: DefaultItem[];
  infoCardTitle?: string;
  infoCardIntro?: string;
  infoCardSections?: Array<{
    title: string;
    lines: string[];
  }>;
  replaceDefaults?: boolean;
};

async function getSection(db: DB, slug: string, businessId: string) {
  return db
    .prepare(`SELECT id FROM checklist_sections WHERE slug = ? AND business_id = ? LIMIT 1`)
    .bind(slug, businessId)
    .first<{ id: string }>();
}

async function seedDefaultsIfMissing(db: DB, sectionId: string, defaults: DefaultItem[], businessId: string) {
  const existing = await db
    .prepare(`SELECT COUNT(*) AS count FROM checklist_items WHERE section_id = ? AND business_id = ?`)
    .bind(sectionId, businessId)
    .first<{ count: number }>();

  if ((existing?.count ?? 0) > 0) return;

  const now = Math.floor(Date.now() / 1000);
  for (const [index, item] of defaults.entries()) {
    await db
      .prepare(
        `
        INSERT INTO checklist_items (
          id, section_id, content, sort_order, is_checked, created_at, updated_at
          , business_id
        )
        VALUES (?, ?, ?, ?, 0, ?, ?, ?)
        `
      )
      .bind(crypto.randomUUID(), sectionId, item.content, index, now, now, businessId)
      .run();
  }
}

async function replaceDefaults(db: DB, sectionId: string, defaults: DefaultItem[], businessId: string) {
  const rows = await db
    .prepare(
      `
      SELECT id, content
      FROM checklist_items
      WHERE section_id = ? AND business_id = ?
      ORDER BY sort_order ASC, created_at ASC
      `
    )
    .bind(sectionId, businessId)
    .all<{ id: string; content: string }>();

  const existing = rows.results ?? [];
  const matchesDefaults =
    existing.length === defaults.length &&
    existing.every((item, index) => item.content.trim() === defaults[index]?.content.trim());

  if (matchesDefaults) return;

  await db.prepare(`DELETE FROM checklist_items WHERE section_id = ? AND business_id = ?`).bind(sectionId, businessId).run();

  const now = Math.floor(Date.now() / 1000);
  for (const [index, item] of defaults.entries()) {
    await db
      .prepare(
        `
        INSERT INTO checklist_items (
          id, section_id, content, sort_order, is_checked, created_at, updated_at
          , business_id
        )
        VALUES (?, ?, ?, ?, 0, ?, ?, ?)
        `
      )
      .bind(crypto.randomUUID(), sectionId, item.content, index, now, now, businessId)
      .run();
  }
}

export function createChecklistPage(sectionSlug: string, pageTitle: string, options: ChecklistPageOptions) {
  const load = async ({ locals }: { locals: ChecklistLocals }) => {
    const db = locals.DB;
    if (!db) {
      return {
        title: pageTitle,
        subtitle: options.subtitle,
        resetLabel: options.resetLabel,
        infoCardTitle: options.infoCardTitle ?? '',
        infoCardIntro: options.infoCardIntro ?? '',
        infoCardSections: options.infoCardSections ?? [],
        items: []
      };
    }
    await ensureTenantSchema(db);
    const businessId = locals.businessId ?? '';

    const section = await getSection(db, sectionSlug, businessId);
    if (!section) {
      return {
        title: pageTitle,
        subtitle: options.subtitle,
        resetLabel: options.resetLabel,
        infoCardTitle: options.infoCardTitle ?? '',
        infoCardIntro: options.infoCardIntro ?? '',
        infoCardSections: options.infoCardSections ?? [],
        items: []
      };
    }

    if (options.replaceDefaults) {
      await replaceDefaults(db, section.id, options.defaults, businessId);
    } else {
      await seedDefaultsIfMissing(db, section.id, options.defaults, businessId);
    }

    const items = await db
      .prepare(
        `
        SELECT id, content, is_checked
        FROM checklist_items
        WHERE section_id = ? AND business_id = ?
        ORDER BY sort_order ASC, created_at ASC
        `
      )
      .bind(section.id, businessId)
      .all<ChecklistItem>();

    return {
      title: pageTitle,
      subtitle: options.subtitle,
      resetLabel: options.resetLabel,
      infoCardTitle: options.infoCardTitle ?? '',
      infoCardIntro: options.infoCardIntro ?? '',
      infoCardSections: options.infoCardSections ?? [],
      items: items.results ?? []
    };
  };

  const actions = {
    toggle_checked: async ({ request, locals }: { request: Request; locals: ChecklistLocals }) => {
      const db = locals.DB;
      if (!db) return fail(503, { error: 'Database not configured.' });
      await ensureTenantSchema(db);
      const businessId = locals.businessId ?? '';

      const section = await getSection(db, sectionSlug, businessId);
      if (!section) return fail(404, { error: 'Checklist not found.' });

      const formData = await request.formData();
      const id = String(formData.get('id') ?? '');
      const isCheckedValue = formData.get('is_checked') ?? formData.get(`is_checked_${id}`);
      const isChecked = Number(isCheckedValue);

      if (!id || (isChecked !== 0 && isChecked !== 1)) {
        return fail(400, { error: 'Invalid completion state.' });
      }

      await db
        .prepare(
          `
          UPDATE checklist_items
          SET is_checked = ?, updated_at = ?
          WHERE id = ? AND section_id = ? AND business_id = ?
          `
        )
        .bind(isChecked, Math.floor(Date.now() / 1000), id, section.id, businessId)
        .run();

      return { success: true };
    },
    reset_checklist: async ({ locals }: { locals: ChecklistLocals }) => {
      const db = locals.DB;
      if (!db) return fail(503, { error: 'Database not configured.' });
      await ensureTenantSchema(db);
      const businessId = locals.businessId ?? '';

      const section = await getSection(db, sectionSlug, businessId);
      if (!section) return fail(404, { error: 'Checklist not found.' });

      await db
        .prepare(`UPDATE checklist_items SET is_checked = 0, updated_at = ? WHERE section_id = ? AND business_id = ?`)
        .bind(Math.floor(Date.now() / 1000), section.id, businessId)
        .run();

      return { success: true };
    }
  };

  return { load, actions };
}
