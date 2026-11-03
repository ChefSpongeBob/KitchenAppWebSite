import { error } from '@sveltejs/kit';
import { STAFF_CHANGE_AUTHORITY_SQL, staffChangeBindings, type PlatformStaff, type PlatformStaffRole } from './platformStaff';

type DB = App.RuntimeEnv['DB'];

export async function changeStaffMembership(db: DB, actor: PlatformStaff, sessionId: string,
  input: { email?: string; userId?: string; role: PlatformStaffRole; active: number; revision: number; reason: string }) {
  if (actor.role !== 'owner') error(403, 'Owner access required.');
  if (!['owner', 'support', 'equipment'].includes(input.role) || ![0, 1].includes(input.active) ||
      !Number.isSafeInteger(input.revision) || input.revision < 0 || !input.reason || input.reason.length > 200) {
    error(400, 'Choose a role, access setting, and reason.');
  }
  const target = input.revision === 0
    ? await db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE AND COALESCE(is_active, 1) = 1 LIMIT 2')
      .bind(String(input.email ?? '').trim().slice(0, 254)).all<{ id: string }>()
    : null;
  const userId = target ? (target.results.length === 1 ? target.results[0].id : '') : String(input.userId ?? '');
  if (!userId) error(400, 'Choose an existing active account.');
  if (userId === actor.userId && (input.active !== 1 || input.role !== 'owner')) {
    error(400, 'Another platform owner must change your access.');
  }
  const now = Math.floor(Date.now() / 1000);
  const authority = staffChangeBindings(actor, sessionId, now, ['owner', 'owner']);
  const mutation = input.revision === 0
    ? db.prepare(`INSERT INTO platform_staff_members (user_id, staff_role, is_active, granted_by, created_at, updated_at)
        SELECT u.id, ?, ?, ?, ?, ? FROM users u WHERE u.id = ? AND COALESCE(u.is_active, 1) = 1
          AND NOT EXISTS (SELECT 1 FROM platform_staff_members WHERE user_id = u.id)
          AND ${STAFF_CHANGE_AUTHORITY_SQL}`)
      .bind(input.role, input.active, actor.userId, now, now, userId, ...authority)
    : db.prepare(`UPDATE platform_staff_members SET staff_role = ?, is_active = ?, revision = revision + 1, updated_at = ?
        WHERE user_id = ? AND revision = ? AND ${STAFF_CHANGE_AUTHORITY_SQL}
          AND (? = 0 OR EXISTS (SELECT 1 FROM users WHERE id = ? AND COALESCE(is_active, 1) = 1))`)
      .bind(input.role, input.active, now, userId, input.revision, ...authority, input.active, userId);
  const results = await db.batch([
    mutation,
    db.prepare(`INSERT INTO platform_staff_audit (id, actor_user_id, target_user_id, action, reason, created_at)
      SELECT ?, ?, ?, ?, ?, ? WHERE changes() = 1`)
      .bind(crypto.randomUUID(), actor.userId, userId,
        input.revision === 0 ? 'staff_membership_added' : input.active === 0 ? 'staff_access_revoked' : 'staff_access_updated',
        `${input.role}: ${input.reason}`, now)
  ]);
  if (results[0].meta.changes !== 1) error(409, 'Access changed or verification expired. Refresh and try again.');
}
