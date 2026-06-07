import type { AppFeatureKey } from '$lib/features/appFeatures';

export type NavItem = {
  label: string;
  route: string;
  icon: string;
  featureKey?: AppFeatureKey;
  adminOnly?: boolean;
  group?: 'tools';
};

export const primaryNav: NavItem[] = [
  { label: 'Dashboard', route: '/app', icon: 'home' },
  { label: 'My Profile', route: '/settings', icon: 'person' },
  { label: 'Schedule', route: '/my-schedule', icon: 'calendar_month', featureKey: 'scheduling' },
  { label: 'Lists', route: '/lists', icon: 'checklist', featureKey: 'lists' },
  { label: 'Recipes', route: '/recipes', icon: 'restaurant', featureKey: 'recipes' },
  { label: 'Todo', route: '/todo', icon: 'task_alt', featureKey: 'todo' },
  { label: 'Docs', route: '/docs', icon: 'description', featureKey: 'documents' },
  { label: 'Vendors', route: '/vendors', icon: 'local_shipping', featureKey: 'vendors', adminOnly: true },
  { label: 'Reports', route: '/reports', icon: 'analytics', adminOnly: true },
  { label: 'Conversions', route: '/conversions', icon: 'calculate', featureKey: 'conversions', group: 'tools' },
  { label: 'Food Cost Calculator', route: '/tools/food-cost', icon: 'price_check', featureKey: 'food_cost_calculator', group: 'tools' },
  { label: 'Safety & HealthCode', route: '/tools/safety-healthcode', icon: 'health_and_safety', featureKey: 'safety_healthcode', group: 'tools' },
  { label: 'Waste Tracker', route: '/tools/waste', icon: 'delete_sweep', featureKey: 'waste_tracker', group: 'tools' },
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
