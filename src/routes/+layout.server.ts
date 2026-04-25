import type { LayoutServerLoad } from './$types';
import {
	buildFeatureAccess,
	defaultAppFeatureModes,
	type AppFeatureModes
} from '$lib/features/appFeatures';

export const load: LayoutServerLoad = async ({ locals }) => {
	const featureModes: AppFeatureModes = locals.featureModes ?? defaultAppFeatureModes;
	if (!locals.userId) {
		return {
			user: null,
			featureModes,
			featureAccess: buildFeatureAccess(featureModes, null)
		};
	}

	return {
		user: {
			id: locals.userId,
			role: locals.userRole,
			businessId: locals.businessId ?? null,
			businessName: locals.businessName ?? null,
			businessLogoUrl: locals.businessLogoUrl ?? null,
			businessRole: locals.businessRole ?? null,
			businessOnboardingComplete: locals.businessOnboardingComplete ?? false
		},
		featureModes,
		featureAccess: buildFeatureAccess(featureModes, locals.userRole)
	};
};
