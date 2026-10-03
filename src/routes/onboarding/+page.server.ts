import type { Actions, PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import {
  loadAdminEmployeeProfile,
  loadEmployeeOnboarding,
  submitEmployeeOnboardingItem,
  submitEmployeeOnboardingPacket
} from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.userId || !locals.businessId || !locals.DB) throw redirect(303, '/login');

  const [user, profile, onboarding] = await Promise.all([
    locals.DB
      .prepare(`SELECT id, display_name, email FROM users WHERE id = ? LIMIT 1`)
      .bind(locals.userId)
      .first<{ id: string; display_name: string | null; email: string }>(),
    loadAdminEmployeeProfile(locals.DB, locals.userId, locals.businessId),
    loadEmployeeOnboarding(locals.DB, locals.userId, locals.businessId, {
      env: platform?.env,
      actorUserId: locals.userId,
      actorBusinessRole: locals.businessRole,
      actorPermissionTemplate: locals.businessPermissionTemplate,
      actorCapabilities: locals.businessCapabilities
    })
  ]);

  if (!user) throw redirect(303, '/login');
  return { user, profile, onboarding };
};

export const actions: Actions = {
  submit_item: ({ request, locals, platform }) =>
    submitEmployeeOnboardingItem(request, locals, platform?.env),
  submit_packet: ({ request, locals }) => submitEmployeeOnboardingPacket(request, locals)
};
