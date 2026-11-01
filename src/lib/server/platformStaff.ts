import { error } from '@sveltejs/kit';

type DB = App.Platform['env']['DB'];
export type PlatformStaffRole = 'owner' | 'support' | 'equipment';
export type PlatformStaff = { userId: string; role: PlatformStaffRole };
export const STAFF_STEP_UP_SECONDS = 15 * 60;
export const STAFF_SESSION_SECONDS = 8 * 60 * 60;

export function staffReturnPath(value: string | null) {
  try {
    const url = new URL(String(value ?? '/staff'), 'https://staff.invalid');
    if (url.origin !== 'https://staff.invalid' || !isPlatformStaffPath(url.pathname) || isStaffSecurityPath(url.pathname)) return '/staff';
    return (url.pathname + url.search).slice(0, 1000);
  } catch { return '/staff'; }
}

export async function loadStaffStepUp(db: DB, userId: string, sessionId: string, now = Math.floor(Date.now() / 1000), maxAge = STAFF_STEP_UP_SECONDS) {
  return db.prepare(`SELECT p.verified_at FROM platform_staff_step_up p
    JOIN platform_staff_members m ON m.user_id = p.user_id AND m.revision = p.membership_revision
    JOIN sessions s ON s.id = p.session_id AND s.user_id = p.user_id
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ? AND p.session_id = ? AND m.is_active = 1 AND COALESCE(u.is_active, 1) = 1
      AND s.revoked_at IS NULL AND s.expires_at > ? AND p.verified_at > ? AND p.verified_at <= ?
      AND p.passkey_verified_at > ? AND p.passkey_verified_at <= ?
    LIMIT 1`).bind(userId, sessionId, now, now - maxAge, now, now - maxAge, now)
    .first<{ verified_at: number }>();
}

export async function requireStaffStepUp(locals: App.Locals, roles?: PlatformStaffRole[]) {
  const staff = await requirePlatformStaff(locals, roles);
  if (!locals.sessionId || !await loadStaffStepUp(locals.DB, staff.userId, locals.sessionId)) {
    error(403, 'Verify your password and passkey in Security before making changes.');
  }
  return staff;
}

export async function hasPlatformStaffMembership(db: DB, userId: string) {
  return Boolean(await db.prepare('SELECT user_id FROM platform_staff_members WHERE user_id = ? LIMIT 1')
    .bind(userId).first());
}

export function isPlatformStaffPath(pathname: string) {
  return pathname === '/staff' || pathname.startsWith('/staff/');
}

export function isStaffSecurityPath(pathname: string) {
  return pathname === '/staff/security' || pathname === '/staff/security/passkeys';
}

export async function findPlatformStaff(db: DB, userId: string): Promise<PlatformStaff | null> {
  const row = await db.prepare(`
    SELECT s.user_id, s.staff_role FROM platform_staff_members s
    JOIN users u ON u.id = s.user_id
    WHERE s.user_id = ? AND s.is_active = 1 AND COALESCE(u.is_active, 1) = 1
    LIMIT 1
  `).bind(userId).first<{ user_id: string; staff_role: PlatformStaffRole }>();
  if (!row || !['owner', 'support', 'equipment'].includes(row.staff_role)) return null;
  return { userId: row.user_id, role: row.staff_role };
}

export async function requirePlatformStaff(locals: App.Locals, roles?: PlatformStaffRole[], allowUnverified = false) {
  if (!locals.userId) error(401, 'Sign in required.');
  if (!locals.DB) error(503, 'Staff console unavailable.');
  const staff = await findPlatformStaff(locals.DB, locals.userId);
  if (!staff || (roles && !roles.includes(staff.role))) error(403, 'Staff access required.');
  if (!allowUnverified && (!locals.sessionId || !await loadStaffStepUp(locals.DB, staff.userId, locals.sessionId, undefined, STAFF_SESSION_SECONDS))) {
    error(403, 'Staff verification required.');
  }
  return staff;
}

export const STAFF_CHANGE_AUTHORITY_SQL = `EXISTS (
  SELECT 1 FROM platform_staff_members m
  JOIN users u ON u.id = m.user_id
  JOIN platform_staff_step_up p ON p.user_id = m.user_id AND p.membership_revision = m.revision
  JOIN sessions s ON s.id = p.session_id AND s.user_id = p.user_id
  WHERE m.user_id = ? AND p.session_id = ? AND m.is_active = 1 AND COALESCE(u.is_active, 1) = 1
    AND s.revoked_at IS NULL AND s.expires_at > ? AND p.verified_at > ? AND p.verified_at <= ?
    AND p.passkey_verified_at > ? AND p.passkey_verified_at <= ?
    AND m.staff_role IN (?, ?)
)`;

