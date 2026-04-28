import { fail } from '@sveltejs/kit';
import { ensureTenantSchema } from '$lib/server/tenant';

type ItemRow = {
  id: string;
  content: string;
  details?: string | null;
  amount: number;
  amount_text?: string | null;
  par_count: number;
  is_checked: number;
};

type DB = App.Platform['env']['DB'];
type PreplistLocals = {
  DB?: DB;
  userRole?: string | null;
  businessId?: string | null;
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
  valueType?: 'number' | 'text';
};

function parseNonNegativeNumber(raw: FormDataEntryValue | null, fieldName: string) {
  if (raw === null) return { ok: false as const, error: `${fieldName} is required.` };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false as const, error: `${fieldName} must be a non-negative number.` };
  }
  return { ok: true as const, value };
}

async function getSection(db: DB, domain: Domain, sectionSlug: string, businessId: string) {
  return db
    .prepare(`SELECT id FROM list_sections WHERE domain = ? AND slug = ? AND business_id = ? LIMIT 1`)
    .bind(domain, sectionSlug, businessId)
    .first<{ id: string }>();
}

async function seedDefaultsIfMissing(
  db: DB,
  sectionId: string,
  defaults: DefaultItem[] | undefined,
  businessId: string
) {
  if (!defaults?.length) return;

  const existing = await db
    .prepare(`SELECT COUNT(*) AS count FROM list_items WHERE section_id = ? AND business_id = ?`)
    .bind(sectionId, businessId)
    .first<{ count: number }>();

  if ((existing?.count ?? 0) > 0) return;

  const now = Math.floor(Date.now() / 1000);
  for (const [index, item] of defaults.entries()) {
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
      .bind(crypto.randomUUID(), sectionId, item.content, index, item.par_count ?? 0, now, now, businessId)
      .run();
  }
}

async function hasAmountTextColumn(db: DB) {
  const columns = await db.prepare(`PRAGMA table_info(list_items)`).all<{
    name: string;
  }>();
  return (columns.results ?? []).some((column) => column.name === 'amount_text');
}

async function hasDetailsColumn(db: DB) {
  const columns = await db.prepare(`PRAGMA table_info(list_items)`).all<{
    name: string;
  }>();
  return (columns.results ?? []).some((column) => column.name === 'details');
}

