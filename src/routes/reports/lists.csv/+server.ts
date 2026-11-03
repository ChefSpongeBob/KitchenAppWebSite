import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasReportsAccess } from '#lib/server/permissions.ts';
import { csvEscape, loadListHistoryReport } from '#lib/server/history.ts';
import { requireBusinessId } from '#lib/server/tenant.ts';

type ListDomain = 'preplists' | 'inventory' | 'orders' | 'checklists';

function parseDomain(value: string | null): ListDomain {
  return value === 'inventory' || value === 'orders' || value === 'checklists' || value === 'preplists'
    ? value
    : 'preplists';
}

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  const db = locals.DB;
  if (!db) return new Response('Database unavailable', { status: 503 });

  const domain = parseDomain(url.searchParams.get('domain'));
  const report = await loadListHistoryReport(db, requireBusinessId(locals), domain, {
    start: url.searchParams.get('start'),
    end: url.searchParams.get('end'),
    submittedAt: url.searchParams.get('submitted_at')
  });
  const valueHeader = domain === 'checklists' ? 'Action' : 'Value';
  const header = ['Date', 'List', 'Item', 'Details', valueHeader, 'Par', 'Done', 'Completed By', 'Submitted By'];
  const lines = [
    header.join(','),
    ...report.rows.map((row) =>
      [
        row.business_day,
        row.section_title_snapshot,
        row.item_name_snapshot,
        row.details_snapshot,
        row.submitted_value,
        row.par_count_snapshot,
        row.is_checked_snapshot ? 'yes' : 'no',
        row.is_checked_snapshot ? row.completed_by_name || '' : '',
        row.submitted_by_name
      ]
        .map(csvEscape)
        .join(',')
    )
  ];

  return new Response(`\uFEFF${lines.join('\n')}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${domain}-history-${report.startDate}-to-${report.endDate}.csv"`
    }
  });
};
