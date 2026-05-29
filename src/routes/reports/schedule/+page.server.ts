import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { loadScheduleHistoryReport } from '$lib/server/history';
import { requireBusinessId } from '$lib/server/tenant';

export const load: PageServerLoad = async ({ locals, url }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!db) return { startDate: '', endDate: '', rows: [] };

  return await loadScheduleHistoryReport(db, requireBusinessId(locals), { start, end });
};
