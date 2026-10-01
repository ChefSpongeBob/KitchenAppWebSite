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
