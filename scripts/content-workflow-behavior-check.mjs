import assert from 'node:assert/strict';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

const failures = [];
async function check(name, run) {
  const test = createTestD1();
  const { sqlite, db } = test;
  const batch = db.batch.bind(db);
  let queue = Promise.resolve();
  db.batch = statements => {
    const result = queue.then(() => batch(statements));
    queue = result.catch(() => {});
    return result;
  };
  const now = Math.floor(Date.now() / 1000);
  const events = [];
  const objects = new Set();
  const load = loadServerModules({
    '#lib/server/observability.ts': { logOperationalEvent() {}, logOperationalError() {} },
    '#lib/server/operationalEvents.ts': { async recordOperationalEventBestEffort(_db, event) { events.push(event); } }
  });
  const insert = (table, row) => {
    const keys = Object.keys(row);
    sqlite.prepare(`INSERT INTO ${table} (${keys}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
  };
  for (const business of ['a', 'b']) {
    insert('businesses', { id: business, name: business, slug: business, created_at: now, updated_at: now });
    for (const role of ['owner', 'staff']) {
      const id = role + '-' + business;
      insert('users', { id, email: id + '@example.invalid', email_normalized: id + '@example.invalid', display_name: id, created_at: now, updated_at: now });
      insert('business_users', { business_id: business, user_id: id, role, permission_template: role, created_at: now, updated_at: now });
    }
    insert('creator_category_registry', { id: 'category-' + business, business_id: business, editor_type: 'recipe', category: 'Kitchen', created_at: now });
    insert('creator_category_registry', { id: 'docs-' + business, business_id: business, editor_type: 'document', category: 'Kitchen', created_at: now });
    insert('list_sections', { id: 'list-' + business, business_id: business, domain: 'preplists', slug: 'daily', title: 'Daily', created_at: now, updated_at: now });
    insert('list_items', { id: 'item-' + business, business_id: business, section_id: 'list-' + business, content: 'Rice', created_at: now, updated_at: now });
    insert('checklist_sections', { id: 'check-' + business, business_id: business, slug: 'closing', title: 'Closing Checklist', created_at: now, updated_at: now });
    insert('checklist_items', { id: 'task-' + business, business_id: business, section_id: 'check-' + business, content: 'Sanitize', created_at: now, updated_at: now });
    insert('recipes', { id: business === 'a' ? 1 : 2, business_id: business, title: 'Rice', category: 'Kitchen', ingredients: 'Rice, water', instructions: 'Cook', created_at: '2026-11-08' });
    const key = `businesses/${business}/documents/handbook.pdf`; objects.add(key);
    insert('documents', { id: 'doc-' + business, business_id: business, slug: 'handbook', title: 'Handbook', section: 'Docs', category: 'Kitchen', file_url: '/api/documents/media/' + key, created_at: now, updated_at: now });
    insert('item_attachments', { id: 'attach-' + business, business_id: business, source_type: 'list_item', source_item_id: 'item-' + business, target_type: 'recipe', target_id: business === 'a' ? '1' : '2', created_at: now });
  }
  const locals = { DB: db, env: { DB: db }, businessId: 'a', userId: 'owner-a', userRole: 'admin', businessRole: 'owner', businessPermissionTemplate: 'owner',
    MEDIA_BUCKET: { async put(key) { objects.add(key); }, async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key); } } };
  try {
    await run({ test, db, sqlite, now, insert, events, objects, locals, load, admin: load('src/lib/server/admin.ts'), request: formRequest });
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    console.log('PASS ' + name);
  } catch (error) { failures.push(name); console.error('FAIL ' + name + ': ' + error.message); }
  finally { test.close(); }
}

await check('list plus first item is one transaction, not an empty saved list on late failure', async ({ admin, sqlite, locals, request }) => {
  sqlite.exec("CREATE TRIGGER fixture_first_item BEFORE INSERT ON list_items BEGIN SELECT RAISE(ABORT,'first item rollback'); END");
  await assert.rejects(admin.createListSection(request({ domain: 'inventory', title: 'Stock (AM)', first_item: 'Rice' }), locals), /first item rollback/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM list_sections WHERE domain='inventory'").get().n, 0);
});
for (const [name, action, fields, table, id] of [
  ['list section', 'deleteListSection', { section_id: 'list-a' }, 'list_sections', 'list-a'],
  ['list item', 'deleteListItem', { id: 'item-a' }, 'list_items', 'item-a'],
  ['recipe', 'deleteRecipe', { id: 1 }, 'recipes', 1]
]) await check(name + ' deletion rolls attachments back on a late DB failure', async ({ admin, sqlite, locals, request }) => {
  sqlite.exec(`CREATE TRIGGER fixture_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'delete rollback'); END`);
  await assert.rejects(admin[action](request(fields), locals), /delete rollback/);
  assert.ok(sqlite.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id));
  assert.ok(sqlite.prepare("SELECT id FROM item_attachments WHERE id='attach-a'").get());
});
await check('recipe category rename and registry change commit or roll back together', async ({ admin, sqlite, locals, request }) => {
  sqlite.exec("CREATE TRIGGER fixture_registry BEFORE INSERT ON creator_category_registry BEGIN SELECT RAISE(ABORT,'registry rollback'); END");
  await assert.rejects(admin.updateCreatorCategory(request({ editor_type: 'recipe', previous_category: 'Kitchen', next_category: 'Service' }), locals), /registry rollback/);
  assert.equal(sqlite.prepare('SELECT category FROM recipes WHERE id=1').get().category, 'Kitchen');
  assert.ok(sqlite.prepare("SELECT id FROM creator_category_registry WHERE id='category-a'").get());
});
await check('recipe plus category registry save is atomic', async ({ admin, sqlite, locals, request }) => {
  sqlite.exec("CREATE TRIGGER fixture_registry BEFORE INSERT ON creator_category_registry BEGIN SELECT RAISE(ABORT,'registry rollback'); END");
  await assert.rejects(admin.createRecipe(request({ title: 'New', category: 'New', ingredients: 'Rice', instructions: 'Cook' }), locals), /registry rollback/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM recipes WHERE title='New'").get().n, 0);
});
await check('category deletion removes its attachments and unreferenced files, not another tenant', async ({ admin, sqlite, locals, request, objects, insert, now }) => {
  insert('item_attachments', { id: 'doc-link', business_id: 'a', source_type: 'checklist_item', source_item_id: 'task-a', target_type: 'document', target_id: 'doc-a', created_at: now });
  assert.equal((await admin.deleteCreatorCategory(request({ editor_type: 'document', category: 'Kitchen', delete_with_content: 1 }), locals)).success, true);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM item_attachments WHERE id='doc-link'").get().n, 0);
  assert.equal(objects.has('businesses/a/documents/handbook.pdf'), false);
  assert.equal(objects.has('businesses/b/documents/handbook.pdf'), true);
  assert.ok(sqlite.prepare("SELECT id FROM documents WHERE id='doc-b'").get());
});
await check('category delete failure restores content and attachments, preserving files', async ({ admin, sqlite, locals, request, objects }) => {
  sqlite.exec("CREATE TRIGGER fixture_registry BEFORE DELETE ON creator_category_registry BEGIN SELECT RAISE(ABORT,'category rollback'); END");
  await assert.rejects(admin.deleteCreatorCategory(request({ editor_type: 'recipe', category: 'Kitchen', delete_with_content: 1 }), locals), /category rollback/);
  assert.ok(sqlite.prepare('SELECT id FROM recipes WHERE id=1').get());
  assert.ok(sqlite.prepare("SELECT id FROM item_attachments WHERE id='attach-a'").get());
  assert.equal(objects.size, 2);
});
await check('missing recipe updates do not report saved or create empty categories', async ({ admin, locals, sqlite, request }) => {
  assert.equal((await admin.updateRecipe(request({ id: 2, title: 'Foreign', category: 'Ghost', ingredients: 'Rice', instructions: 'Cook' }), locals)).status, 404);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM creator_category_registry WHERE category='Ghost'").get().n, 0);
});
for (const source of ['checklists', 'preplists']) await check(source + ' completion and actor history are atomic and repeated completion is a no-op', async ({ load, locals, sqlite, request, events }) => {
  const checklist = source === 'checklists';
  const table = checklist ? 'checklist_items' : 'list_items';
  const id = checklist ? 'task-a' : 'item-a';
  const page = checklist ? load('src/lib/server/checklists.ts').createChecklistPage('closing', 'Closing', { defaults: [] })
    : load('src/lib/server/preplist.ts').createListPage('preplists', 'daily', 'Daily', { valueType: 'text' });
  const complete = () => page.actions.toggle_checked({ locals, request: request({ id, is_checked: 1 }) });
  sqlite.exec("CREATE TRIGGER fixture_history BEFORE INSERT ON list_item_activity_events BEGIN SELECT RAISE(ABORT,'completion rollback'); END");
  await assert.rejects(complete(), /completion rollback/);
  assert.equal(sqlite.prepare(`SELECT is_checked FROM ${table} WHERE id=?`).get(id).is_checked, 0);
  sqlite.exec('DROP TRIGGER fixture_history');
  assert.equal((await complete()).success, true); const count = events.length;
  assert.equal((await complete()).success, true);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM list_item_activity_events').get().n, 1);
  assert.equal(events.length, count);
  assert.equal((await page.actions.toggle_checked({ locals, request: request({ id: 'missing', is_checked: 1 }) })).status, 404);
});
await check('par values validate all inputs and save atomically', async ({ load, locals, sqlite, request, insert, now }) => {
  insert('list_items', { id: 'second-a', business_id: 'a', section_id: 'list-a', content: 'Fish', created_at: now, updated_at: now });
  const page = load('src/lib/server/preplist.ts').createListPage('preplists', 'daily', 'Daily', {});
  assert.equal((await page.actions.save_par_levels({ locals, request: request({ 'par_item-a': 7, 'par_second-a': 'NaN' }) })).status, 400);
  assert.equal(sqlite.prepare("SELECT par_count FROM list_items WHERE id='item-a'").get().par_count, 0);
});

await check('whiteboard moderation cannot replace another tenant review', async ({ admin, sqlite, locals, request, insert, now }) => {
  insert('whiteboard_posts', { id: 'idea-b', business_id: 'b', content: 'Private idea', votes: 0, created_by: 'staff-b', created_at: now, updated_at: now });
  insert('whiteboard_review', { post_id: 'idea-b', business_id: 'b', status: 'pending', reviewed_at: now });
  assert.equal((await admin.approveWhiteboard(request({ id: 'idea-b' }), locals)).status, 404);
  assert.equal(sqlite.prepare("SELECT status FROM whiteboard_review WHERE post_id='idea-b'").get().status, 'pending');
  assert.equal((await admin.rejectWhiteboard(request({ id: 'idea-b' }), locals)).status, 404);
});
await check('whiteboard posts and moderation records are one transaction', async ({ load, locals, sqlite }) => {
  const api = load('src/routes/api/whiteboard/+server.ts');
  sqlite.exec("CREATE TRIGGER fixture_review BEFORE INSERT ON whiteboard_review BEGIN SELECT RAISE(ABORT,'review rollback'); END");
  await assert.rejects(api.POST({ locals, request: new Request('https://criminiops.com/api/whiteboard', { method: 'POST', body: JSON.stringify({ action: 'add', content: 'New idea' }) }) }), /review rollback/);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM whiteboard_posts').get().n, 0);
});
await check('whiteboard votes and totals roll back together and deny foreign or unapproved ideas', async ({ load, locals, sqlite, insert, now }) => {
  const api = load('src/routes/api/whiteboard/+server.ts');
  for (const business of ['a', 'b']) {
    insert('whiteboard_posts', { id: 'idea-' + business, business_id: business, content: 'Idea', votes: 0, created_by: 'staff-' + business, created_at: now, updated_at: now });
    insert('whiteboard_review', { post_id: 'idea-' + business, business_id: business, status: 'approved', reviewed_at: now });
  }
  const vote = id => api.POST({ locals, request: new Request('https://criminiops.com/api/whiteboard', { method: 'POST', body: JSON.stringify({ action: 'upvote', id }) }) });
  assert.equal((await vote('idea-b')).status, 404);
  sqlite.exec("CREATE TRIGGER fixture_vote BEFORE UPDATE ON whiteboard_posts BEGIN SELECT RAISE(ABORT,'vote rollback'); END");
  await assert.rejects(vote('idea-a'), /vote rollback/);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM whiteboard_votes').get().n, 0);
  sqlite.exec('DROP TRIGGER fixture_vote');
  assert.equal((await vote('idea-a')).status, 200);
  assert.equal((await vote('idea-a')).status, 409);
  assert.equal(sqlite.prepare("SELECT votes FROM whiteboard_posts WHERE id='idea-a'").get().votes, 1);
});

await check('document names accept punctuation and standalone creation registers its visible category', async ({ admin, locals, request, sqlite, load }) => {
  const fields = { title: 'Cleaning (AM) & Safety', section: 'Docs', category: 'Procedures', file_url: '/api/documents/media/businesses/a/documents/handbook.pdf' };
  assert.equal((await admin.createDocument(request(fields), locals)).success, true);
  assert.equal(sqlite.prepare("SELECT slug FROM documents WHERE title=?").get(fields.title).slug, 'cleaning-am-safety');
  const docs = await load('src/routes/docs/+page.server.ts').load({ locals });
  assert.ok(docs.docs.some(row => row.title === fields.title));
  assert.equal((await admin.createDocument(request(fields), locals)).status, 400);
});
await check('document plus category failure preserves saved records and cleans a failed new upload', async ({ admin, locals, request, sqlite, objects }) => {
  sqlite.exec("CREATE TRIGGER fixture_registry BEFORE INSERT ON creator_category_registry BEGIN SELECT RAISE(ABORT,'document category rollback'); END");
  const form = new FormData(); form.set('title', 'New handbook'); form.set('category', 'New');
  form.set('file', new File(['%PDF-fixture'], 'handbook.pdf', { type: 'application/pdf' }));
  await assert.rejects(admin.createDocument(new Request('https://criminiops.com/admin/creator', { method: 'POST', body: form }), locals), /document category rollback/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM documents WHERE title='New handbook'").get().n, 0);
  assert.equal(objects.size, 2);
});
for (const action of ['createItemAttachment', 'attachTargetToItem']) await check(action + ' rechecks target existence at the insert boundary', async ({ load, db, sqlite, locals, request }) => {
  sqlite.exec("DELETE FROM item_attachments WHERE business_id='a'");
  const prepare = db.prepare;
  let removed = false;
  db.prepare = sql => {
    const statement = prepare(sql);
    if (/SELECT id FROM recipes WHERE/.test(sql)) {
      const first = statement.first.bind(statement);
      statement.first = async (...args) => {
        const row = await first(...args);
        if (!removed) { removed = true; sqlite.prepare('DELETE FROM recipes WHERE id=1').run(); }
        return row;
      };
    }
    return statement;
  };
  assert.equal((await load('src/lib/server/itemAttachments.ts')[action](request({ source_type: 'list_item', source_item_id: 'item-a', target_type: 'recipe', target_id: 1 }), locals)).status, 404);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM item_attachments WHERE business_id='a'").get().n, 0);
});

await check('ToDo assignment is tenant-local and rolls creation back if assignment fails', async ({ admin, locals, sqlite, request }) => {
  assert.equal((await admin.createTodo(request({ title: 'Foreign assignment', assigned_to: 'staff-b' }), locals)).status, 400);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM todos').get().n, 0);
  sqlite.exec("CREATE TRIGGER fixture_assignment BEFORE INSERT ON todo_assignments BEGIN SELECT RAISE(ABORT,'assignment rollback'); END");
  await assert.rejects(admin.createTodo(request({ title: 'Task', assigned_to: 'staff-a' }), locals), /assignment rollback/);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM todos').get().n, 0);
});
await check('ToDo completion and its existing history stay consistent without a reopen action', async ({ admin, load, locals, sqlite, request }) => {
  await admin.createTodo(request({ title: 'Task', assigned_to: 'staff-a' }), locals);
  const id = sqlite.prepare('SELECT id FROM todos').get().id;
  const page = load('src/routes/todo/+page.server.ts');
  assert.deepEqual(Object.keys(page.actions), ['complete']);
  const complete = () => page.actions.complete({ locals: { ...locals, userId: 'staff-a', userRole: 'user', businessRole: 'staff', businessPermissionTemplate: 'staff' }, request: request({ id }) });
  sqlite.exec("CREATE TRIGGER fixture_completion BEFORE INSERT ON todo_completion_log BEGIN SELECT RAISE(ABORT,'task rollback'); END");
  await assert.rejects(complete(), /task rollback/);
  assert.equal(sqlite.prepare('SELECT completed_at FROM todos').get().completed_at, null);
  sqlite.exec('DROP TRIGGER fixture_completion');
  assert.equal((await complete()).success, true); assert.equal((await complete()).success, true);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM todo_completion_log').get().n, 1);
});

for (const domain of ['preplists', 'inventory', 'orders']) await check(domain + ' real create/edit/submit/attachment/delete preserves the immutable submission and tenant', async ({ admin, load, locals, sqlite, request }) => {
  assert.equal((await admin.createListSection(request({ domain, title: 'Stock (AM)', first_item: 'Fish', first_details: 'Fillet', first_par_count: 2.5 }), locals)).success, true);
  const section = sqlite.prepare('SELECT id,slug FROM list_sections WHERE business_id=? AND domain=? AND slug=?').get('a', domain, 'stock-am');
  const item = sqlite.prepare('SELECT id FROM list_items WHERE section_id=?').get(section.id);
  assert.equal((await admin.updateListItem(request({ id: item.id, content: 'Salmon', details: 'Portion', par_count: 3.5 }), locals)).success, true);
  const attachments = load('src/lib/server/itemAttachments.ts');
  const fields = { source_type: 'list_item', source_item_id: item.id, target_type: 'recipe', target_id: 1 };
  assert.equal((await attachments.createItemAttachment(request(fields), locals)).success, true);
  assert.equal((await attachments.attachTargetToItem(request(fields), locals)).success, true);
  const page = load('src/lib/server/preplist.ts').createListPage(domain, section.slug, 'Stock', { valueLabel: 'Amount', valueType: domain === 'preplists' ? 'text' : 'number' });
  let data = await page.load({ locals }); assert.equal(data.items.length, 1); assert.equal(data.items[0].attachments.length, 1);
  assert.equal(data.items[0].attachments[0].instructions, 'Cook');
  assert.equal((await page.actions.submit_prep_counts({ locals, request: request({ ['amount_' + item.id]: domain === 'preplists' ? '4 lb' : 4.5 }) })).success, true);
  data = await page.load({ locals }); assert.equal(domain === 'preplists' ? data.items[0].amount_text : data.items[0].amount, domain === 'preplists' ? '4 lb' : 4.5);
  const snapshot = JSON.stringify(sqlite.prepare('SELECT * FROM list_submission_items').all());
  await page.actions.new_prep_list({ locals });
  await admin.deleteListSection(request({ section_id: section.id }), locals);
  assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM list_submission_items').all()), snapshot);
  assert.ok(sqlite.prepare("SELECT id FROM list_items WHERE id='item-b'").get());
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM item_attachments WHERE source_item_id=?').get(item.id).n, 0);
});
await check('menu file is routed to Menu, not Docs, and document media is private with safe types', async ({ admin, load, locals, request, sqlite }) => {
  const url = '/api/documents/media/businesses/a/documents/menu.pdf';
  assert.equal((await admin.createDocument(request({ title: 'Dinner (May)', category: 'Menu', section: 'Menu', file_url: url }), locals)).success, true);
  const docs = await load('src/routes/docs/+page.server.ts').load({ locals });
  assert.equal(docs.docs.some(row => row.file_url === url), false);
  const menu = await load('src/routes/menu/+page.server.ts').load({ locals });
  assert.ok(JSON.stringify(menu).includes(url));
  const media = load('src/routes/api/documents/media/[...key]/+server.ts');
  const get = async (type, business = 'a') => media.GET({ params: { key: 'businesses/a/documents/menu.pdf' }, locals: { ...locals, businessId: business,
    env: { DB: locals.DB, DOC_MEDIA: { async get() { return { body: 'fixture', httpMetadata: { contentType: type }, httpEtag: 'fixture' }; } } } }, request: new Request('https://criminiops.com' + url) });
  assert.equal((await get('application/pdf')).headers.get('content-type'), 'application/pdf');
  assert.equal((await get('text/html')).headers.get('content-type'), 'application/octet-stream');
  assert.equal((await get('text/html')).headers.get('content-disposition'), 'attachment');
  assert.equal((await get('application/pdf', 'b')).status, 404);
  const form = new FormData(); form.set('title', 'Bad upload'); form.set('file', new File(['<script>bad()</script>'], 'file.pdf', { type: 'text/html' }));
  assert.equal((await admin.createDocument(new Request('https://criminiops.com/admin/creator', { method: 'POST', body: form }), locals)).status, 400);
});
await check('ordinary staff can submit tenant-local waste and invalid amounts cannot write', async ({ load, locals, request, sqlite }) => {
  const page = load('src/routes/tools/waste/+page.server.ts');
  const staff = { ...locals, userId: 'staff-a', userRole: 'user', businessRole: 'staff', businessPermissionTemplate: 'staff' };
  assert.equal((await page.actions.default({ locals: staff, request: request({ product: 'Salmon', amount: 4, unit: 'lb', reason: 'Off odor' }) })).success, true);
  assert.equal((await page.actions.default({ locals: staff, request: request({ product: 'Salmon', amount: 'Infinity', reason: 'discard' }) })).status, 400);
  assert.equal((await page.load({ locals: { ...locals, businessId: 'b' } })).entries.length, 0);
  assert.equal((await page.load({ locals: staff })).entries.length, 1);
  assert.equal(sqlite.prepare('SELECT submitted_by_user_id FROM waste_logs').get().submitted_by_user_id, 'staff-a');
});
await check('specials delegated editing is tenant-local and a late save failure preserves all previous entries', async ({ load, locals, request, sqlite }) => {
  const page = load('src/routes/specials/+page.server.ts');
  const fields = { 'item-1': 'Soup', 'item-2': 'Fish', 'item-3': 'Rice', 'item-4': 'Dessert' };
  const staff = { ...locals, userId: 'staff-a', userRole: 'user', businessRole: 'staff', businessPermissionTemplate: 'staff', businessCapabilities: ['manage_specials'] };
  assert.equal((await page.actions.save_specials({ locals: staff, request: request(fields) })).success, true);
  const original = JSON.stringify(sqlite.prepare('SELECT * FROM daily_specials ORDER BY category').all());
  assert.ok((await page.load({ locals: staff })).specials.some(row => row.content === 'Soup'));
  assert.ok((await page.load({ locals: { ...locals, businessId: 'b' } })).specials.every(row => !row.content));
  sqlite.exec("CREATE TRIGGER fixture_special BEFORE INSERT ON daily_specials WHEN NEW.category='a:item-4' BEGIN SELECT RAISE(ABORT,'special rollback'); END");
  await assert.rejects(page.actions.save_specials({ locals: staff, request: request({ ...fields, 'item-1': 'Changed' }) }), /special rollback/);
  assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM daily_specials ORDER BY category').all()), original);
});
await check('ToDo removal rolls back assignments and existing completion history on a late delete failure', async ({ admin, locals, request, sqlite }) => {
  await admin.createTodo(request({ title: 'Task', assigned_to: 'staff-a' }), locals);
  const id = sqlite.prepare('SELECT id FROM todos').get().id;
  sqlite.exec("CREATE TRIGGER fixture_task_delete BEFORE DELETE ON todos BEGIN SELECT RAISE(ABORT,'task delete rollback'); END");
  await assert.rejects(admin.deleteTodo(request({ id }), locals), /task delete rollback/);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM todo_assignments').get().n, 1);
});

await check('vendor CRUD and reminders persist only in their workspace and missing edits are not reported saved', async ({ admin, load, locals, request, sqlite }) => {
  const vendors = load('src/lib/server/vendors.ts');
  assert.equal((await vendors.createVendor(request({ name: 'Supplier', website_url: 'example.com', phone: '2025550100' }), locals)).success, true);
  const [vendor] = await vendors.loadVendors(locals.DB, 'a');
  assert.equal(vendor.websiteUrl, 'https://example.com/');
  assert.equal((await vendors.loadVendors(locals.DB, 'b')).length, 0);
  assert.equal((await vendors.updateVendor(request({ id: vendor.id, name: 'Updated' }), { ...locals, businessId: 'b' })).status, 404);
  assert.equal((await vendors.updateVendor(request({ id: vendor.id, name: 'Updated' }), locals)).success, true);
  assert.equal((await vendors.deleteVendor(request({ id: vendor.id }), { ...locals, businessId: 'b' })).status, 404);
  assert.equal((await vendors.deleteVendor(request({ id: vendor.id }), locals)).success, true);
  await admin.createAdminReminder(request({ content: 'Original' }), locals);
  const id = sqlite.prepare('SELECT id FROM admin_reminders').get().id;
  assert.equal((await admin.updateAdminReminder(request({ id, content: 'Changed' }), { ...locals, businessId: 'b' })).status, 404);
  assert.equal((await admin.updateAdminReminder(request({ id, content: 'Changed' }), locals)).success, true);
  assert.equal((await admin.deleteAdminReminder(request({ id }), { ...locals, businessId: 'b' })).status, 404);
  assert.equal(sqlite.prepare('SELECT content FROM admin_reminders').get().content, 'Changed');
  await admin.deleteAdminReminder(request({ id }), locals);
});
await check('announcements keep current/history atomic and a cleanup failure cannot report a committed save as lost', async ({ load, locals, sqlite }) => {
  const announcements = load('src/lib/server/announcements.ts');
  sqlite.exec("CREATE TRIGGER fixture_announcement BEFORE INSERT ON announcement_history BEGIN SELECT RAISE(ABORT,'announcement rollback'); END");
  await assert.rejects(announcements.saveHomepageAnnouncement(locals.DB, 'a', 'owner-a', 'New message'), /announcement rollback/);
  assert.equal((await announcements.loadHomepageAnnouncement(locals.DB, 'a')).content, '');
  sqlite.exec('DROP TRIGGER fixture_announcement');
  sqlite.exec("CREATE TRIGGER fixture_cleanup BEFORE DELETE ON announcement_history BEGIN SELECT RAISE(ABORT,'maintenance unavailable'); END");
  sqlite.prepare("INSERT INTO announcement_history (id,business_id,content,created_at) VALUES ('old','a','old',1)").run();
  await announcements.saveHomepageAnnouncement(locals.DB, 'a', 'owner-a', 'Saved');
  assert.equal((await announcements.loadHomepageAnnouncement(locals.DB, 'a')).content, 'Saved');
  assert.equal((await announcements.loadHomepageAnnouncement(locals.DB, 'b')).content, '');
});

await check('concurrent list and checklist creation returns a duplicate result, not a unique-key 500', async ({ admin, locals, request, sqlite }) => {
  for (const [action, fields, table] of [
    ['createListSection', { domain: 'inventory', title: 'Concurrent (Stock)', first_item: 'Rice' }, 'list_sections'],
    ['createChecklistCategory', { title: 'Concurrent (Stock)' }, 'checklist_sections']
  ]) {
    const results = await Promise.all([admin[action](request(fields), locals), admin[action](request(fields), locals)]);
    assert.equal(results.filter(result => result.success).length, 1);
    assert.equal(results.filter(result => result.status === 400).length, 1);
    assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM ${table} WHERE business_id='a' AND slug='concurrent-stock'`).get().n, 1);
  }
});
await check('concurrent votes for the same idea add one vote and return one conflict', async ({ load, locals, insert, now, sqlite }) => {
  insert('whiteboard_posts', { id: 'vote-a', business_id: 'a', content: 'Idea', votes: 0, created_by: 'owner-a', created_at: now, updated_at: now });
  insert('whiteboard_review', { post_id: 'vote-a', business_id: 'a', status: 'approved', reviewed_at: now });
  const api = load('src/routes/api/whiteboard/+server.ts');
  const vote = () => api.POST({ locals, request: new Request('https://criminiops.com/api/whiteboard', { method: 'POST', body: JSON.stringify({ action: 'upvote', id: 'vote-a' }) }) });
  const responses = await Promise.all([vote(), vote()]);
  assert.deepEqual(responses.map(row => row.status).sort(), [200, 409]);
  assert.equal(sqlite.prepare("SELECT votes FROM whiteboard_posts WHERE id='vote-a'").get().votes, 1);
});

