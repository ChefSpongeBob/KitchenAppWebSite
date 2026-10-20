import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const checks = [];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function expect(path, label, predicate) {
  if (!existsSync(resolve(root, path))) {
    checks.push({ ok: false, label, detail: `${path} does not exist.` });
    return;
  }
  const source = read(path);
  checks.push({ ok: Boolean(predicate(source)), label, detail: path });
}

function expectMissing(paths, label) {
  const existing = paths.filter((path) => existsSync(resolve(root, path)));
  checks.push({ ok: existing.length === 0, label, detail: existing.join(', ') || 'removed' });
}

expect('src/routes/admin/creator/+page.server.ts', 'Creator Studio owns content editor actions', (source) =>
  source.includes("initialEditorType: 'category' | 'list' | 'recipe' | 'document' | 'menu'") &&
  source.includes('create_creator_category') &&
  source.includes('create_list_section') &&
  source.includes('create_recipe') &&
  source.includes('create_document') &&
  source.includes('create_item_attachment')
);

expect('src/routes/admin/creator/+page.svelte', 'Creator Studio renders all content editor modes', (source) =>
  source.includes("type EditorType = 'category' | 'list' | 'recipe' | 'document' | 'menu'") &&
  source.includes("editorType === 'category'") &&
  source.includes("editorType === 'list'") &&
  source.includes("editorType === 'recipe'") &&
  source.includes("editorType === 'document'") &&
  source.includes("editorType === 'menu'") &&
  source.includes('menuDocuments') &&
  !source.includes("goto('/admin/category-creator')") &&
    !source.includes("goto('/admin/menus')")
);

expect('src/lib/features/appFeatures.ts', 'Creator Studio editor modes map to feature flags', (source) =>
  source.includes('creatorEditorFeatureMap') &&
  source.includes("list: 'lists'") &&
  source.includes("recipe: 'recipes'") &&
  source.includes("document: 'documents'") &&
  source.includes("menu: 'menus'") &&
  source.includes('resolveFeatureKeyForUrl') &&
  source.includes("url.pathname === '/admin/creator'")
);

expect('src/hooks.server.ts', 'feature gating uses URL-aware creator editor resolution', (source) =>
  source.includes('resolveFeatureKeyForUrl') &&
  source.includes('const gatedFeature = resolveFeatureKeyForUrl(event.url);') &&
  !source.includes('const gatedFeature = resolveFeatureKeyForPath(pathname);')
);

expectMissing(
  [
    'src/routes/admin/category-creator/+page.server.ts',
    'src/routes/admin/category-creator/+page.svelte',
    'src/routes/admin/lists/+page.server.ts',
    'src/routes/admin/lists/+page.svelte',
    'src/routes/admin/menus/+page.server.ts',
    'src/routes/admin/menus/+page.svelte',
    'src/routes/admin/documents/+page.server.ts',
    'src/routes/admin/documents/+page.svelte',
    'src/routes/admin/recipes/+page.server.ts',
    'src/routes/admin/recipes/+page.svelte',
    'src/routes/recipes/manage/+page.server.ts',
    'src/routes/recipes/manage/+page.svelte'
  ],
  'legacy content-editor redirect routes are removed'
);

expectMissing(
  [
    'src/routes/admin/schedule-settings/+page.server.ts',
    'src/routes/admin/schedule-roles/+page.server.ts',
    'src/routes/docs/about/+page.svelte',
    'src/routes/announcements/+page.server.ts',
    'src/routes/announcements/+page.svelte'
  ],
  'dead aliases and redundant viewer routes are removed'
);

expect('src/lib/navigation/managerNavigation.ts', 'manager navigation is complete and centrally permission-aware', (source) =>
  source.includes("label: 'People & HR'") &&
  source.includes("label: 'Team Directory'") &&
  source.includes("label: 'Onboarding Packets'") &&
  source.includes("label: 'HR & Compliance'") &&
  source.includes("label: 'Roles & Access'") &&
  source.includes("label: 'Schedule Builder'") &&
  source.includes("label: 'Creator Studio'") &&
  source.includes("label: 'Vendor Manager'") &&
  source.includes("label: 'Reports'") &&
  source.includes("label: 'Business Registry'") &&
  source.includes("label: 'Billing'") &&
  source.includes("label: 'Feature Matrix'") &&
  source.includes('canViewManagerNavigationItem') &&
  source.includes('hasBusinessCapability(') &&
  source.includes('canRoleAccessFeature(')
);

