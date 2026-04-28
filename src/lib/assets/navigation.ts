import type { AppFeatureKey } from '$lib/features/appFeatures';

export type NavItem = {
  label: string;
  route: string;
  icon: string;
  featureKey?: AppFeatureKey;
};

export const primaryNav: NavItem[] = [
  { label: 'Home', route: '/app', icon: 'home' },
  { label: 'My Profile', route: '/settings', icon: 'person' },
  { label: 'Schedule', route: '/my-schedule', icon: 'calendar_month', featureKey: 'scheduling' },
  { label: 'Lists', route: '/lists', icon: 'checklist', featureKey: 'lists' },
  { label: 'Recipes', route: '/recipes', icon: 'restaurant', featureKey: 'recipes' },
  { label: 'Todo', route: '/todo', icon: 'task_alt', featureKey: 'todo' },
  { label: 'Docs', route: '/docs', icon: 'description', featureKey: 'documents' },
  { label: 'Whiteboard', route: '/whiteboard', icon: 'lightbulb', featureKey: 'whiteboard' },
  { label: 'Temps', route: '/temper', icon: 'thermostat', featureKey: 'temps' }
];

export const publicNav: NavItem[] = [
  { label: 'Overview', route: '/', icon: 'home' },
  { label: 'Features', route: '/features', icon: 'view_quilt' },
  { label: 'How It Works', route: '/how-it-works', icon: 'settings_suggest' },
  { label: 'About', route: '/about', icon: 'info' },
  { label: 'Pricing', route: '/pricing', icon: 'sell' },
  { label: 'Register', route: '/register', icon: 'person_add' },
  { label: 'Login', route: '/login', icon: 'login' }
];
