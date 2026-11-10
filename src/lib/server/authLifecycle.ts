import { getRequestIpAddress, hashedAuditValue } from '#lib/server/security.ts';
import { hashSessionToken } from '#lib/server/auth.ts';

type DB = App.RuntimeEnv['DB'];
export const ACCOUNT_WRITE_RECEIPT = 'EXISTS (SELECT 1 FROM account_audit_logs WHERE id = ?)';

// The audit is both the transaction's guarded claim and its lost-response receipt.
export async function commitAccountMutation(db: DB, options: {
  action: 'login_success' | 'password_reset_completed' | 'billing_workspace_canceled';
  userId: string;
  email: string;
  businessId?: string | null;
  request: Request;
  getClientAddress?: () => string;
  condition: string;
  values: (string | number | null)[];
  writes: (receiptId: string, now: number) => ReturnType<DB['prepare']>[];
  now: number;
}) {
  const id = crypto.randomUUID();
  const claim = db.prepare(`INSERT INTO account_audit_logs
    (id, business_id, actor_user_id, target_user_id, action, email_hash, ip_hash, user_agent_hash, metadata_json, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, '{}', ? WHERE ${options.condition}`)
    .bind(id, options.businessId ?? null, options.userId, options.userId, options.action,
      await hashedAuditValue(options.email), await hashedAuditValue(getRequestIpAddress(options.request, options.getClientAddress)),
      await hashedAuditValue(options.request.headers.get('user-agent')), options.now, ...options.values);
  try {
    const results = await db.batch([claim, ...options.writes(id, options.now)]);
    return results[0].meta.changes === 1;
  } catch (error) {
    const committed = await db.prepare('SELECT id FROM account_audit_logs WHERE id = ? AND action = ? AND target_user_id = ?')
      .bind(id, options.action, options.userId).first();
    if (committed) return true;
    throw error;
  }
}

export async function commitPasswordSignIn(db: DB, options: {
  userId: string;
  email: string;
  verifiedPasswordHash: string;
  upgradedHash?: string;
  businessId?: string | null;
  staffLogin: boolean;
  sessionId: string;
  sessionTokenHash: string;
  previousToken: string | null;
  request: Request;
  getClientAddress?: () => string;
}) {
  const { userId, email, businessId, staffLogin, previousToken, request } = options;
  const device = await db.prepare('SELECT id FROM devices WHERE user_id = ? AND revoked_at IS NULL LIMIT 1')
    .bind(userId).first<{ id: string }>();
  const deviceId = device?.id ?? crypto.randomUUID();
  const previousHash = previousToken ? await hashSessionToken(previousToken) : '';
  const emailLimitKey = await hashSessionToken(`login_email:${email}`);
  const ipAddress = getRequestIpAddress(request, options.getClientAddress);
  const now = Math.floor(Date.now() / 1000);
  return commitAccountMutation(db, {
    action: 'login_success', userId, email, businessId, request, getClientAddress: options.getClientAddress, now,
    condition: `EXISTS (SELECT 1 FROM users u WHERE u.id = ? AND u.password_hash = ?
      AND COALESCE(u.is_active, 1) = 1 AND lower(trim(u.email)) = ?)
      ${device ? 'AND EXISTS (SELECT 1 FROM devices WHERE id = ? AND user_id = ? AND revoked_at IS NULL)' : ''}
      ${staffLogin ? "AND EXISTS (SELECT 1 FROM platform_staff_members WHERE user_id = ? AND is_active = 1 AND staff_role IN ('owner', 'support', 'equipment'))" : ''}
      ${businessId ? `AND EXISTS (SELECT 1 FROM business_users bu JOIN businesses b ON b.id = bu.business_id
        WHERE bu.user_id = ? AND bu.business_id = ? AND COALESCE(bu.is_active, 1) = 1
        AND COALESCE(b.status, 'active') IN ('active', 'trialing', 'past_due', 'pending_payment'))` : ''}`,
    values: [userId, options.verifiedPasswordHash, email, ...(device ? [deviceId, userId] : []),
      ...(staffLogin ? [userId] : []), ...(businessId ? [userId, businessId] : [])],
    writes: id => [
      device
        ? db.prepare(`UPDATE devices SET user_agent = ?, last_ip = ?, last_seen_at = ?, updated_at = ?
            WHERE id = ? AND ${ACCOUNT_WRITE_RECEIPT}`)
            .bind(request.headers.get('user-agent') ?? null, ipAddress, now, now, deviceId, id)
        : db.prepare(`INSERT INTO devices (id, user_id, pin_hash, user_agent, last_ip, created_at, updated_at)
            SELECT ?, ?, '', ?, ?, ?, ? WHERE ${ACCOUNT_WRITE_RECEIPT}`)
            .bind(deviceId, userId, request.headers.get('user-agent') ?? null, ipAddress, now, now, id),
      db.prepare(`INSERT INTO sessions (id, user_id, device_id, session_token_hash, created_at, last_seen_at, expires_at)
        SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${ACCOUNT_WRITE_RECEIPT}`)
        .bind(options.sessionId, userId, deviceId, options.sessionTokenHash, now, now, now + 60 * 60 * 24 * 30, id),
      ...(options.upgradedHash ? [db.prepare(`UPDATE users SET password_hash = ?, updated_at = ?
        WHERE id = ? AND ${ACCOUNT_WRITE_RECEIPT}`).bind(options.upgradedHash, now, userId, id)] : []),
      ...(previousToken ? [db.prepare(`UPDATE sessions SET revoked_at = ?
        WHERE (session_token_hash = ? OR (session_token_hash = ? AND length(session_token_hash) <> 64)) AND ${ACCOUNT_WRITE_RECEIPT}`)
        .bind(now, previousHash, previousToken, id)] : []),
      db.prepare(`DELETE FROM security_rate_limits WHERE key_hash = ? AND ${ACCOUNT_WRITE_RECEIPT}`).bind(emailLimitKey, id)
    ]
  });
}
