import { ALL_BUSINESS_CAPABILITIES, resolveBusinessCapabilities,
  type BusinessCapability, type BusinessCapabilityOverrides } from '#lib/server/permissions.ts';
import { hashedAuditValue, getRequestIpAddress } from '#lib/server/security.ts';
import { logOperationalError } from '#lib/server/observability.ts';

type D1 = App.RuntimeEnv['DB'];

// This exact authority snapshot is compared again inside the file-write transaction.
const authoritySql = `SELECT json_object(
  'role', bu.role, 'template', COALESCE(bp.base_template, bu.permission_template, bu.role, 'staff'),
  'position', bu.position_id, 'status', b.status,
  'individual', (SELECT json_group_array(json_array(permission_key, is_enabled)) FROM
    (SELECT permission_key, is_enabled FROM employee_role_permissions
     WHERE business_id = bu.business_id AND user_id = bu.user_id ORDER BY permission_key)),
  'positionOverrides', (SELECT json_group_array(json_array(permission_key, is_enabled)) FROM
    (SELECT permission_key, is_enabled FROM business_position_permissions
     WHERE business_id = bu.business_id AND position_id = bp.id ORDER BY permission_key))
) AS proof FROM business_users bu
JOIN users u ON u.id = bu.user_id AND u.is_active = 1
JOIN businesses b ON b.id = bu.business_id
LEFT JOIN business_positions bp ON bp.id = bu.position_id AND bp.business_id = bu.business_id
WHERE bu.business_id = ? AND bu.user_id = ? AND COALESCE(bu.is_active, 1) = 1
  AND COALESCE(b.status, 'active') IN ('active', 'trialing', 'past_due', 'pending_payment')`;

export async function readHrFileAuthority(db: D1, businessId: string, actor: string | null | undefined,
  purpose: 'template' | 'i9' | 'self' | 'send', targetUserId?: string) {
  if (!actor) return null;
  const row = await db.prepare(authoritySql).bind(businessId, actor).first<{ proof: string }>();
  if (!row) return null;
  const state = JSON.parse(row.proof) as { role: string; template: string;
    individual: [string, number][]; positionOverrides: [string, number][] };
  const overrides = (rows: [string, number][]) => Object.fromEntries(rows
    .filter(([key]) => (ALL_BUSINESS_CAPABILITIES as readonly string[]).includes(key))
    .map(([key, value]) => [key, value === 1])) as BusinessCapabilityOverrides;
  const individual = overrides(state.individual);
  const capabilities = resolveBusinessCapabilities(state.role, state.template, individual, overrides(state.positionOverrides));
  const has = (capability: BusinessCapability) => capabilities.includes(capability);
  const sensitive = actor === targetUserId || has('view_sensitive_employee_data') ||
    (individual.view_sensitive_employee_data !== false && state.individual.some(([key, value]) => key === 'hr_sensitive_access' && value === 1));
  const permitted = purpose === 'self' ? actor === targetUserId : purpose === 'send'
    ? has('admin_access') && has('manage_onboarding') : purpose === 'template'
      ? has('admin_access') && has('manage_hr_setup') : has('review_onboarding') && sensitive;
  return permitted
    ? { businessId, actor, proof: row.proof, role: state.role, template: state.template, capabilities } : null;
}

export async function commitHrFileWrite(db: D1, request: Request,
  authority: NonNullable<Awaited<ReturnType<typeof readHrFileAuthority>>>,
  options: { action: string; auditId?: string; targetUserId?: string; email?: string; condition: string; values: (string | number | null)[];
    metadata: Record<string, unknown>; writes: (auditId: string) => ReturnType<D1['prepare']>[] }) {
  const id = options.auditId ?? crypto.randomUUID(), now = Math.floor(Date.now() / 1000);
  const claim = db.prepare(`INSERT INTO account_audit_logs
    (id, business_id, actor_user_id, target_user_id, action, email_hash, ip_hash, user_agent_hash, metadata_json, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE (${authoritySql}) IS ? AND (${options.condition})`)
    .bind(id, authority.businessId, authority.actor, options.targetUserId ?? null, options.action,
      await hashedAuditValue(options.email),
      await hashedAuditValue(getRequestIpAddress(request)), await hashedAuditValue(request.headers.get('user-agent')),
      JSON.stringify(options.metadata), now, authority.businessId, authority.actor, authority.proof, ...options.values);
  try {
    const results = await db.batch([claim, ...options.writes(id)]);
    return results[0]?.meta?.changes ? 'saved' : 'changed';
  } catch {
    // A lost response is not evidence of a rollback. The receipt shares the complete transaction.
    try {
      const receipt = await db.prepare(`SELECT 1 FROM account_audit_logs
        WHERE id = ? AND business_id = ? AND actor_user_id = ? AND action = ?`)
        .bind(id, authority.businessId, authority.actor, options.action).first();
      if (receipt) return 'saved';
    } catch { /* Leave reference-checked cleanup to the caller; never expose raw database errors. */ }
    logOperationalError({ event: 'hr_file_write_failed', businessId: authority.businessId,
      metadata: { phase: 'commit', action: options.action } });
    return 'unavailable';
  }
}

export const hrFileWriteGuard = 'EXISTS (SELECT 1 FROM account_audit_logs WHERE id = ?)';
