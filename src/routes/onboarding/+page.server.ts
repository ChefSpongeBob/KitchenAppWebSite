import type { Actions, PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import {
  loadAdminEmployeeProfile,
  loadEmployeeOnboarding,
  submitEmployeeOnboardingItem,
  submitEmployeeOnboardingPacket
} from '#lib/server/admin.ts';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId || !locals.businessId || !locals.DB) throw redirect(303, '/login');

  const [user, profile, onboarding] = await Promise.all([
    locals.DB
      .prepare(`SELECT id, display_name, email FROM users WHERE id = ? LIMIT 1`)
      .bind(locals.userId)
      .first<{ id: string; display_name: string | null; email: string }>(),
    loadAdminEmployeeProfile(locals.DB, locals.userId, locals.businessId),
    loadEmployeeOnboarding(locals.DB, locals.userId, locals.businessId, {
      env: locals.env,
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
  submit_item: ({ request, locals }) =>
    submitEmployeeOnboardingItem(request, locals, locals.env),
  submit_packet: ({ request, locals }) => submitEmployeeOnboardingPacket(request, locals)
};