expect('src/lib/components/ui/AdminEditorMenu.svelte', 'manager dropdown renders every accessible grouped destination', (source) =>
  source.includes('managerNavigationGroups') &&
  source.includes('canViewManagerNavigationItem') &&
  source.includes('isManagerNavigationItemActive') &&
  source.includes('<optgroup label={group.label}>') &&
  source.includes('<option value={item.href}>{item.label}</option>')
);

expect('src/routes/+layout.svelte', 'admin sidebar derives its focused permission-aware workspaces from shared navigation', (source) =>
  source.includes('managerNavigationGroups') &&
  source.includes('item.showInSidebar') &&
  source.includes('item.requiredCapability ??') &&
  source.includes('resolveBusinessCapabilityForPath(item.route.split("?", 1)[0])') &&
  source.includes('$: currentSearch = $page.url.search')
);

expect('src/lib/components/ui/PageHeader.svelte', 'manager quick navigation appears across special-access workspaces', (source) =>
  source.includes('isManagerWorkspacePath') &&
  source.includes('<AdminEditorMenu />')
);

expectMissing(
  ['src/lib/components/ui/PeopleHrNav.svelte'],
  'duplicate horizontal People and HR navigation is removed'
);

expect('src/lib/components/ui/ManagerSectionNav.svelte', 'People and HR has visible permission-aware local navigation', (source) =>
  source.includes('managerNavigationGroups') &&
  source.includes('canViewManagerNavigationItem') &&
  source.includes('isManagerNavigationItemActive')
);

for (const path of [
  'src/routes/admin/users/+page.svelte',
  'src/routes/admin/onboarding/+page.svelte',
  'src/routes/admin/users/[id]/+page.svelte'
]) {
  expect(path, `${path} exposes People and HR section navigation`, (source) =>
    source.includes('ManagerSectionNav') && source.includes('groupId="people"')
  );
}

expect('src/routes/admin/+page.svelte', 'manager dashboard keeps navigation and groups scheduling with people tools', (source) =>
  source.includes('<PageHeader title="Manager Dashboard" />') &&
  source.includes('<h2>Schedule & People</h2>') &&
  source.includes('href="/admin/schedule"') &&
  source.includes('href="/admin/schedule?tool=approvals"') &&
  source.includes('href="/admin/schedule?tool=setup"') &&
  source.includes('href="/admin/users"') &&
  source.includes('href="/admin/onboarding?view=packets"') &&
  source.includes('href="/admin/onboarding?view=forms"')
);

expect('src/routes/admin/+page.svelte', 'manager dashboard links separate registry and feature workspaces', (source) =>
  source.includes('href="/admin/business-registry"') &&
  source.includes('href="/admin/feature-matrix"') &&
  !source.includes('/admin/app-editor#business-registry')
);

expect('src/routes/admin/business-registry/+page.svelte', 'business registry owns billing access', (source) =>
  source.includes('<PageHeader title="Business Registry"') &&
  source.includes('href="/billing"') &&
  source.includes('Manage Billing')
);

expect('src/routes/admin/feature-matrix/+page.svelte', 'feature matrix has a dedicated workspace', (source) =>
  source.includes('<PageHeader title="Feature Matrix"') &&
  source.includes('action="?/save"') &&
  source.includes('Save Changes')
);

expect('src/routes/admin/app-editor/+page.svelte', 'app editor is limited to sidebar branding', (source) =>
  source.includes('Sidebar Branding') &&
  source.includes('action="?/save_branding"') &&
  !source.includes('action="?/save_business"') &&
  !source.includes('action="?/save_features"')
);