export function staffChangeBindings(staff: PlatformStaff, sessionId: string, now: number, roles: [PlatformStaffRole, PlatformStaffRole]) {
  return [staff.userId, sessionId, now, now - STAFF_STEP_UP_SECONDS, now, now - STAFF_STEP_UP_SECONDS, now, ...roles];
}

export function staffPageNumber(value: string | null) {
  const page = Number(value ?? 1);
  return Number.isSafeInteger(page) && page >= 1 ? Math.min(page, 1000) : 1;
}

export function staffSearch(value: string | null) {
  return String(value ?? '').trim().slice(0, 80);
}

export function searchPattern(value: string) {
  return `${value.replace(/[\\%_]/g, '\\$&')}%`;
}

export async function reserveGateway(db: DB, staff: PlatformStaff, serial: string, businessId: string, reason: string, sessionId: string) {
  if (!['owner', 'equipment'].includes(staff.role)) error(403, 'Equipment access required.');
  if (!/^[a-z0-9][a-z0-9_-]{0,30}$/.test(serial) || !businessId || businessId.length > 80 || !reason || reason.length > 200) {
    error(400, 'Choose a gateway, business, and reason.');
  }
  const now = Math.floor(Date.now() / 1000);
  // Both the authority and current equipment state are checked again in the mutation.
  await db.batch([
    db.prepare(`INSERT INTO iot_device_reservations (serial, business_id, reserved_by, created_at)
      SELECT i.serial, b.id, ?, ? FROM iot_device_inventory i JOIN businesses b ON b.id = ?
      WHERE i.serial = ? AND i.device_type = 'sensor_gateway' AND i.claim_status = 'available'
        AND i.claimed_business_id IS NULL AND i.claimed_iot_device_id IS NULL AND b.status = 'active'
        AND ${STAFF_CHANGE_AUTHORITY_SQL}
    `).bind(staff.userId, now, businessId, serial, ...staffChangeBindings(staff, sessionId, now, ['owner', 'equipment'])),
    db.prepare(`INSERT INTO platform_staff_audit (id, actor_user_id, action, business_id, device_serial, reason, created_at)
      SELECT ?, ?, 'gateway_reserved', ?, ?, ?, ? WHERE changes() = 1
    `).bind(crypto.randomUUID(), staff.userId, businessId, serial, reason, now)
  ]).then(results => {
    if (results[0].meta.changes !== 1) error(409, 'Gateway or business is unavailable. Refresh and try again.');
  });
}

export async function releaseGatewayReservation(db: DB, staff: PlatformStaff, serial: string, reason: string, sessionId: string) {
  if (!['owner', 'equipment'].includes(staff.role)) error(403, 'Equipment access required.');
  if (!/^[a-z0-9][a-z0-9_-]{0,30}$/.test(serial) || !reason || reason.length > 200) error(400, 'Enter a reason.');
  const now = Math.floor(Date.now() / 1000);
  const auditId = crypto.randomUUID();
  const results = await db.batch([
    db.prepare(`INSERT INTO platform_staff_audit (id, actor_user_id, action, business_id, device_serial, reason, created_at)
      SELECT ?, ?, 'gateway_reservation_released', r.business_id, r.serial, ?, ?
      FROM iot_device_reservations r JOIN iot_device_inventory i ON i.serial = r.serial
      WHERE r.serial = ? AND i.claim_status = 'available' AND i.claimed_business_id IS NULL
        AND i.claimed_iot_device_id IS NULL AND NOT EXISTS (SELECT 1 FROM iot_devices d WHERE d.external_device_id = r.serial)
        AND ${STAFF_CHANGE_AUTHORITY_SQL}
    `).bind(auditId, staff.userId, reason, now, serial, ...staffChangeBindings(staff, sessionId, now, ['owner', 'equipment'])),
    db.prepare(`DELETE FROM iot_device_reservations WHERE serial = ?
      AND EXISTS (SELECT 1 FROM platform_staff_audit WHERE id = ? AND action = 'gateway_reservation_released')
    `).bind(serial, auditId)
  ]);
  if (results[1].meta.changes !== 1) error(409, 'Only an unused reservation can be released.');
}
