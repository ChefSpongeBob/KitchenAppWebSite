import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type ItemRow = {
  id: string;
  content: string;
  amount: number;
  par_count: number;
  is_checked: number;
};

const SECTION_SLUG = 'sushi';
const PAGE_TITLE = 'Sushi Prep';

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { title: PAGE_TITLE, items: [], isAdmin: false };

  const section = await db
    .prepare(`SELECT id FROM list_sections WHERE domain = 'preplists' AND slug = ? LIMIT 1`)
    .bind(SECTION_SLUG)
    .first<{ id: string }>();

  if (!section) return { title: PAGE_TITLE, items: [], isAdmin: locals.userRole === 'admin' };

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
    title: PAGE_TITLE,
    items: items.results ?? [],
    isAdmin: locals.userRole === 'admin'
  };
};

export const actions: Actions = {
  update_content: async ({ request, locals }) => {
    if (locals.userRole !== 'admin') return fail(403, { error: 'Admin only.' });
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '');
    const content = String(formData.get('content') ?? '').trim();
    if (!id || !content) return fail(400, { error: 'Invalid item content.' });

    await db
      .prepare(`UPDATE list_items SET content = ?, updated_at = ? WHERE id = ?`)
      .bind(content, Math.floor(Date.now() / 1000), id)
      .run();

    return { success: true };
  },
  update_amount: async ({ request, locals }) => {
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '');
    const amount = Number(formData.get('amount'));
    if (!id || !Number.isFinite(amount) || amount < 0) return fail(400, { error: 'Invalid amount.' });

    await db
      .prepare(`UPDATE list_items SET amount = ?, updated_at = ? WHERE id = ?`)
      .bind(amount, Math.floor(Date.now() / 1000), id)
      .run();

    return { success: true };
  },
  toggle_checked: async ({ request, locals }) => {
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '');
    const isChecked = Number(formData.get('is_checked'));
    if (!id || (isChecked !== 0 && isChecked !== 1)) return fail(400, { error: 'Invalid completion state.' });

    await db
      .prepare(`UPDATE list_items SET is_checked = ?, updated_at = ? WHERE id = ?`)
      .bind(isChecked, Math.floor(Date.now() / 1000), id)
      .run();

    return { success: true };
  },
  update_par: async ({ request, locals }) => {
    if (locals.userRole !== 'admin') return fail(403, { error: 'Admin only.' });
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '');
    const parCount = Number(formData.get('par_count'));
    if (!id || !Number.isFinite(parCount) || parCount < 0) return fail(400, { error: 'Invalid par count.' });

    await db
      .prepare(`UPDATE list_items SET par_count = ?, updated_at = ? WHERE id = ?`)
      .bind(parCount, Math.floor(Date.now() / 1000), id)
      .run();

    return { success: true };
  }
};
