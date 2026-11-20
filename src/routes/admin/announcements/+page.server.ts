import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  deleteAnnouncementHistory,
  loadAdminAnnouncement,
  loadAdminAnnouncementHistory,
  saveAnnouncement
} from '#lib/server/admin.ts';
import { requireFeatureAccess } from '#lib/server/featureAccess.ts';
import { hasBusinessCapability } from '#lib/server/permissions.ts';
import { requireBusinessId } from '#lib/server/tenant.ts';

function requireAnnouncementEditor(locals: App.Locals) {
  if (!locals.userId) throw error(401, 'Sign in required.');
  if (!hasBusinessCapability(
    locals.businessRole, locals.businessPermissionTemplate, 'manage_announcements', locals.businessCapabilities
  )) throw error(403, 'Announcement access required.');
  requireFeatureAccess(locals, 'announcements');
  return requireBusinessId(locals);
}

export const load: PageServerLoad = async ({ locals }) => {
  const businessId = requireAnnouncementEditor(locals);
  if (!locals.DB) throw error(503, 'Database not configured.');
  const [announcement, history] = await Promise.all([
    loadAdminAnnouncement(locals.DB, businessId),
    loadAdminAnnouncementHistory(locals.DB, businessId)
  ]);
  return { announcement, history };
};

export const actions: Actions = {
  save_announcement: ({ request, locals }) => {
    requireAnnouncementEditor(locals);
    return saveAnnouncement(request, locals);
  },
  delete_announcement_history: ({ request, locals }) => {
    requireAnnouncementEditor(locals);
    return deleteAnnouncementHistory(request, locals);
  }
};
