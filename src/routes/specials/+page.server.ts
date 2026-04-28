import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  dailySpecialCategories,
  ensureDailySpecialsSchema,
  getDailySpecialStorageCategory,
  loadDailySpecials,
  userCanEditDailySpecials
} from '$lib/server/dailySpecials';
import { ensureTenantSchema } from '$lib/server/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) {
    throw redirect(303, '/login');
  }

  const db = locals.DB;
  if (!db) {
    return { specials: [], canEdit: false };
  }

  const specials = await loadDailySpecials(db, locals.businessId);
  const canEdit = await userCanEditDailySpecials(db, locals.userId, locals.userRole, locals.businessId);

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
    await ensureTenantSchema(db, true);

    const canEdit = await userCanEditDailySpecials(db, locals.userId, locals.userRole, locals.businessId);
    if (!canEdit) {
      return fail(403, { error: 'You do not have permission to edit daily specials.' });
    }

    const formData = await request.formData();
    const now = Math.floor(Date.now() / 1000);

    for (const category of dailySpecialCategories) {
      const content = String(formData.get(category) ?? '').trim();
      const storageCategory = getDailySpecialStorageCategory(category, locals.businessId);
      await db
        .prepare(
          `
          INSERT INTO daily_specials (category, content, updated_by, updated_at, business_id)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(category) DO UPDATE SET
            content = excluded.content,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at,
            business_id = excluded.business_id
          `
        )
        .bind(storageCategory, content, locals.userId, now, locals.businessId ?? null)
        .run();
    }

    return { success: true };
  }
};
