import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadHomepageAnnouncement } from '$lib/server/announcements';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) {
    throw redirect(303, '/login');
  }

  const db = locals.DB;
  if (!db) {
    return { announcement: { content: '', updatedAt: 0 } };
  }

  const announcement = await loadHomepageAnnouncement(db, locals.businessId);
  return { announcement };
};
