export type ScheduleDepartment = string;

export type UserOption = {
  id: string;
  displayName: string | null;
  email: string;
  approvedDepartments: ScheduleDepartment[];
};

export type Shift = {
  id: string;
  shiftDate: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  department: string;
  role: string;
  detail: string;
  startTime: string;
  endLabel: string;
  breakMinutes: number;
  notes: string;
};

export type Day = {
  date: string;
  label: string;
  shifts: Shift[];
};

export type ShiftOffer = {
  id: string;
  shiftId: string;
  shiftDate: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  department: string;
  role: string;
  detail: string;
  startTime: string;
  endLabel: string;
  breakMinutes: number;
  notes: string;
  offeredByUserId: string;
  offeredByUserName: string | null;
  offeredByUserEmail: string;
  targetUserId: string | null;
  targetUserName: string | null;
  targetUserEmail: string | null;
  requestedByUserId: string | null;
  requestedByUserName: string | null;
  requestedByUserEmail: string | null;
  managerNote: string;
};

export type AvailabilityEntry = {
  weekday: number;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
};

export type TimeOffRequest = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  startDate: string;
  endDate: string;
  note: string;
  status: 'pending' | 'approved' | 'declined';
  managerNote: string;
};

export type DraftShift = {
  clientId: string;
  shiftDate: string;
  userId: string;
  department: ScheduleDepartment;
  role: string;
  detail: string;
  startTime: string;
  endLabel: string;
  breakMinutes: number;
  notes: string;
  isEditing: boolean;
  duplicateDates: string[];
  activeTimeEditor: '' | 'start' | 'end';
};

export type EmployeeRow = {
  userId: string;
  cells: Array<{
    date: string;
    label: string;
    shifts: DraftShift[];
  }>;
};
