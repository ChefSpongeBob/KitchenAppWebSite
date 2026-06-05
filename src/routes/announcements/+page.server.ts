import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  loadHomepageAnnouncement,
  saveHomepageAnnouncement,
  userCanEditHomepageAnnouncement
} from '$lib/server/announcements';
import { ensureTenantSchema } from '$lib/server/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) {
    throw redirect(303, '/login');
  }

  const db = locals.DB;
  if (!db) {
    return { announcement: { content: '', updatedAt: 0 }, canEdit: false };
  }

  const announcement = await loadHomepageAnnouncement(db, locals.businessId);
  const canEdit = await userCanEditHomepageAnnouncement(
    db,
    locals.userId,
    locals.businessRole ?? locals.userRole,
    locals.businessId,
    locals.businessPermissionTemplate,
    locals.businessCapabilities
  );

  return { announcement, canEdit };
};

export const actions: Actions = {
  save_announcement: async ({ request, locals }) => {
    if (!locals.userId) {
      throw redirect(303, '/login');
    }

    const db = locals.DB;
    if (!db) {
      return fail(503, { error: 'Database not configured.' });
    }
    if (!locals.businessId) {
      return fail(404, { error: 'Workspace not found.' });
    }

    await ensureTenantSchema(db, true);
    const canEdit = await userCanEditHomepageAnnouncement(
      db,
      locals.userId,
      locals.businessRole ?? locals.userRole,
      locals.businessId,
      locals.businessPermissionTemplate,
      locals.businessCapabilities
    );
    if (!canEdit) {
      return fail(403, { error: 'You do not have permission to edit announcements.' });
    }

    const formData = await request.formData();
    const content = String(formData.get('content') ?? '').trim();
    if (content.length > 2000) {
      return fail(400, { error: 'Announcement is too long.' });
    }
    await saveHomepageAnnouncement(db, locals.businessId, locals.userId, content);

    return { success: true };
  }
};
