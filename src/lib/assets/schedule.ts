export const scheduleDepartments = ['FOH', 'Sushi', 'Kitchen'] as const;

export const scheduleWeekdays = [
  { value: 0, label: 'Monday', shortLabel: 'Mon' },
  { value: 1, label: 'Tuesday', shortLabel: 'Tue' },
  { value: 2, label: 'Wednesday', shortLabel: 'Wed' },
  { value: 3, label: 'Thursday', shortLabel: 'Thu' },
  { value: 4, label: 'Friday', shortLabel: 'Fri' },
  { value: 5, label: 'Saturday', shortLabel: 'Sat' },
  { value: 6, label: 'Sunday', shortLabel: 'Sun' }
] as const;

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

export type ScheduleDepartment = string;
export type ScheduleRole = string;
export type ScheduleWeekday = (typeof scheduleWeekdays)[number]['value'];

export function isValidScheduleDepartment(
  value: string,
  allowedDepartments?: readonly string[]
): value is ScheduleDepartment {
  const normalized = value.trim();
  if (!normalized) return false;
  return allowedDepartments ? allowedDepartments.includes(normalized) : true;
}

export function isValidScheduleRole(department: string, role: string) {
  if (!isValidScheduleDepartment(department)) return false;
  const roles = scheduleRolesByDepartment[department as keyof typeof scheduleRolesByDepartment];
  return roles ? (roles as readonly string[]).includes(role) : role.trim().length > 0;
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
  const departmentOptions = [
    ...(scheduleDetailOptionsByDepartment[
      department as keyof typeof scheduleDetailOptionsByDepartment
    ] ?? [])
  ];
  const roleOptions =
    role in scheduleDetailOptionsByRole
      ? [...scheduleDetailOptionsByRole[role as keyof typeof scheduleDetailOptionsByRole]]
      : [];

  return Array.from(new Set([...roleOptions, ...departmentOptions]));
}

export function weekdayIndexFromDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  const weekday = date.getDay();
  return weekday === 0 ? 6 : weekday - 1;
}

export function buildQuarterHourOptions() {
  const options: Array<{ value: string; label: string }> = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      options.push({
        value,
        label: formatScheduleTimeLabel(value)
      });
    }
  }
  return options;
}
