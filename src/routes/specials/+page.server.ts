import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  dailySpecialCategories,
  ensureDailySpecialsSchema,
  loadDailySpecials,
  userCanEditDailySpecials
} from '$lib/server/dailySpecials';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) {
    throw redirect(303, '/login');
  }

  const db = locals.DB;
  if (!db) {
    return { specials: [], canEdit: false };
  }

  const specials = await loadDailySpecials(db);
  const canEdit = await userCanEditDailySpecials(db, locals.userId, locals.userRole);

  return { specials, canEdit };
};

export const actions: Actions = {
  save_specials: async ({ request, locals }) => {
    if (!locals.userId) {
      throw redirect(303, '/login');
    }

    const db = locals.DB;
    if (!db) {
      return fail(503, { error: 'Database not configured.' });
    }

    await ensureDailySpecialsSchema(db);

    const canEdit = await userCanEditDailySpecials(db, locals.userId, locals.userRole);
    if (!canEdit) {
      return fail(403, { error: 'You do not have permission to edit daily specials.' });
    }

    const formData = await request.formData();
    const now = Math.floor(Date.now() / 1000);

    for (const category of dailySpecialCategories) {
      const content = String(formData.get(category) ?? '').trim();
      await db
        .prepare(
          `
          INSERT INTO daily_specials (category, content, updated_by, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(category) DO UPDATE SET
            content = excluded.content,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
          `
        )
        .bind(category, content, locals.userId, now)
        .run();
    }

    return { success: true };
  }
};