expect('src/routes/admin/+page.server.ts', 'manager dashboard summarizes requests and owns announcement history', (source) =>
  source.includes('countPendingScheduleRequests') &&
  !source.includes('loadPendingScheduleTimeOffRequests') &&
  !source.includes('loadPendingScheduleAvailabilityRequests') &&
  !source.includes('approve_time_off:') &&
  !source.includes('approve_availability:') &&
  !source.includes('make_user_admin:') &&
  !source.includes('delete_user:') &&
  !source.includes('toggle_specials_access:') &&
  source.includes('loadAdminAnnouncementHistory') &&
  source.includes('delete_announcement_history')
);

expect('src/routes/admin/schedule/+page.server.ts', 'schedule workspace owns requests and schedule setup without duplicate people controls', (source) =>
  source.includes('loadPendingScheduleAvailabilityRequests') &&
  source.includes('approve_time_off:') &&
  source.includes('approve_availability:') &&
  source.includes('create_department:') &&
  source.includes('create_role:') &&
  source.includes('delete_department:') &&
  source.includes('delete_role:') &&
  !source.includes('update_permissions:') &&
  !source.includes('update_capabilities:') &&
  !source.includes('toggle_schedule_department:') &&
  !source.includes('save_schedule_roles:')
);

expect('src/routes/admin/schedule/+page.svelte', 'schedule builder exposes consolidated tools', (source) =>
  source.includes('<option value="approvals">') &&
  source.includes('<option value="setup">Roles &amp; Departments</option>') &&
  source.includes('href="/admin/users?view=team"') &&
  source.includes('action="?/approve_availability"') &&
  source.includes('action="?/create_department"') &&
  source.includes('action="?/create_role"')
);

expect('src/routes/admin/schedule/+page.svelte', 'schedule manager tools keep records visible and editors collapsed', (source) =>
  source.includes('class="tool-metric-strip"') &&
  source.includes('<summary>Create Open Shift</summary>') &&
  source.includes('<summary>Save Current Week</summary>') &&
  source.includes('<summary>Apply Template</summary>') &&
  source.includes('<summary>Add Department or Role</summary>') &&
  source.indexOf('{#if data.openShifts.length > 0}') < source.indexOf('<summary>Create Open Shift</summary>') &&
  source.indexOf('class="department-setup-list"') < source.indexOf('<summary>Add Department or Role</summary>')
);

expect('src/routes/admin/schedule/+page.svelte', 'schedule saves serialize autosave and publish requests', (source) =>
  source.includes('let autosaveInFlight: Promise<boolean> | null = null;') &&
  source.includes('const submitScheduleWeek: SubmitFunction') &&
  source.includes('writeSchedulePayloadToFormData(formData);') &&
  source.includes('use:enhance={submitScheduleWeek}') &&
  source.includes('disabled={isScheduleSubmitting}') &&
  !source.includes('autosaveRequestId') &&
  !source.includes('preparePublishPayload')
);

expect('src/lib/server/schedules.ts', 'schedule drafts are atomic, separate, and duplicate-safe', (source) =>
  source.includes('function dedupeShiftInsertRows') &&
  source.includes('async function replaceScheduleDraftWeekDataAtomic') &&
  source.includes('schedule_draft_shifts') &&
  source.includes('schedule_draft_open_shifts') &&
  source.includes('draft_write_token') &&
  source.includes('FROM json_each(?) AS item') &&
  source.includes("if (!payload) return fail(400, { error: 'No schedule data was submitted.' });") &&
  source.includes("? await saveScheduleWeekDraftFromForm(db, form, locals, businessId)")
);

expect('src/lib/server/schedules.ts', 'schedule user joins follow tenant memberships', (source) =>
  source.includes('JOIN business_users member') &&
  source.includes('JOIN business_users scheduled_member') &&
  source.includes('JOIN business_users offering_member') &&
  !/\b(?:u|offered|targeted|requested)\.business_id\b/.test(source)
);

