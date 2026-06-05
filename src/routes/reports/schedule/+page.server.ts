import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { hasReportsAccess } from '$lib/server/permissions';
import { loadScheduleHistoryReport } from '$lib/server/history';
import { requireBusinessId } from '$lib/server/tenant';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  const db = locals.DB;
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!db) return { startDate: '', endDate: '', rows: [] };

  return await loadScheduleHistoryReport(db, requireBusinessId(locals), { start, end });
};
