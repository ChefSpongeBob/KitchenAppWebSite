import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { hasReportsAccess } from '$lib/server/permissions';
import { requireBusinessId } from '$lib/server/tenant';
import { loadListHistoryReport } from '$lib/server/history';

type ListDomain = 'preplists' | 'inventory' | 'orders';

function parseDomain(value: string | null): ListDomain {
  return value === 'inventory' || value === 'orders' || value === 'preplists' ? value : 'preplists';
}

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  const db = locals.DB;
  const domain = parseDomain(url.searchParams.get('domain'));
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!db) return { domain, startDate: '', endDate: '', rows: [] };

  return {
    domain,
    ...(await loadListHistoryReport(db, requireBusinessId(locals), domain, { start, end }))
  };
};
