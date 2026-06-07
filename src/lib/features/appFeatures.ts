import {
  hasPrivilegedFeatureAccess,
  hasVendorAccess,
  type BusinessCapability
} from '$lib/auth/roles';

export type AppFeatureMode = 'all' | 'admin' | 'off';

export type AppFeatureKey =
  | 'scheduling'
  | 'todo'
  | 'whiteboard'
  | 'temps'
  | 'announcements'
  | 'employee_spotlight'
  | 'daily_specials'
  | 'lists'
  | 'recipes'
  | 'documents'
  | 'menus'
  | 'vendors'
  | 'conversions'
  | 'food_cost_calculator'
  | 'safety_healthcode'
  | 'waste_tracker';

export type AppFeatureDefinition = {
  key: AppFeatureKey;
  label: string;
  description: string;
  userRoutePrefixes: string[];
  adminRoutePrefixes: string[];
};

const creatorEditorFeatureMap: Partial<Record<string, AppFeatureKey>> = {
  list: 'lists',
  recipe: 'recipes',
  document: 'documents',
  menu: 'menus'
};

export type AppFeatureModes = Record<AppFeatureKey, AppFeatureMode>;
export type AppFeatureAccess = Record<AppFeatureKey, boolean>;

export const appFeatureDefinitions: AppFeatureDefinition[] = [
  {
    key: 'scheduling',
    label: 'Scheduling',
    description: 'Shift calendar, weekly schedule views, and schedule builder tools.',
    userRoutePrefixes: ['/schedule', '/my-schedule'],
    adminRoutePrefixes: ['/admin/schedule', '/admin/schedule-settings', '/admin/schedule-roles']
  },
  {
    key: 'todo',
    label: 'ToDo',
    description: 'Task list and completion tracking.',
    userRoutePrefixes: ['/todo'],
    adminRoutePrefixes: []
  },
  {
    key: 'whiteboard',
    label: 'Whiteboard',
    description: 'Idea board, voting, and moderation flow.',
    userRoutePrefixes: ['/whiteboard'],
    adminRoutePrefixes: []
  },
  {
    key: 'temps',
    label: 'Temps',
    description: 'Temperature dashboard and node telemetry views.',
    userRoutePrefixes: ['/temper'],
    adminRoutePrefixes: []
  },
  {
    key: 'announcements',
    label: 'Announcements',
    description: 'Homepage announcement content block.',
    userRoutePrefixes: ['/announcements'],
    adminRoutePrefixes: []
  },
  {
    key: 'employee_spotlight',
    label: 'Employee Spotlight',
    description: 'Homepage employee spotlight section.',
    userRoutePrefixes: [],
    adminRoutePrefixes: []
  },
  {
    key: 'daily_specials',
    label: 'Daily Specials',
    description: 'Daily specials content.',
    userRoutePrefixes: ['/specials'],
    adminRoutePrefixes: []
  },
  {
    key: 'lists',
    label: 'Lists',
    description: 'Checklist and prep list tools.',
    userRoutePrefixes: ['/lists'],
    adminRoutePrefixes: ['/admin/lists']
  },
  {
    key: 'recipes',
    label: 'Recipes',
    description: 'Recipe library and editor.',
    userRoutePrefixes: ['/recipes'],
    adminRoutePrefixes: ['/admin/recipes']
  },
  {
    key: 'documents',
    label: 'Documents',
    description: 'Document library and document editor.',
    userRoutePrefixes: ['/docs'],
    adminRoutePrefixes: ['/admin/documents']
  },
  {
    key: 'menus',
    label: 'Menus',
    description: 'Menu document page and menu viewer.',
    userRoutePrefixes: ['/menu'],
    adminRoutePrefixes: ['/admin/menus']
  },
  {
    key: 'vendors',
    label: 'Vendors',
    description: 'Admin vendor contacts and website links.',
    userRoutePrefixes: [],
    adminRoutePrefixes: ['/vendors', '/admin/vendors']
  },
  {
    key: 'conversions',
    label: 'Conversions',
    description: 'Cooking and baking measurement reference tools.',
    userRoutePrefixes: ['/conversions'],
    adminRoutePrefixes: []
  },
  {
    key: 'food_cost_calculator',
    label: 'Food Cost Calculator',
    description: 'Dish costing and margin calculator.',
    userRoutePrefixes: ['/tools/food-cost'],
    adminRoutePrefixes: []
  },
  {
    key: 'safety_healthcode',
    label: 'Safety & HealthCode',
    description: 'Kitchen safety and health-code reference sheet.',
    userRoutePrefixes: ['/tools/safety-healthcode'],
    adminRoutePrefixes: []
  },
  {
    key: 'waste_tracker',
    label: 'Waste Tracker',
    description: 'Waste entry log for product loss tracking.',
    userRoutePrefixes: ['/tools/waste'],
    adminRoutePrefixes: []
  }
];

export const defaultAppFeatureModes: AppFeatureModes = appFeatureDefinitions.reduce(
  (acc, feature) => {
    acc[feature.key] = 'all';
    return acc;
  },
  {} as AppFeatureModes
);

function routeMatchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isValidAppFeatureMode(value: string): value is AppFeatureMode {
  return value === 'all' || value === 'admin' || value === 'off';
}

export function canRoleAccessFeature(
  mode: AppFeatureMode,
  role: string | null | undefined,
  featureKey?: AppFeatureKey | null,
  permissionTemplate?: string | null,
  effectiveCapabilities?: readonly BusinessCapability[] | null
) {
  if (mode === 'off') return false;
  if (mode === 'all') return true;
  if (featureKey === 'vendors') return hasVendorAccess(role, permissionTemplate, effectiveCapabilities);
  return role === 'admin' || hasPrivilegedFeatureAccess(role, permissionTemplate, effectiveCapabilities);
}

export function normalizeAppFeatureModes(
  values: Partial<Record<string, AppFeatureMode | string | null | undefined>>
): AppFeatureModes {
  const normalized = { ...defaultAppFeatureModes };
  for (const feature of appFeatureDefinitions) {
    const raw = values[feature.key];
    if (typeof raw === 'string' && isValidAppFeatureMode(raw)) {
      normalized[feature.key] = raw;
    }
  }
  return normalized;
}

export function buildFeatureAccess(
  modes: AppFeatureModes,
  role: string | null | undefined,
  permissionTemplate?: string | null,
  effectiveCapabilities?: readonly BusinessCapability[] | null
): AppFeatureAccess {
  return appFeatureDefinitions.reduce(
    (acc, feature) => {
      acc[feature.key] = canRoleAccessFeature(
        modes[feature.key],
        role,
        feature.key,
        permissionTemplate,
        effectiveCapabilities
      );
      return acc;
    },
    {} as AppFeatureAccess
  );
}

export function resolveFeatureKeyForUrl(url: URL): AppFeatureKey | null {
  if (url.pathname === '/admin/creator') {
    return creatorEditorFeatureMap[url.searchParams.get('editor') ?? ''] ?? null;
  }

  return resolveFeatureKeyForPath(url.pathname);
}

export function resolveFeatureKeyForPath(pathname: string): AppFeatureKey | null {
  for (const feature of appFeatureDefinitions) {
    for (const prefix of feature.userRoutePrefixes) {
      if (routeMatchesPrefix(pathname, prefix)) return feature.key;
    }
    for (const prefix of feature.adminRoutePrefixes) {
      if (routeMatchesPrefix(pathname, prefix)) return feature.key;
    }
  }
  return null;
}
