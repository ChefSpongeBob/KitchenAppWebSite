export type NavItem = {
  label: string;
  route: string;
  icon: string;
};

export const primaryNav: NavItem[] = [
  { label: 'Home', route: '/', icon: 'home' },
  { label: 'Lists', route: '/lists', icon: 'checklist' },
  { label: 'Recipes', route: '/recipes', icon: 'restaurant' },
  { label: 'Todo', route: '/todo', icon: 'task_alt' },
  { label: 'Docs', route: '/docs', icon: 'description' },
  { label: 'Whiteboard', route: '/whiteboard', icon: 'lightbulb' },
  { label: 'Temps', route: '/temper', icon: 'thermostat' },
  { label: 'Settings', route: '/settings', icon: 'settings' }
];
