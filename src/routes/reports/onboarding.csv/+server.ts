import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasReportsAccess } from '$lib/server/permissions';
import { requireBusinessId } from '$lib/server/tenant';
import { csvEscape } from '$lib/server/history';
import { loadOnboardingReport } from '$lib/server/reports';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  const db = locals.DB;
  if (!db) return new Response('Database unavailable', { status: 503 });

  const report = await loadOnboardingReport(db, requireBusinessId(locals), {
    start: url.searchParams.get('start'),
    end: url.searchParams.get('end')
  });
  const header = [
    'employee',
    'email',
    'package_status',
    'payroll_classification',
    'item_count',
    'pending',
    'submitted',
    'approved',
    'changes_requested',
    'sent_at',
    'completed_at',
    'approved_at',
    'approved_by',
    'created_by'
  ];
  const lines = [
    header.join(','),
    ...report.rows.map((row) =>
      [
        row.employee_name,
        row.employee_email,
        row.package_status,
        row.payroll_classification,
        row.item_count,
        row.pending_items,
        row.submitted_items,
        row.approved_items,
        row.changes_requested_items,
        row.sent_at,
        row.completed_at ?? '',
        row.approved_at ?? '',
        row.approved_by_name,
        row.created_by_name
      ]
        .map(csvEscape)
        .join(',')
    )
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="onboarding-report.csv"'
    }
  });
};
