import { stringify } from 'devalue';
import { WORKSPACE_HEADER, WORKSPACE_PARAM, WORKSPACE_CONFLICT_HEADER, WORKSPACE_CHANGED_MESSAGE } from '#lib/workspaceIntent.ts';

export async function workspaceIntentFailure(db: App.RuntimeEnv['DB'], request: Request, url: URL,
  userId: string, businessId: string, cookieBusinessId: string | null) {
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
  const header = request.headers.get(WORKSPACE_HEADER);
  const query = mutation ? url.searchParams.get(WORKSPACE_PARAM) : null;
  let conflict = Boolean((header !== null && header !== businessId) || (query !== null && query !== businessId));
  if (mutation && cookieBusinessId && cookieBusinessId !== businessId) conflict = true;
  if (mutation && !header && !query && !conflict) {
    // Older single-restaurant clients remain safe; an ambiguous write must identify its rendered workspace.
    const anotherMembership = await db.prepare(`SELECT 1 AS found FROM business_users bu
      JOIN businesses b ON b.id = bu.business_id
      WHERE bu.user_id = ? AND bu.business_id != ? AND COALESCE(bu.is_active, 1) = 1
        AND COALESCE(b.status, 'active') IN ('active', 'trialing', 'past_due', 'pending_payment') LIMIT 1`)
      .bind(userId, businessId).first();
    conflict = Boolean(anotherMembership);
  }
  if (!conflict) return null;
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', [WORKSPACE_CONFLICT_HEADER]: '1' };
  const body = request.headers.get('x-sveltekit-action') === 'true'
    ? { type: 'failure', status: 409, data: stringify({ error: WORKSPACE_CHANGED_MESSAGE }) }
    : { message: WORKSPACE_CHANGED_MESSAGE, error: WORKSPACE_CHANGED_MESSAGE };
  return new Response(JSON.stringify(body), { status: 409, headers });
}
