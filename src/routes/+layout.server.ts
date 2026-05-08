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

	return {
		user: {
			id: locals.userId,
			role: locals.userRole,
			businessId: locals.businessId ?? null,
			businessName: locals.businessName ?? null,
			businessLogoUrl: locals.businessLogoUrl ?? null,
			businessRole: locals.businessRole ?? null,
			businessOnboardingComplete: locals.businessOnboardingComplete ?? false,
			businesses
		},
		featureModes,
		featureAccess: buildFeatureAccess(featureModes, locals.userRole)
	};
};