await check('large category cleanup uses bounded bulk SQL/R2 calls and preserves shared and foreign files', async ({ admin, locals, request, insert, now, objects, test }) => {
  for (let index = 0; index < 120; index++) {
    const key = `businesses/a/documents/bulk-${index}.pdf`; objects.add(key);
    insert('documents', { id: 'bulk-' + index, business_id: 'a', slug: 'bulk-' + index, title: 'Bulk', section: 'Docs', category: 'Kitchen', file_url: '/api/documents/media/' + key, created_at: now, updated_at: now });
  }
  insert('documents', { id: 'shared-file', business_id: 'a', slug: 'shared-file', title: 'Shared', section: 'Docs', category: 'Other', file_url: '/api/documents/media/businesses/a/documents/bulk-0.pdf', created_at: now, updated_at: now });
  const remove = locals.MEDIA_BUCKET.delete;
  let calls = 0;
  locals.MEDIA_BUCKET.delete = async keys => { calls++; assert.ok(Array.isArray(keys)); assert.equal(keys.length, 120); await remove(keys); };
  const before = test.queryCount;
  assert.equal((await admin.deleteCreatorCategory(request({ editor_type: 'document', category: 'Kitchen', delete_with_content: 1 }), locals)).success, true);
  assert.ok(test.queryCount - before <= 10, 'Bulk deletion must not query once per file');
  assert.equal(calls, 1);
  assert.deepEqual(objects, new Set(['businesses/a/documents/bulk-0.pdf', 'businesses/b/documents/handbook.pdf']));
});

await check('operational list and checklist headings use saved titles rather than rebuilding old URLs', async ({ admin, load, locals, request }) => {
  await admin.updateListSection(request({ section_id: 'list-a', title: 'Daily Prep (Kitchen)' }), locals);
  const list = load('src/lib/server/preplist.ts').createListPage('preplists', 'daily', 'Old URL title', {});
  assert.equal((await list.load({ locals })).title, 'Daily Prep (Kitchen)');
  await admin.updateChecklistCategory(request({ base_slug: 'closing', next_slug: 'closing', title: 'Closing (Kitchen)' }), locals);
  const checklist = load('src/lib/server/checklists.ts').createChecklistPage('closing', 'Old URL title', { defaults: [] });
  assert.equal((await checklist.load({ locals })).title, 'Closing (Kitchen) Checklist');
});

if (failures.length) throw Error(`${failures.length} content regressions failed: ${failures.join('; ')}`);
