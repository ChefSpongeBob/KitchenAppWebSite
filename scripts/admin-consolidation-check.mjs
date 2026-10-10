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

expect('src/lib/components/ui/AdminEditorMenu.svelte', 'admin dropdown has one content editor entry', (source) =>
  source.includes("label: 'Creator Studio'") &&
  source.includes("href: '/admin/business-registry'") &&
  source.includes("href: '/admin/feature-matrix'") &&
  !source.includes('/admin/app-editor#business-registry') &&
  !source.includes("label: 'Category Creator'") &&
  !source.includes("label: 'Documents'") &&
  !source.includes("label: 'Lists'") &&
  !source.includes("label: 'Menus'") &&
  !source.includes("label: 'Recipes'")
);

expect('src/routes/+layout.svelte', 'admin sidebar has one content editor entry', (source) =>
  source.includes('label: "Creator Studio"') &&
  !source.includes('label: "Category Creator"') &&
  !source.includes('label: "Documents", route: "/admin/documents"') &&
  !source.includes('label: "Lists", route: "/admin/lists"') &&
  !source.includes('label: "Menus", route: "/admin/menus"') &&
  !source.includes('label: "Recipes", route: "/admin/recipes"')
);

expect('src/routes/admin/+page.svelte', 'manager dashboard keeps navigation and groups scheduling with people tools', (source) =>
  source.includes('<PageHeader title="Manager Dashboard" />') &&
  source.includes('<h2>Schedule & People</h2>') &&
  source.includes('href="/admin/schedule"') &&
  source.includes('href="/admin/schedule?tool=approvals"') &&
  source.includes('href="/admin/schedule?tool=setup"') &&
  source.includes('href="/admin/users"') &&
  source.includes('href="/admin/onboarding#employee-packets"') &&
  source.includes('href="/admin/onboarding#packet-builder"')
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
  source.includes('Save Feature Matrix')
);

expect('src/routes/admin/app-editor/+page.svelte', 'app editor is limited to sidebar branding', (source) =>
  source.includes('Sidebar Branding') &&
  !source.includes('Business Registry') &&
  !source.includes('Feature Visibility')
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

expect('src/routes/announcements/+page.svelte', 'shared announcements page is view only', (source) =>
  source.includes('<PageHeader title="Announcements" />') &&
  !source.includes('save_announcement') &&
  !source.includes('<textarea')
);

expect('src/routes/todo/log/+page.server.ts', 'ToDo history uses current capability access without hidden mutations', (source) =>
  source.includes("'manage_content'") &&
  source.includes('LIMIT 250') &&
  !source.includes("locals.userRole !== 'admin'") &&
  !source.includes('export const actions')
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