for (const route of [
  'src/routes/my-schedule/+page.server.ts',
  'src/routes/schedule/+page.server.ts',
  'src/routes/admin/schedule/+page.server.ts'
]) {
  expect(route, `${route} requires and consistently uses the active business`, (source) =>
    source.includes('const businessId = requireBusinessId(locals);') &&
    !source.includes('locals.businessId ??')
  );
}

expect('src/lib/server/schedules.ts', 'published schedule approvals remain synchronized with manager drafts', (source) =>
  source.includes('This shift changed in the schedule draft.') &&
  source.includes('This open shift changed in the schedule draft.') &&
  source.includes('UPDATE schedule_draft_shifts') &&
  source.includes('INSERT INTO schedule_draft_shifts') &&
  source.includes('DELETE FROM schedule_draft_open_shifts') &&
  source.includes('published_version = published_version + 1')
);

expect('src/lib/server/schedules.ts', 'draft references protect schedule departments and roles from deletion', (source) =>
  source.includes('SELECT COUNT(*) AS count FROM schedule_draft_shifts WHERE department = ? AND business_id = ?') &&
  source.includes('SELECT COUNT(*) AS count FROM schedule_draft_open_shifts WHERE department = ? AND business_id = ?') &&
  source.includes('SELECT COUNT(*) AS count FROM schedule_draft_shifts WHERE department = ? AND role = ? AND business_id = ?') &&
  source.includes('SELECT COUNT(*) AS count FROM schedule_draft_open_shifts WHERE department = ? AND role = ? AND business_id = ?')
);

expect('src/routes/admin/schedule/+page.svelte', 'schedule relies on autosave without a manual draft button', (source) =>
  source.includes("fetch('?/save_week'") &&
  source.includes("formData.set('draft_version', String(serverDraftVersion));") &&
  source.includes("formData.delete('payload');") &&
  source.includes('id: shift.clientId') &&
  source.includes('function buildEmployeeRowsFromData()') &&
  source.includes('data.weekStart !== loadedWeekStart') &&
  !source.includes('Save Draft')
);

expect('src/lib/server/history.ts', 'publishing snapshots history and final status in one batch', (source) =>
  source.includes("completionStatements: ReturnType<DB['prepare']>[] = []") &&
  source.includes("preparationStatements: ReturnType<DB['prepare']>[] = []") &&
  source.includes('...preparationStatements') &&
  source.includes('guard.draft_write_token = ?') &&
  source.includes('INSERT INTO schedule_shift_history') &&
  source.includes('...completionStatements') &&
  !source.includes('for (const shift of shifts.results ?? [])')
);

expect('src/lib/components/ui/ScheduleTimeSelect.svelte', 'schedule time selection closes through explicit commit and cancel events', (source) =>
  source.includes("commit: { value: string }; cancel: void") &&
  source.includes("dispatch('cancel')") &&
  source.includes("dispatch('commit', { value })") &&
  !source.includes('confirmationTimer')
);

expect('src/routes/admin/users/[id]/+page.svelte', 'employee records own access and schedule assignments', (source) =>
  source.includes('action="?/update_permissions"') &&
  source.includes('name="position_id"') &&
  source.includes('action="?/update_capabilities"') &&
  source.includes('action="?/toggle_schedule_department"') &&
  source.includes('action="?/save_schedule_roles"') &&
  source.includes('Documents &amp; Compliance') &&
  !source.includes('employee_sensitive_record_vault')
);

expect('src/routes/admin/users/+page.svelte', 'People and HR owns tenant position defaults', (source) =>
  source.includes('<h2>Positions</h2>') &&
  source.includes('action="?/create_position"') &&
  source.includes('action="?/update_position"') &&
  source.includes('action="?/toggle_position"')
);

