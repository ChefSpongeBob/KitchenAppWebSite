import { fail } from '@sveltejs/kit';

type ItemRow = {
  id: string;
  content: string;
  amount: number;
  par_count: number;
  is_checked: number;
};

type DB = App.Platform['env']['DB'];
type PreplistLocals = {
  DB?: DB;
  userRole?: string | null;
};

type Domain = 'preplists' | 'inventory' | 'orders';

type DefaultItem = {
  content: string;
  par_count?: number;
};

type ListPageOptions = {
  subtitle: string;
  valueLabel: string;
  submitLabel: string;
  resetLabel: string;
  adminSummaryLabel: string;
  defaults?: DefaultItem[];
};

function parseNonNegativeNumber(raw: FormDataEntryValue | null, fieldName: string) {
  if (raw === null) return { ok: false as const, error: `${fieldName} is required.` };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false as const, error: `${fieldName} must be a non-negative number.` };
  }
  return { ok: true as const, value };
}

async function getSection(db: DB, domain: Domain, sectionSlug: string) {
  return db
    .prepare(`SELECT id FROM list_sections WHERE domain = ? AND slug = ? LIMIT 1`)
    .bind(domain, sectionSlug)
    .first<{ id: string }>();
}

async function seedDefaultsIfMissing(
  db: DB,
  sectionId: string,
  defaults: DefaultItem[] | undefined
) {
  if (!defaults?.length) return;

  const existing = await db
    .prepare(`SELECT COUNT(*) AS count FROM list_items WHERE section_id = ?`)
    .bind(sectionId)
    .first<{ count: number }>();

  if ((existing?.count ?? 0) > 0) return;

  const now = Math.floor(Date.now() / 1000);
  for (const [index, item] of defaults.entries()) {
    await db
      .prepare(
        `
        INSERT INTO list_items (
          id, section_id, content, sort_order, is_checked,
          amount, par_count, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)
        `
      )
      .bind(crypto.randomUUID(), sectionId, item.content, index, item.par_count ?? 0, now, now)
      .run();
  }
}

export function createListPage(
  domain: Domain,
  sectionSlug: string,
  pageTitle: string,
  options: ListPageOptions
) {
  const load = async ({ locals }: { locals: PreplistLocals }) => {
    const db = locals.DB;
    if (!db) {
      return {
        title: pageTitle,
        subtitle: options.subtitle,
        items: [],
        isAdmin: false,
        valueLabel: options.valueLabel,
        submitLabel: options.submitLabel,
        resetLabel: options.resetLabel,
        adminSummaryLabel: options.adminSummaryLabel
      };
    }

    const section = await getSection(db, domain, sectionSlug);

    if (!section) {
      return {
        title: pageTitle,
        subtitle: options.subtitle,
        items: [],
        isAdmin: locals.userRole === 'admin',
        valueLabel: options.valueLabel,
        submitLabel: options.submitLabel,
        resetLabel: options.resetLabel,
        adminSummaryLabel: options.adminSummaryLabel
      };
    }

    await seedDefaultsIfMissing(db, section.id, options.defaults);

    const items = await db
      .prepare(
        `
        SELECT id, content, amount, par_count, is_checked
        FROM list_items
        WHERE section_id = ?
        ORDER BY sort_order ASC, created_at ASC
      `
      )
      .bind(section.id)
      .all<ItemRow>();

    return {
      title: pageTitle,
      subtitle: options.subtitle,
      items: items.results ?? [],
      isAdmin: locals.userRole === 'admin',
      valueLabel: options.valueLabel,
      submitLabel: options.submitLabel,
      resetLabel: options.resetLabel,
      adminSummaryLabel: options.adminSummaryLabel
    };
  };

  const actions = {
    submit_prep_counts: async ({ request, locals }: { request: Request; locals: PreplistLocals }) => {
      const db = locals.DB;
      if (!db) return fail(503, { error: 'Database not configured.' });

      const section = await getSection(db, domain, sectionSlug);
      if (!section) return fail(404, { error: 'List section not found.' });

      const formData = await request.formData();
      const items = await db
        .prepare(`SELECT id FROM list_items WHERE section_id = ?`)
        .bind(section.id)
        .all<{ id: string }>();

      const now = Math.floor(Date.now() / 1000);
      let updatedCount = 0;
      for (const item of items.results ?? []) {
        const raw = formData.get(`amount_${item.id}`);
        if (raw === null) continue;
        const parsed = parseNonNegativeNumber(raw, options.valueLabel);
        if (!parsed.ok) return fail(400, { error: parsed.error });

        await db
          .prepare(`UPDATE list_items SET amount = ?, updated_at = ? WHERE id = ?`)
          .bind(parsed.value, now, item.id)
          .run();
        updatedCount += 1;
      }
      if (updatedCount === 0) return fail(400, { error: `No ${options.valueLabel.toLowerCase()} values were submitted.` });

      return { success: true };
    },
    new_prep_list: async ({ locals }: { locals: PreplistLocals }) => {
      const db = locals.DB;
      if (!db) return fail(503, { error: 'Database not configured.' });

      const section = await getSection(db, domain, sectionSlug);
      if (!section) return fail(404, { error: 'List section not found.' });

      await db
        .prepare(`UPDATE list_items SET amount = 0, is_checked = 0, updated_at = ? WHERE section_id = ?`)
        .bind(Math.floor(Date.now() / 1000), section.id)
        .run();

      return { success: true };
    },
    toggle_checked: async ({ request, locals }: { request: Request; locals: PreplistLocals }) => {
      const db = locals.DB;
      if (!db) return fail(503, { error: 'Database not configured.' });

      const section = await getSection(db, domain, sectionSlug);
      if (!section) return fail(404, { error: 'List section not found.' });

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
          UPDATE list_items
          SET is_checked = ?, updated_at = ?
          WHERE id = ? AND section_id = ?
        `
        )
        .bind(isChecked, Math.floor(Date.now() / 1000), id, section.id)
        .run();

      return { success: true };
    },
    save_par_levels: async ({ request, locals }: { request: Request; locals: PreplistLocals }) => {
      if (locals.userRole !== 'admin') return fail(403, { error: 'Admin only.' });
      const db = locals.DB;
      if (!db) return fail(503, { error: 'Database not configured.' });

      const section = await getSection(db, domain, sectionSlug);
      if (!section) return fail(404, { error: 'List section not found.' });

      const formData = await request.formData();
      const items = await db
        .prepare(`SELECT id FROM list_items WHERE section_id = ?`)
        .bind(section.id)
        .all<{ id: string }>();

      const now = Math.floor(Date.now() / 1000);
      for (const item of items.results ?? []) {
        const raw = formData.get(`par_${item.id}`);
        if (raw === null) continue;
        const parsed = parseNonNegativeNumber(raw, 'Par count');
        if (!parsed.ok) return fail(400, { error: parsed.error });

        await db
          .prepare(`UPDATE list_items SET par_count = ?, updated_at = ? WHERE id = ?`)
          .bind(parsed.value, now, item.id)
          .run();
      }

      return { success: true };
    }
  };

  return { load, actions };
}

export function createPreplistPage(sectionSlug: string, pageTitle: string) {
  return createListPage('preplists', sectionSlug, pageTitle, {
    subtitle: 'Submit prep counts together. Admins can adjust par levels in admin tools.',
    valueLabel: 'Prep',
    submitLabel: 'Submit Prep Counts',
    resetLabel: 'New Prep List (Reset to 0)',
    adminSummaryLabel: '+ Admin Par Levels'
  });
}
