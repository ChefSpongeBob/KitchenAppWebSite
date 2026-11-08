import assert from 'node:assert/strict';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';

const test = createTestD1();
const { sqlite, db } = test;
const now = Math.floor(Date.now() / 1000);
const logs = { logOperationalEvent() {}, logOperationalError() {} };
const load = loadServerModules({ '#lib/server/observability.ts': logs });
function insert(table, row) {
  const fields = Object.keys(row);
  sqlite.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...Object.values(row));
}
const definitions = load('src/lib/features/appFeatures.ts');
const features = load('src/lib/server/appFeatures.ts');
const attachments = load('src/lib/server/itemAttachments.ts');
const admin = load('src/lib/server/admin.ts');
const creator = load('src/routes/admin/creator/+page.server.ts');
const media = load('src/routes/api/documents/media/[...key]/+server.ts');
const bucketReads = [];
const bucket = { async get(key) { bucketReads.push(key); return { body: 'file', httpMetadata: { contentType: 'application/pdf' }, httpEtag: 'test' }; } };
const locals = async (business = 'a', role = 'owner') => ({ DB: db, env: { DB: db, DOC_MEDIA: bucket }, userId: `owner-${business}`, userRole: 'admin',
  businessId: business, businessRole: role, businessPermissionTemplate: role, featureModes: await features.loadAppFeatureModes(db, business) });
