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

export function formatScheduleWeekRange(dates: string[], fallback = '') {
  if (dates.length === 0) return fallback;

  const start = new Date(`${dates[0]}T00:00:00`);
  const end = new Date(`${dates[dates.length - 1]}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return fallback || dates[0];
  }

  const startMonth = String(start.getMonth() + 1).padStart(2, '0');
  const startDay = String(start.getDate()).padStart(2, '0');
  const endMonth = String(end.getMonth() + 1).padStart(2, '0');
  const endDay = String(end.getDate()).padStart(2, '0');
  const yearSuffix = String(end.getFullYear()).slice(-2);

  return start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
    ? `${startMonth}/${startDay}-${endDay}/${yearSuffix}`
    : `${startMonth}/${startDay}-${endMonth}/${endDay}/${yearSuffix}`;
}

export function scheduleDetailOptionsFor(department: ScheduleDepartment, role: string) {
  const departmentOptions = [...scheduleDetailOptionsByDepartment[department]];
  const roleOptions =
    role in scheduleDetailOptionsByRole
      ? [...scheduleDetailOptionsByRole[role as keyof typeof scheduleDetailOptionsByRole]]
      : [];

  return Array.from(new Set([...roleOptions, ...departmentOptions]));
}