expect('src/routes/admin/users/+page.svelte', 'People and HR overview and team directory use focused views', (source) =>
  source.includes("activeView === 'overview'") &&
  source.includes("activeView === 'team'") &&
  source.includes("activeView === 'hr'") &&
  source.includes("activeView === 'access'") &&
  source.includes('aria-label="People and HR quick actions"') &&
  source.includes('placeholder="Name, email, role, department"') &&
  source.includes('bind:value={staffStatus}') &&
  source.includes('bind:value={staffAccountType}') &&
  source.includes('bind:value={staffDepartment}') &&
  source.includes('bind:value={staffPosition}') &&
  !source.includes('PeopleHrNav')
);

expect('src/routes/admin/users/[id]/+page.svelte', 'employee records retain record tabs without duplicate section navigation', (source) =>
  source.includes('class="record-nav"') &&
  source.includes('action="?/update_permissions"') &&
  !source.includes('PeopleHrNav')
);

expect('src/routes/admin/onboarding/+page.server.ts', 'onboarding loads only the selected permission-aware workspace', (source) =>
  source.includes("new Set(['invites', 'packets', 'forms'])") &&
  source.includes("activeView === 'forms'") &&
  source.includes("activeView === 'packets'") &&
  source.includes("activeView === 'invites'") &&
  source.includes('canManageOnboarding') &&
  source.includes('canReviewOnboarding') &&
  source.includes('canManageHrSetup')
);

expect('src/routes/admin/onboarding/+page.svelte', 'onboarding separates invitations, packets, and forms', (source) =>
  source.includes("data.activeView === 'invites'") &&
  source.includes("data.activeView === 'packets'") &&
  source.includes("data.activeView === 'forms'") &&
  source.includes('Invite Employee') &&
  source.includes('<h2>Employee packets</h2>') &&
  source.includes('<strong>Packet Forms</strong>') &&
  !source.includes('PeopleHrNav')
);

expect('src/routes/app/+page.svelte', 'announcements are viewed on the workspace dashboard', (source) =>
  source.includes('{#if featureAccess.announcements}') &&
  source.includes('class="announcement-copy"') &&
  source.includes('href="/admin#announcement-manager"')
);

expect('src/routes/todo/log/+page.server.ts', 'ToDo history uses current capability access without hidden mutations', (source) =>
  source.includes("'manage_content'") &&
  source.includes('LIMIT 250') &&
  !source.includes("locals.userRole !== 'admin'") &&
  !source.includes('export const actions')
);

expect('src/routes/todo/+page.svelte', 'ToDo managers can reach the completion log', (source) =>
  source.includes("href=\"/todo/log\"") &&
  source.includes('data.canViewHistory')
);

for (const route of [
  'src/routes/admin/business-registry/+page.svelte',
  'src/routes/admin/feature-matrix/+page.svelte',
  'src/routes/admin/sensors/+page.svelte',
  'src/routes/billing/+page.svelte'
]) {
  expect(route, `${route} uses Business and Systems navigation`, (source) =>
    source.includes('ManagerSectionNav') && source.includes('groupId="business"')
  );
}

for (const route of [
  'src/routes/admin/app-editor/+page.svelte',
  'src/routes/admin/creator/+page.svelte',
  'src/routes/admin/vendors/+page.svelte',
  'src/routes/todo/log/+page.svelte'
]) {
  expect(route, `${route} uses Content and Operations navigation`, (source) =>
    source.includes('ManagerSectionNav') && source.includes('groupId="workspace"')
  );
}

expect('src/routes/billing/+page.svelte', 'billing uses display-first status and collapsed workspace cancellation', (source) =>
  source.includes('class="status-grid"') &&
  source.includes('class="billing-section"') &&
  source.includes('<details class="danger-section">') &&
  source.includes('Manage Subscription')
);

expect('migrations/0100_admin_dashboard_workflows.sql', 'dashboard workflow storage is tenant scoped and indexed', (source) =>
  source.includes('CREATE TABLE IF NOT EXISTS announcement_history') &&
  source.includes('CREATE TABLE IF NOT EXISTS user_schedule_availability_requests') &&
  source.includes('business_id TEXT NOT NULL') &&
  source.includes('idx_schedule_availability_requests_one_pending')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) {
  console.error(`\nAdmin consolidation check failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log('\nAdmin consolidation check passed.');
