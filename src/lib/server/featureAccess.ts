import { error } from '@sveltejs/kit';
import {
  buildFeatureAccess,
  defaultAppFeatureModes,
  type AppFeatureKey
} from '#lib/features/appFeatures.ts';

// The request guard supplies fresh tenant modes before resolving private routes.
export function featureAccessForLocals(locals: App.Locals) {
  return buildFeatureAccess(
    locals.featureModes ?? defaultAppFeatureModes,
    locals.businessRole ?? locals.userRole,
    locals.businessPermissionTemplate,
    locals.businessCapabilities
  );
}

export function requireFeatureAccess(locals: App.Locals, ...features: AppFeatureKey[]) {
  const access = featureAccessForLocals(locals);
  if (features.some((feature) => !access[feature])) {
    error(403, 'This feature is unavailable for this workspace.');
  }
}
