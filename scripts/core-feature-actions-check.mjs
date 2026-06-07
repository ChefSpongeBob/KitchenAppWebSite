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

function includesAll(source, tokens) {
  return tokens.every((token) => source.includes(token));
}

expect('src/routes/admin/creator/+page.server.ts', 'Creator Studio owns list recipe document menu and attachment actions', (source) =>
  includesAll(source, [
    'create_list_section',
    'update_list_section',
    'delete_list_section',
    'add_list_item',
    'update_list_item',
    'delete_list_item',
    'create_checklist_category',
    'add_checklist_item',
    'update_checklist_item',
    'delete_checklist_item',
    'create_recipe',
    'update_recipe',
    'delete_recipe',
    'create_document',
    'update_document',
    'delete_document',
    'create_item_attachment',
    'attach_target_to_item',
    'delete_item_attachment',
    'requireBusinessId(locals)'
  ])
);

expect('src/routes/admin/creator/+page.svelte', 'Creator Studio exposes core editor forms', (source) =>
  includesAll(source, [
    'action="?/create_list_section"',
    'action="?/add_list_item"',
    'action="?/create_recipe"',
    'action="?/update_recipe"',
    'action="?/create_document"',
    'action="?/update_document"',
    'action="?/create_item_attachment"',
    'action="?/attach_target_to_item"',
    'enctype="multipart/form-data"',
    "editorType === 'menu'"
  ])
);

for (const [domain, path] of [
  ['prep', 'src/routes/lists/preplists/[section]/+page.server.ts'],
  ['inventory', 'src/routes/lists/inventory/[section]/+page.server.ts'],
  ['orders', 'src/routes/lists/orders/[section]/+page.server.ts']
]) {
  expect(path, `${domain} lists submit through shared tenant-scoped handler`, (source) =>
    includesAll(source, ['export const actions', 'submit_prep_counts', 'handlersFor(event.params.section)'])
  );
}

expect('src/routes/lists/checklists/[section]/[shift]/+page.server.ts', 'checklists support section shift actions', (source) =>
  includesAll(source, ['createChecklistPage', 'export const actions', 'toggle_checked', 'reset_checklist'])
);

expect('src/lib/server/preplist.ts', 'list submissions record history and operational events', (source) =>
  includesAll(source, [
    'recordListSubmission',
    'recordListItemActivity',
    'recordOperationalEventBestEffort',
    'business_id = ?',
    "eventType: `list.${domain}.submitted`",
    "eventType: `list.${domain}.completed`"
  ])
);

expect('src/routes/docs/+page.server.ts', 'documents viewer is category and business scoped', (source) =>
  includesAll(source, [
    'loadAdminDocumentCategories',
    'requireBusinessId(locals)',
    'business_id = ?',
    "!= 'menu'"
  ])
);

expect('src/routes/menu/+page.server.ts', 'menu viewer reads active business-scoped menu uploads', (source) =>
  includesAll(source, ['requireBusinessId(locals)', 'business_id = ?', 'LOWER(section) =', 'menuDocs'])
);

expect('src/routes/recipes/+page.server.ts', 'recipe categories are tenant scoped', (source) =>
  includesAll(source, ['requireBusinessId(locals)', 'business_id = ?', 'category'])
);

expect('src/routes/todo/+page.server.ts', 'ToDo supports tenant-scoped completion', (source) =>
  includesAll(source, [
    'requireBusinessId(locals)',
    'business_id = ?',
    'complete: async',
    'todo_completion_log'
  ]) &&
  !source.includes('reopen: async') &&
  !source.includes('completed_by = NULL, completed_at = NULL')
);

expect('src/routes/admin/+page.server.ts', 'admin dashboard owns ToDo reminders moderation announcement and spotlight actions', (source) =>
  includesAll(source, [
    'create_todo',
    'delete_todo',
    'create_reminder',
    'update_reminder',
    'delete_reminder',
    'approve_whiteboard',
    'reject_whiteboard',
    'delete_whiteboard',
    'save_announcement',
    'save_employee_spotlight',
    'toggle_specials_access'
  ])
);

expect('src/routes/api/whiteboard/+server.ts', 'whiteboard API supports business-scoped submit and vote', (source) =>
  includesAll(source, [
    'export const GET',
    'export const POST',
    'scopedBusinessId(locals)',
    'whiteboard_posts',
    'whiteboard_votes',
    'business_id = ?'
  ])
);

expect('src/routes/whiteboard/+page.svelte', 'whiteboard cloud text stays black in all themes', (source) =>
  source.includes('color: #111214 !important') &&
  !source.includes(":global(html[data-theme='dark']) .idea-text") &&
  !source.includes(":global(html[data-theme='dark']) small")
);

expect('src/routes/specials/+page.server.ts', 'specials save through permission checked tenant storage', (source) =>
  includesAll(source, [
    'save_specials',
    'userCanEditDailySpecials',
    'locals.businessId',
    'ensureTenantSchema'
  ])
);

expect('src/routes/announcements/+page.server.ts', 'announcements save through permission checked tenant storage', (source) =>
  includesAll(source, [
    'save_announcement',
    'userCanEditHomepageAnnouncement',
    'locals.businessId',
    'ensureTenantSchema'
  ])
);

expect('src/routes/admin/vendors/+page.server.ts', 'admin vendors support create update delete', (source) =>
  includesAll(source, ['create_vendor', 'update_vendor', 'delete_vendor', 'requireBusinessId(locals)'])
);

expect('src/routes/vendors/+page.server.ts', 'vendor viewer is business scoped', (source) =>
  includesAll(source, ['loadVendors', 'requireBusinessId(locals)'])
);

expect('src/routes/admin/app-editor/+page.server.ts', 'app editor persists branding registry and feature modes', (source) =>
  includesAll(source, [
    'save_branding',
    'save_registry',
    'saveAppFeatureModes',
    'locals.businessId',
    'sidebar_logo_url',
    'uploadBrandLogo'
  ])
);

expect('src/routes/conversions/+page.svelte', 'conversions page remains available as a real app feature', (source) =>
  includesAll(source, ['const units', 'convertedAmount', 'cupChart', 'weightChart'])
);

expect('docs/PROJECT_HANDOFF.md', 'handoff tracks Phase 12 manual core feature test needs', (source) =>
  source.includes('12. Core feature action test') &&
  source.includes('Phase 12 core action pass')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) {
  console.error(`\nCore feature action check failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log('\nCore feature action check passed.');
