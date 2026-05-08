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
  | 'meeting_notes';

export type AppFeatureDefinition = {
  key: AppFeatureKey;
  label: string;
  description: string;
  userRoutePrefixes: string[];
  adminRoutePrefixes: string[];
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
    userRoutePrefixes: [],
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
    label: 'Daily Highlights',
    description: 'Daily highlights and specials content.',
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
    key: 'meeting_notes',
    label: 'Meeting Notes',
    description: 'Internal admin meeting notes workspace.',
    userRoutePrefixes: ['/meeting-notes'],
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

export function canRoleAccessFeature(mode: AppFeatureMode, role: string | null | undefined) {
  if (mode === 'off') return false;
  if (mode === 'all') return true;
  return role === 'admin';
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

export function buildFeatureAccess(modes: AppFeatureModes, role: string | null | undefined): AppFeatureAccess {
  return appFeatureDefinitions.reduce(
    (acc, feature) => {
      acc[feature.key] = canRoleAccessFeature(modes[feature.key], role);
      return acc;
    },
    {} as AppFeatureAccess
  );
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
