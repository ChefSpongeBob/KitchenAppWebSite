import { fail } from '@sveltejs/kit';

type DB = App.Platform['env']['DB'];
type ChecklistLocals = {
  DB?: DB;
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
};

async function getSection(db: DB, slug: string) {
  return db
    .prepare(`SELECT id FROM checklist_sections WHERE slug = ? LIMIT 1`)
    .bind(slug)
    .first<{ id: string }>();
}

async function seedDefaultsIfMissing(db: DB, sectionId: string, defaults: DefaultItem[]) {
  const existing = await db
    .prepare(`SELECT COUNT(*) AS count FROM checklist_items WHERE section_id = ?`)
    .bind(sectionId)
    .first<{ count: number }>();

  if ((existing?.count ?? 0) > 0) return;

  const now = Math.floor(Date.now() / 1000);
  for (const [index, item] of defaults.entries()) {
    await db
      .prepare(
        `
        INSERT INTO checklist_items (
          id, section_id, content, sort_order, is_checked, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, 0, ?, ?)
        `
      )
      .bind(crypto.randomUUID(), sectionId, item.content, index, now, now)
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
        items: []
      };
    }

    const section = await getSection(db, sectionSlug);
    if (!section) {
      return {
        title: pageTitle,
        subtitle: options.subtitle,
        resetLabel: options.resetLabel,
        items: []
      };
    }

    await seedDefaultsIfMissing(db, section.id, options.defaults);

    const items = await db
      .prepare(
        `
        SELECT id, content, is_checked
        FROM checklist_items
        WHERE section_id = ?
        ORDER BY sort_order ASC, created_at ASC
        `
      )
      .bind(section.id)
      .all<ChecklistItem>();

    return {
      title: pageTitle,
      subtitle: options.subtitle,
      resetLabel: options.resetLabel,
      items: items.results ?? []
    };
  };

  const actions = {
    toggle_checked: async ({ request, locals }: { request: Request; locals: ChecklistLocals }) => {
      const db = locals.DB;
      if (!db) return fail(503, { error: 'Database not configured.' });

      const section = await getSection(db, sectionSlug);
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
          WHERE id = ? AND section_id = ?
          `
        )
        .bind(isChecked, Math.floor(Date.now() / 1000), id, section.id)
        .run();

      return { success: true };
    },
    reset_checklist: async ({ locals }: { locals: ChecklistLocals }) => {
      const db = locals.DB;
      if (!db) return fail(503, { error: 'Database not configured.' });

      const section = await getSection(db, sectionSlug);
      if (!section) return fail(404, { error: 'Checklist not found.' });

      await db
        .prepare(`UPDATE checklist_items SET is_checked = 0, updated_at = ? WHERE section_id = ?`)
        .bind(Math.floor(Date.now() / 1000), section.id)
        .run();

      return { success: true };
    }
  };

  return { load, actions };
}
