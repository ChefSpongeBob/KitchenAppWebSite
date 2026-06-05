import { redirect } from '@sveltejs/kit';
import { hasAdminAccess } from '$lib/server/permissions';
import type { PageServerLoad } from './$types';
import type { WelcomeTourVariant } from '$lib/server/userPreferences';

function resolveWelcomeVariant(locals: App.Locals): WelcomeTourVariant {
  return hasAdminAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)
    ? 'admin'
    : 'user';
}

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.userId || !locals.DB) {
    throw redirect(303, '/login');
  }

  const forcedVariant = String(url.searchParams.get('variant') ?? '').trim().toLowerCase();
  const roleVariant = resolveWelcomeVariant(locals);
  const variant: WelcomeTourVariant =
    forcedVariant === 'admin' || forcedVariant === 'user' ? forcedVariant : roleVariant;

  throw redirect(303, `/welcome/${variant}`);
};