async function setModes(modes, business = 'a') { await features.saveAppFeatureModes(db, modes, null, business); }
async function forbidden(action) { await assert.rejects(action, error => error.status === 403); }
async function getMedia(id, business = 'a') {
  return media.GET({ params: { key: `businesses/${business}/documents/${id}.pdf` }, locals: await locals(business), request: new Request('https://criminiops.com/api/documents/media/file') });
}
try {
  for (const business of ['a', 'b']) {
    insert('businesses', { id: business, name: business, slug: business, created_at: now, updated_at: now });
    insert('users', { id: `owner-${business}`, email: `${business}@example.invalid`, email_normalized: `${business}@example.invalid`, created_at: now, updated_at: now });
    insert('business_users', { business_id: business, user_id: `owner-${business}`, role: 'owner', permission_template: 'owner', created_at: now, updated_at: now });
    insert('business_trials', { business_id: business, owner_user_id: `owner-${business}`, status: 'active', trial_started_at: now, trial_ends_at: now, created_at: now, updated_at: now });
    insert('recipes', { id: business === 'a' ? 1 : 2, business_id: business, title: `Recipe ${business}`, category: 'Kitchen', ingredients: 'recipe secret', instructions: 'Recipe steps' });
    insert('list_sections', { id: `list-${business}`, business_id: business, domain: 'preplists', slug: 'daily', title: 'Daily', created_at: now, updated_at: now });
    insert('list_items', { id: `item-${business}`, business_id: business, section_id: `list-${business}`, content: 'Rice', created_at: now, updated_at: now });
    for (const kind of ['recipe', 'document', 'menu']) {
      if (kind !== 'recipe') insert('documents', { id: `${kind}-${business}`, business_id: business, slug: kind, title: `${kind} ${business}`, section: kind === 'menu' ? 'Menu' : 'Docs', category: kind === 'menu' ? 'Menu' : 'Kitchen',
        content: `${kind} secret`, file_url: `/api/documents/media/businesses/${business}/documents/${kind}.pdf`, is_active: 1, created_at: now, updated_at: now });
      insert('item_attachments', { id: `${kind}-${business}`, business_id: business, source_type: 'list_item', source_item_id: `item-${business}`, target_type: kind === 'recipe' ? 'recipe' : 'document',
        target_id: kind === 'recipe' ? (business === 'a' ? '1' : '2') : `${kind}-${business}`, created_at: now });
    }
  }
  assert.equal((await attachments.loadItemAttachmentsForItems(db, 'a', 'list_item', ['item-a'])).get('item-a').length, 3);
  for (const [feature, kind] of [['recipes', 'recipe'], ['documents', 'document'], ['menus', 'menu']]) {
    await setModes({ ...definitions.defaultAppFeatureModes, [feature]: 'off' });
    const rows = await attachments.loadItemAttachmentsForItems(db, 'a', 'list_item', ['item-a', 'item-b']);
    assert.equal(rows.get('item-a').length, 2);
    assert.equal(rows.get('item-a').some(row => row.id === `${kind}-a`), false);
    const data = await creator.load({ locals: await locals(), url: new URL('https://criminiops.com/admin/creator') });
    assert.equal(JSON.stringify(data).includes(`${kind} secret`), false);
    assert.equal(data.availableEditors.includes(kind), false);
    if (kind === 'recipe') assert.equal(data.recipes.length, 0);
    const categoryFields = { editor_type: kind === 'recipe' ? 'recipe' : 'document', category: kind === 'menu' ? 'Menu' : 'Kitchen', previous_category: kind === 'menu' ? 'Menu' : 'Kitchen', next_category: 'Other' };
    for (const action of [admin.createCreatorCategory, admin.updateCreatorCategory, admin.deleteCreatorCategory]) {
      await forbidden(async () => action(formRequest(categoryFields), await locals()));
    }
    for (const attach of [attachments.createItemAttachment, attachments.attachTargetToItem]) {
      await forbidden(async () => attach(formRequest({ source_type: 'list_item', source_item_id: 'item-a', target_type: kind === 'recipe' ? 'recipe' : 'document', target_id: kind === 'recipe' ? '1' : `${kind}-a` }), await locals()));
    }
    await forbidden(async () => attachments.deleteItemAttachment(formRequest({ id: `${kind}-a` }), await locals()));
    if (kind !== 'recipe') {
      const reads = bucketReads.length;
      assert.equal((await getMedia(kind)).status, 403);
      assert.equal(bucketReads.length, reads, 'Disabled files must be rejected before R2 is read');
      assert.equal((await getMedia(kind, 'b')).status, 200);
      const fields = { id: `${kind}-a`, slug: kind, title: 'Changed', section: kind === 'menu' ? 'Menu' : 'Docs', category: kind === 'menu' ? 'Menu' : 'Kitchen', file_url: '/file.pdf' };
      for (const action of [admin.createDocument, admin.updateDocument, admin.deleteDocument]) {
        await forbidden(async () => action(formRequest(fields), await locals()));
      }
      // Changing submitted classification must not bypass the original record's disabled feature.
      await forbidden(async () => admin.updateDocument(formRequest({ ...fields, slug: 'other', section: 'Docs', category: 'Kitchen' }), await locals()));
    }
    assert.equal((await attachments.loadItemAttachmentsForItems(db, 'b', 'list_item', ['item-b'])).get('item-b').length, 3);
  }
  await setModes({ ...definitions.defaultAppFeatureModes, lists: 'off' });
  assert.equal((await attachments.loadItemAttachmentsForItems(db, 'a', 'list_item', ['item-a'])).size, 0);
  for (const name of ['addListItem', 'updateListItem', 'deleteListItem', 'addChecklistItem', 'updateChecklistItem', 'deleteChecklistItem', 'createListSection', 'updateListSection', 'deleteListSection', 'createChecklistCategory', 'updateChecklistCategory', 'deleteChecklistCategory']) {
    await forbidden(async () => admin[name](formRequest({}), await locals()));
  }
  for (const [feature, names] of Object.entries({ recipes: ['createRecipe', 'updateRecipe', 'deleteRecipe'], todo: ['createTodo', 'deleteTodo'], whiteboard: ['approveWhiteboard', 'rejectWhiteboard', 'deleteWhiteboard'],
    announcements: ['saveAnnouncement', 'deleteAnnouncementHistory'], employee_spotlight: ['saveEmployeeSpotlight'], scheduling: ['toggleScheduleDepartmentApproval'] })) {
    await setModes({ ...definitions.defaultAppFeatureModes, [feature]: 'off' });
    for (const name of names) await forbidden(async () => admin[name](formRequest({}), await locals()));
  }
  await setModes(Object.fromEntries(Object.keys(definitions.defaultAppFeatureModes).map(key => [key, 'off'])));
  for (const role of ['owner', 'admin', 'manager', 'staff', 'hr', 'external', 'consultant']) {
    for (const feature of definitions.appFeatureDefinitions) assert.equal(definitions.canRoleAccessFeature('off', role, feature.key, role), false);
  }
  await forbidden(async () => creator.load({ locals: await locals(), url: new URL('https://criminiops.com/admin/creator?editor=category') }));
  assert.deepEqual(await load('src/lib/server/temperatureMonitoring.ts').processTemperatureStaleAlerts(db, 'a'), { processed: 0 });
  const gateway = await load('src/lib/server/iotIngest.ts').provisionIoTDevice(db, { businessId: 'a', deviceType: 'sensor_gateway', externalDeviceId: 'fixture-gateway', displayName: 'Fixture' });
  const upload = await load('src/routes/api/temps/+server.ts').POST({ locals: await locals(), url: new URL('https://criminiops.com/api/temps'), request: new Request('https://criminiops.com/api/temps', {
    method: 'POST', headers: { 'x-device-id': 'fixture-gateway', 'x-device-key': gateway.deviceKey, 'content-type': 'application/json' }, body: '{"gateway_status":true}'
  }) });
  assert.equal(upload.status, 403, 'Even an authenticated gateway cannot upload when Temps is Off');
  assert.equal((await load('src/routes/reports/+page.server.ts').load({ locals: await locals() })).canViewTodoLog, true);
  console.log('PASS feature Off denies Creator actions, hidden payloads, existing attachments, direct files, sensor processing and related report routing without changing another tenant');

  // Use the actual request guard and session/membership SQL, not a mocked permission decision.
  const token = 'isolated-feature-policy-session';
  insert('sessions', { id: 'session-a', user_id: 'owner-a', session_token_hash: await load('src/lib/server/auth.ts').hashSessionToken(token), created_at: now, last_seen_at: now, expires_at: now + 3600 });
  const runtimeEnv = { DB: db };
  const hookLoad = loadServerModules({ 'cloudflare:workers': { env: runtimeEnv, waitUntil() {} },
    '#lib/server/observability.ts': logs, '#lib/server/platformDiagnostics.ts': { async recordRequestDiagnostic() {} },
    '#lib/server/operationalEvents.ts': { async processOperationalEvents() {} } });
  const { handle } = hookLoad('src/hooks.server.ts');
  const probe = async (path, options = {}) => {
    let resolved = false;
    const values = new Map([['__Host-kitchen_session', token], ['kitchen_active_business', options.business ?? 'a']]);
    if (options.anonymous) values.delete('__Host-kitchen_session');
    const url = new URL(path, 'https://criminiops.com');
    const event = { url, request: new Request(url, { method: options.method ?? 'GET', headers: { origin: url.origin } }), locals: {}, cookies: {
      get: key => values.get(key), set: (key, value) => values.set(key, value), delete: key => values.delete(key)
    } };
    try { await handle({ event, resolve: async () => { resolved = true; return new Response('Resolved'); } }); }
    catch (error) { assert.ok(error.status >= 300 && error.status < 400); }
    return { resolved, event };
  };
  const gatedPaths = ['/schedule', '/my-schedule', '/admin/schedule', '/admin/schedule/settings', '/todo', '/todo/log', '/whiteboard', '/api/whiteboard', '/temper', '/api/temps', '/admin/sensors',
    '/lists', '/lists/preplists/daily', '/recipes', '/docs', '/menu', '/specials', '/vendors', '/admin/vendors', '/conversions', '/tools/food-cost', '/tools/safety-healthcode', '/tools/waste',
    '/reports/lists', '/reports/lists.csv', '/reports/schedule', '/reports/schedule.csv', '/reports/requests', '/reports/requests.csv', '/reports/temperature', '/reports/temperature.csv', '/reports/waste', '/reports/waste.csv'];
  for (const path of gatedPaths) {
    assert.equal((await probe(path)).resolved, false, `${path} must be denied when Off`);
    // Gateway POST authenticates in its own handler, exercised above, rather than the browser guard.
    if (path !== '/api/temps') assert.equal((await probe(path, { method: 'POST' })).resolved, false, `${path} POST must also be denied`);
  }
  for (const path of ['/app', '/admin', '/admin/feature-matrix', '/admin/onboarding', '/settings', '/reports/onboarding']) assert.equal((await probe(path)).resolved, true, path);
  await setModes(definitions.defaultAppFeatureModes);
  for (const path of gatedPaths) assert.equal((await probe(path)).resolved, true, `${path} should be restored when enabled`);
  assert.equal((await probe('/admin', { anonymous: true })).resolved, false);
  assert.equal((await probe('/app', { business: 'b' })).event.locals.businessId, 'a', 'A tampered cookie must not select an unauthorized tenant');
  insert('business_users', { business_id: 'b', user_id: 'owner-a', role: 'staff', permission_template: 'staff', created_at: now, updated_at: now });
  assert.equal((await probe('/app', { business: 'b' })).event.locals.businessId, 'b');
  assert.equal((await probe('/admin', { business: 'b' })).resolved, false, 'A shared identity cannot carry owner permissions into its staff-only tenant');
  sqlite.exec("UPDATE business_users SET is_active=0 WHERE business_id='b' AND user_id='owner-a'");
  assert.equal((await probe('/app', { business: 'b' })).event.locals.businessId, 'a');
  runtimeEnv.DB = { ...db, prepare(sql) {
    const statement = db.prepare(sql);
    if (sql.includes('FROM employee_role_permissions')) statement.all = async () => { throw Error('Permission database unavailable'); };
    return statement;
  } };
  assert.equal((await probe('/admin')).resolved, false, 'Failure reading explicit revocations must not restore role-default permissions');
  runtimeEnv.DB = db;
  sqlite.exec("UPDATE business_trials SET status='pending_payment' WHERE business_id='a'");
  assert.equal((await probe('/app')).resolved, false);
  assert.equal((await probe('/billing')).resolved, true);
  sqlite.exec("UPDATE business_trials SET status='active' WHERE business_id='a'");
  sqlite.exec("UPDATE sessions SET revoked_at=1 WHERE id='session-a'");
  assert.equal((await probe('/app')).resolved, false);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  console.log(`PASS actual session guard: ${gatedPaths.length} feature/report routes block GET and POST when Off, reopen when enabled, preserve setup/HR, and reject revoked or anonymous access`);
} finally { test.close(); }