export function createListPage(
  domain: Domain,
  sectionSlug: string,
  pageTitle: string,
  options: ListPageOptions
) {
  const load = async ({ locals }: { locals: PreplistLocals }) => {
    const db = locals.DB;
    const useTextValues = options.valueType === 'text';
    const amountTextEnabled = db && useTextValues ? await hasAmountTextColumn(db) : false;
    const detailsEnabled = db ? await hasDetailsColumn(db) : false;
    if (!db) {
      return {
        title: pageTitle,
        subtitle: options.subtitle,
        items: [],
        isAdmin: false,
        valueLabel: options.valueLabel,
        submitLabel: options.submitLabel,
        resetLabel: options.resetLabel,
        adminSummaryLabel: options.adminSummaryLabel,
        valueType: options.valueType ?? 'number'
      };
    }
    await ensureTenantSchema(db);
    const businessId = locals.businessId ?? '';

    const section = await getSection(db, domain, sectionSlug, businessId);

    if (!section) {
      return {
        title: pageTitle,
        subtitle: options.subtitle,
        items: [],
        isAdmin: locals.userRole === 'admin',
        valueLabel: options.valueLabel,
        submitLabel: options.submitLabel,
        resetLabel: options.resetLabel,
        adminSummaryLabel: options.adminSummaryLabel,
        valueType: options.valueType ?? 'number'
      };
    }

    await seedDefaultsIfMissing(db, section.id, options.defaults, businessId);

    const items = await db
      .prepare(
        `
        SELECT id, content, ${detailsEnabled ? 'details' : "'' AS details"}, amount, ${amountTextEnabled ? 'amount_text' : "'' AS amount_text"}, par_count, is_checked
        FROM list_items
        WHERE section_id = ? AND business_id = ?
        ORDER BY sort_order ASC, created_at ASC
      `
      )
      .bind(section.id, businessId)
      .all<ItemRow>();

    return {
      title: pageTitle,
      subtitle: options.subtitle,
      items: (items.results ?? []).map((item) => ({
        ...item,
        details: detailsEnabled ? (item.details ?? '') : '',
        amount_text:
          amountTextEnabled
            ? (item.amount_text ?? '')
            : String(item.amount ?? 0)
      })),
      isAdmin: locals.userRole === 'admin',
      valueLabel: options.valueLabel,
      submitLabel: options.submitLabel,
      resetLabel: options.resetLabel,
      adminSummaryLabel: options.adminSummaryLabel,
      valueType: options.valueType ?? 'number'
    };
  };

  const actions = {
    submit_prep_counts: async ({ request, locals }: { request: Request; locals: PreplistLocals }) => {
      const db = locals.DB;
      if (!db) return fail(503, { error: 'Database not configured.' });
      await ensureTenantSchema(db);
      const businessId = locals.businessId ?? '';

      const section = await getSection(db, domain, sectionSlug, businessId);
      if (!section) return fail(404, { error: 'List section not found.' });

      const formData = await request.formData();
      const items = await db
        .prepare(`SELECT id FROM list_items WHERE section_id = ? AND business_id = ?`)
        .bind(section.id, businessId)
        .all<{ id: string }>();

      const now = Math.floor(Date.now() / 1000);
      let updatedCount = 0;
      const useTextValues = options.valueType === 'text';
      const amountTextEnabled = useTextValues ? await hasAmountTextColumn(db) : false;
      for (const item of items.results ?? []) {
        const raw = formData.get(`amount_${item.id}`);
        if (raw === null) continue;
        if (useTextValues && amountTextEnabled) {
          const value = String(raw).trim();
          await db
            .prepare(`UPDATE list_items SET amount_text = ?, updated_at = ? WHERE id = ? AND business_id = ?`)
            .bind(value, now, item.id, businessId)
            .run();
        } else {
          const parsed = parseNonNegativeNumber(raw, options.valueLabel);
          if (!parsed.ok) return fail(400, { error: parsed.error });

          await db
            .prepare(`UPDATE list_items SET amount = ?, updated_at = ? WHERE id = ? AND business_id = ?`)
            .bind(parsed.value, now, item.id, businessId)
            .run();
        }
        updatedCount += 1;
      }
      if (updatedCount === 0) return fail(400, { error: `No ${options.valueLabel.toLowerCase()} values were submitted.` });

      return { success: true };
    },
    new_prep_list: async ({ locals }: { locals: PreplistLocals }) => {
      const db = locals.DB;
      if (!db) return fail(503, { error: 'Database not configured.' });
      await ensureTenantSchema(db);
      const businessId = locals.businessId ?? '';

      const section = await getSection(db, domain, sectionSlug, businessId);
      if (!section) return fail(404, { error: 'List section not found.' });

      const now = Math.floor(Date.now() / 1000);
      const useTextValues = options.valueType === 'text';
      const amountTextEnabled = useTextValues ? await hasAmountTextColumn(db) : false;

      if (useTextValues && amountTextEnabled) {
        await db
          .prepare(
            `UPDATE list_items SET amount = 0, amount_text = '', is_checked = 0, updated_at = ? WHERE section_id = ? AND business_id = ?`
          )
          .bind(now, section.id, businessId)
          .run();
      } else {
        await db
          .prepare(`UPDATE list_items SET amount = 0, is_checked = 0, updated_at = ? WHERE section_id = ? AND business_id = ?`)
          .bind(now, section.id, businessId)
          .run();
      }

      return { success: true };
    },
    toggle_checked: async ({ request, locals }: { request: Request; locals: PreplistLocals }) => {
      const db = locals.DB;
      if (!db) return fail(503, { error: 'Database not configured.' });
      await ensureTenantSchema(db);
      const businessId = locals.businessId ?? '';

      const section = await getSection(db, domain, sectionSlug, businessId);
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
          WHERE id = ? AND section_id = ? AND business_id = ?
        `
        )
        .bind(isChecked, Math.floor(Date.now() / 1000), id, section.id, businessId)
        .run();

      return { success: true };
    },
    save_par_levels: async ({ request, locals }: { request: Request; locals: PreplistLocals }) => {
      if (locals.userRole !== 'admin') return fail(403, { error: 'Admin only.' });
      const db = locals.DB;
      if (!db) return fail(503, { error: 'Database not configured.' });
      await ensureTenantSchema(db);
      const businessId = locals.businessId ?? '';

      const section = await getSection(db, domain, sectionSlug, businessId);
      if (!section) return fail(404, { error: 'List section not found.' });

      const formData = await request.formData();
      const items = await db
        .prepare(`SELECT id FROM list_items WHERE section_id = ? AND business_id = ?`)
        .bind(section.id, businessId)
        .all<{ id: string }>();

      const now = Math.floor(Date.now() / 1000);
      for (const item of items.results ?? []) {
        const raw = formData.get(`par_${item.id}`);
        if (raw === null) continue;
        const parsed = parseNonNegativeNumber(raw, 'Par count');
        if (!parsed.ok) return fail(400, { error: parsed.error });

        await db
          .prepare(`UPDATE list_items SET par_count = ?, updated_at = ? WHERE id = ? AND business_id = ?`)
          .bind(parsed.value, now, item.id, businessId)
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
    adminSummaryLabel: '+ Admin Par Levels',
    valueType: 'text'
  });
}
