import type { LayoutServerLoad } from './$types';
import {
	buildFeatureAccess,
	defaultAppFeatureModes,
	type AppFeatureModes
} from '$lib/features/appFeatures';
import { loadUserBusinessMemberships } from '$lib/server/business';

export const load: LayoutServerLoad = async ({ locals }) => {
	const featureModes: AppFeatureModes = locals.featureModes ?? defaultAppFeatureModes;
	if (!locals.userId) {
		return {
			user: null,
			featureModes,
			featureAccess: buildFeatureAccess(featureModes, null)
		};
	}

	const businesses =
		locals.DB && locals.userId ? await loadUserBusinessMemberships(locals.DB, locals.userId) : [];
	const preferences = locals.DB && locals.userId
		? await locals.DB
				.prepare(
					`
					SELECT dark_mode, push_updates
					FROM user_preferences
					WHERE user_id = ?
					LIMIT 1
					`
				)
				.bind(locals.userId)
				.first<{ dark_mode: number; push_updates: number }>()
				.catch(() => null)
		: null;

	return {
		user: {
			id: locals.userId,
			role: locals.userRole,
			businessId: locals.businessId ?? null,
			businessName: locals.businessName ?? null,
			businessLogoUrl: locals.businessLogoUrl ?? null,
			businessRole: locals.businessRole ?? null,
			businessPermissionTemplate: locals.businessPermissionTemplate ?? null,
			businessCapabilities: locals.businessCapabilities ?? [],
			businessOnboardingComplete: locals.businessOnboardingComplete ?? false,
			businesses,
			preferredTheme: preferences?.dark_mode === 1 ? 'dark' : 'light',
			pushNotificationsEnabled: preferences?.push_updates === 1
		},
		featureModes,
		featureAccess: buildFeatureAccess(
			featureModes,
			locals.businessRole ?? locals.userRole,
			locals.businessPermissionTemplate,
			locals.businessCapabilities
		)
	};
};
