export const scheduleDepartments = ['FOH', 'Sushi', 'Kitchen'] as const;

export const scheduleRolesByDepartment = {
  FOH: ['Server', 'Runner', 'Host', 'FOH MGR'],
  Sushi: ['BOH MGR', 'Roller', 'Opener', 'Sushi Prep', 'Swing'],
  Kitchen: ['BOH MGR', 'Cook', 'Dish', 'Swing']
} as const;

export const scheduleEndLabels = ['BD', 'Close'] as const;

export const scheduleDetailOptionsByDepartment = {
  FOH: ['Front Door', 'Host Stand', 'Dining Room', 'Patio', 'Bar', 'Expo'],
  Sushi: ['3 Bus', '7 Bus', '8 Bus', '9 Bus', 'Sushi Line', 'Expo'],
  Kitchen: ['Cook Line', 'Hot Line', 'Fryers', 'Dish Pit', 'Prep', 'Expo']
} as const;

export const scheduleDetailOptionsByRole = {
  Server: ['Section 1', 'Section 2', 'Section 3', 'Section 4', 'Patio', 'Bar'],
  Runner: ['Dining Room', 'Patio', 'Expo'],
  Host: ['Front Door', 'Host Stand'],
  'FOH MGR': ['Dining Room', 'Patio', 'Front Door'],
  'BOH MGR': ['Sushi Line', 'Cook Line', 'Expo'],
  Roller: ['3 Bus', '7 Bus', '8 Bus', '9 Bus'],
  Opener: ['Sushi Line', '3 Bus', '7 Bus'],
  'Sushi Prep': ['Prep', '7 Bus', '8 Bus'],
  Swing: ['Expo', '3 Bus', '7 Bus', 'Cook Line', 'Dish Pit'],
  Cook: ['Cook Line', 'Hot Line', 'Fryers', 'Expo'],
  Dish: ['Dish Pit']
} as const;

export type ScheduleDepartment = (typeof scheduleDepartments)[number];
export type ScheduleRole = (typeof scheduleRolesByDepartment)[ScheduleDepartment][number];

export function isValidScheduleDepartment(value: string): value is ScheduleDepartment {
  return (scheduleDepartments as readonly string[]).includes(value);
}

export function isValidScheduleRole(department: string, role: string) {
  if (!isValidScheduleDepartment(department)) return false;
  return (scheduleRolesByDepartment[department] as readonly string[]).includes(role);
}

export function formatScheduleTimeLabel(value: string) {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function scheduleDetailOptionsFor(department: ScheduleDepartment, role: string) {
  const departmentOptions = [...scheduleDetailOptionsByDepartment[department]];
  const roleOptions =
    role in scheduleDetailOptionsByRole
      ? [...scheduleDetailOptionsByRole[role as keyof typeof scheduleDetailOptionsByRole]]
      : [];

  return Array.from(new Set([...roleOptions, ...departmentOptions]));
}
