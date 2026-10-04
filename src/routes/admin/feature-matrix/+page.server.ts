import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  appFeatureDefinitions,
  isValidAppFeatureMode,
  type AppFeatureKey,
  type AppFeatureMode
} from '$lib/features/appFeatures';
import { requireAdmin } from '$lib/server/admin';
import { loadAppFeatureModes, saveAppFeatureModes } from '$lib/server/appFeatures';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return {
      features: appFeatureDefinitions.map((feature) => ({
        ...feature,
        mode: 'all' as AppFeatureMode
      }))
    };
  }

  const featureModes = await loadAppFeatureModes(db, locals.businessId);
  return {
    features: appFeatureDefinitions.map((feature) => ({
      ...feature,
      mode: featureModes[feature.key]
    }))
  };
};

export const actions: Actions = {
  save: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) {
      return fail(503, { error: 'Database is not configured.' });
    }
    if (!locals.businessId) {
      return fail(400, { error: 'No active business was found for this account.' });
    }

    const formData = await request.formData();
    const nextModes: Partial<Record<AppFeatureKey, AppFeatureMode>> = {};
    for (const feature of appFeatureDefinitions) {
      const value = String(formData.get(`feature_${feature.key}`) ?? '').trim();
      if (!isValidAppFeatureMode(value)) {
        return fail(400, { error: `Invalid mode selected for ${feature.label}.` });
      }
      nextModes[feature.key] = value;
    }

    await saveAppFeatureModes(db, nextModes, locals.userId ?? null, locals.businessId);
    locals.featureModes = await loadAppFeatureModes(db, locals.businessId);

    return {
      success: true,
      message: 'Feature Matrix saved.'
    };
  }
};
