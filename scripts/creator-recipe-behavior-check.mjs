import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import * as serverRuntime from 'svelte/internal/server';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

function component(source, dependencies = {}) {
  const exports = {};
  const output = ts.transpileModule(compile(source, { generate: 'server' }).js.code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  new Function('require', 'exports', output)(name => {
    if (name === 'svelte/internal/server') return serverRuntime;
    assert.ok(name in dependencies, 'Unexpected creator dependency: ' + name);
    return dependencies[name];
  }, exports);
  return exports;
}

const source = readFileSync('src/routes/admin/creator/+page.svelte', 'utf8');
assert.match(source, /\{@const items = data\.recipes\.filter\(/,
  'Category rows must depend directly on refreshed recipes, not only a helper call with unchanged category text');
const empty = { __esModule: true, default() {} };
const creator = component(source, {
  '#lib/components/ui/Layout.svelte': component('<slot />'),
  '#lib/components/ui/PageHeader.svelte': empty,
  '#lib/components/ui/ManagerSectionNav.svelte': empty,
  '$app/forms': { applyAction() {}, enhance() {} },
  '$app/navigation': { invalidateAll() {} },
  '#lib/client/toasts.ts': { pushToast() {} },
  svelte: { async tick() {} }
});
const screen = data => render(creator.default, { props: { data } }).body;
const test = createTestD1();
const load = loadServerModules();
const route = load('src/routes/admin/creator/+page.server.ts');
const now = Math.floor(Date.now() / 1000);
function insert(table, row) {
  const keys = Object.keys(row);
  test.sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
}
const locals = businessId => ({ DB: test.db, userId: 'owner-' + businessId, userRole: 'admin', businessId,
  businessRole: 'owner', businessPermissionTemplate: 'owner' });
const page = businessId => route.load({ locals: locals(businessId), url: new URL('https://criminiops.com/admin/creator?editor=recipe') });
const submit = (businessId, fields) => route.actions.create_recipe({ locals: locals(businessId),
  request: formRequest(fields, '/admin/creator?/create_recipe') });
try {
  for (const id of ['recipe-a', 'recipe-b']) {
    insert('businesses', { id, name: id, slug: id, created_at: now, updated_at: now });
    insert('users', { id: 'owner-' + id, email: id + '@example.invalid', email_normalized: id + '@example.invalid', created_at: now, updated_at: now });
    insert('business_users', { business_id: id, user_id: 'owner-' + id, role: 'owner', permission_template: 'owner', created_at: now, updated_at: now });
  }
  const emptyPage = await page('recipe-a');
  assert.match(screen(emptyPage), /No recipe categories yet/);
  assert.match(screen(emptyPage), /href="\/admin\/creator\?editor=category&amp;type=recipe"/);
  assert.doesNotMatch(screen(emptyPage), /action="\?\/create_recipe"/);
  for (const id of ['recipe-a', 'recipe-b']) {
    for (const category of ['Kitchen', 'Bakery']) insert('creator_category_registry', {
      id: id + category, business_id: id, editor_type: 'recipe', category, created_at: now
    });
  }
  const before = await page('recipe-a');
  const markup = screen(before);
  const composer = markup.match(/<details[^>]*id="recipe-create-editor"[^>]*>/)?.[0];
  assert.ok(composer);
  assert.match(markup, /<strong[^>]*>Add Recipe<\/strong>/, 'Primary recipe action must have visible bold emphasis');
  assert.match(markup, /class="recipe-add-icon[^\"]*" aria-hidden="true">\+<\/span>/, 'Primary recipe action has a simple plus indicator');
  assert.equal(/\bopen(?:[\s=>])/.test(composer), false, 'Recipe form remains collapsed by default');
  assert.equal((markup.match(/action="\?\/create_recipe"/g) ?? []).length, 1, 'One shared creation form, not a form per category');
  assert.ok(markup.indexOf('id="recipe-create-editor"') < markup.indexOf('class="entity '), 'Add Recipe appears before the category list');
  assert.match(markup, /name="category"/);
  assert.equal((markup.match(/aria-controls="recipe-create-editor"/g) ?? []).length, 2);
  const fields = { title: 'Soup (daily)', category: 'Kitchen', ingredients: 'Carrots\nStock', instructions: 'Simmer, then serve.' };
  assert.equal((await submit('recipe-a', fields)).success, true);
  assert.equal((await submit('recipe-b', { ...fields, title: 'Other restaurant recipe' })).success, true);
  const after = await page('recipe-a');
  assert.equal(after.recipes.length, 1);
  assert.equal(after.recipes[0].category, 'Kitchen');
  assert.equal(after.recipes[0].title, fields.title);
  assert.equal(after.recipes[0].ingredients, fields.ingredients);
  assert.equal(after.recipes[0].instructions, fields.instructions);
  assert.match(screen(after), />1 recipe</);
  assert.doesNotMatch(screen(after), /Other restaurant recipe/);
  const failed = await submit('recipe-a', { ...fields, instructions: '' });
  assert.equal(failed.status, 400);
  assert.equal((await page('recipe-a')).recipes.length, 1, 'Validation failure cannot create a partial recipe');
  await assert.rejects(route.actions.create_recipe({ locals: { ...locals('recipe-a'), featureModes: { recipes: 'off' } },
    request: formRequest(fields, '/admin/creator?/create_recipe') }), error => error.status === 403);
  assert.equal((await page('recipe-a')).recipes.length, 1);
  assert.deepEqual(test.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  console.log('PASS creator recipe: discoverable single collapsed form, category shortcuts/empty state, unchanged real save fields, refreshed counts, tenant isolation and feature/validation denial');
} finally { test.close(); }
