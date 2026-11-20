import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import * as serverRuntime from 'svelte/internal/server';
import { createTestD1, loadServerModules, formRequest, serializeTestCookie } from './helpers/test-d1.mjs';

function component(source, dependencies = {}) {
  const exports = {};
  const output = ts.transpileModule(compile(source, { generate: 'server' }).js.code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  new Function('require', 'exports', output)(name => {
    if (name === 'svelte/internal/server') return serverRuntime;
    assert.ok(name in dependencies, 'Unexpected announcement component dependency: ' + name);
    return dependencies[name];
  }, exports);
  return exports;
}

const empty = { __esModule: true, default() {} };
const dependencies = {
  '#lib/components/ui/Layout.svelte': component('<slot />'),
  '#lib/components/ui/PageHeader.svelte': empty,
  '#lib/components/ui/ManagerSectionNav.svelte': empty,
  '#lib/components/ui/GuidedSpotlightTour.svelte': empty,
  '$app/forms': { applyAction() {}, enhance() {} },
  '$app/navigation': { invalidateAll() {}, goto() {} },
  '#lib/client/toasts.ts': { pushToast() {} }
};
const screen = component(readFileSync('src/routes/admin/announcements/+page.svelte', 'utf8'), dependencies);
const dashboard = component(readFileSync('src/routes/admin/+page.svelte', 'utf8'), dependencies);
const test = createTestD1();
const load = loadServerModules();
const route = load('src/routes/admin/announcements/+page.server.ts');
const admin = load('src/routes/admin/+page.server.ts');
const features = load('src/lib/features/appFeatures.ts');
const navigation = load('src/lib/navigation/managerNavigation.ts');
const roles = load('src/lib/auth/roles.ts');
const capabilities = load('src/lib/auth/routeCapabilities.ts');
const now = Math.floor(Date.now() / 1000);
const featureModes = Object.fromEntries(Object.keys(features.defaultAppFeatureModes).map(key => [key, 'off']));
featureModes.announcements = 'all';
featureModes.employee_spotlight = 'all';
const locals = businessId => ({ DB: test.db, userId: 'owner-' + businessId, userRole: 'admin', businessId,
  businessRole: 'owner', businessPermissionTemplate: 'owner', featureModes });
const url = new URL('https://criminiops.com/admin/announcements');
const page = businessId => route.load({ locals: locals(businessId), url });
const submit = (actor, name, fields) => route.actions[name]({ locals: actor,
  request: formRequest(fields, '/admin/announcements?/' + name) });
function insert(table, row) {
  const keys = Object.keys(row);
  test.sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(row));
}
try {
  for (const id of ['announcement-a', 'announcement-b']) {
    insert('businesses', { id, name: id, slug: id, created_at: now, updated_at: now });
    insert('users', { id: 'owner-' + id, email: id + '@example.invalid', email_normalized: id + '@example.invalid', created_at: now, updated_at: now });
    insert('business_users', { business_id: id, user_id: 'owner-' + id, role: 'owner', permission_template: 'owner', created_at: now, updated_at: now });
    insert('business_trials', { business_id: id, owner_user_id: 'owner-' + id, status: 'active', trial_started_at: now, trial_ends_at: now, created_at: now, updated_at: now });
  }
  assert.equal((await page('announcement-a')).history.length, 0);
  const long = 'Team update\n' + 'Long announcement text. '.repeat(60) + '<script>alert("no")</script>';
  for (const id of ['announcement-a', 'announcement-b']) {
    assert.equal((await submit(locals(id), 'save_announcement', { content: id === 'announcement-a' ? long : 'Other restaurant private update' })).success, true);
  }
  assert.equal((await page('announcement-a')).announcement.content, long);
  assert.equal((await page('announcement-b')).announcement.content, 'Other restaurant private update');
  assert.equal((await page('announcement-a')).history.length, 1);
  await submit(locals('announcement-a'), 'save_announcement', { content: long });
  assert.equal((await page('announcement-a')).history.length, 1, 'Unchanged publish retains existing no-duplicate history behavior');
  const announcementHtml = render(screen.default, { props: { data: await page('announcement-a') } }).body;
  assert.match(announcementHtml, /action="\?\/save_announcement"/);
  assert.match(announcementHtml, /maxlength="2000"/);
  assert.match(announcementHtml, /&lt;script>alert/);
  assert.doesNotMatch(announcementHtml, /<script>alert|Other restaurant private update/);
  assert.equal((announcementHtml.match(/class="history-entry[^\"]*"/g) ?? []).length, 1);
  const queries = [];
  const dashboardDB = { ...test.db, prepare(sql) { queries.push(sql); return test.db.prepare(sql); } };
  const summary = await admin.load({ locals: { ...locals('announcement-a'), DB: dashboardDB }, url: new URL('https://criminiops.com/admin') });
  assert.equal(summary.announcement.content.length, 160);
  assert.ok(summary.announcement.content.endsWith('...'));
  assert.equal(summary.announcement.updatedAt, (await page('announcement-a')).announcement.updatedAt);
  assert.ok(!('announcementHistory' in summary));
  assert.ok(!queries.some(sql => /announcement_history/.test(sql)), 'Dashboard must not query full history');
  const dashboardHtml = render(dashboard.default, { props: { data: summary } }).body;
  assert.equal((dashboardHtml.match(/data-guide="admin-announcements"/g) ?? []).length, 1);
  assert.match(dashboardHtml, /href="\/admin\/announcements"/);
  assert.doesNotMatch(dashboardHtml, /action="\?\/save_announcement"|action="\?\/delete_announcement_history"/);
  assert.match(dashboardHtml, /action="\?\/save_employee_spotlight"/, 'Spotlight editing remains on the manager dashboard');
  assert.ok(!dashboardHtml.includes(long));
  const withoutAnnouncements = await admin.load({ locals: { ...locals('announcement-a'),
    featureModes: { ...featureModes, announcements: 'off' } }, url: new URL('https://criminiops.com/admin') });
  const spotlightHtml = render(dashboard.default, { props: { data: withoutAnnouncements } }).body;
  assert.doesNotMatch(spotlightHtml, /data-guide="admin-announcements"/);
  assert.match(spotlightHtml, /action="\?\/save_employee_spotlight"/, 'Moving the announcement editor must not hide the independent Spotlight editor');
  const entryB = (await page('announcement-b')).history[0];
  await submit(locals('announcement-a'), 'delete_announcement_history', { history_id: entryB.id });
  assert.equal((await page('announcement-b')).history.length, 1, 'A foreign history ID cannot delete another restaurant entry');
  const entryA = (await page('announcement-a')).history[0];
  await submit(locals('announcement-a'), 'delete_announcement_history', { history_id: entryA.id });
  assert.equal((await page('announcement-a')).history.length, 0);
  assert.equal((await page('announcement-a')).announcement.content, long, 'Deleting history does not clear the live announcement');
  const delegated = { ...locals('announcement-a'), businessRole: 'employee', businessPermissionTemplate: 'employee', businessCapabilities: ['manage_announcements'] };
  delegated.userRole = roles.effectiveAppRoleFromBusinessRole(delegated.businessRole, delegated.businessPermissionTemplate, delegated.businessCapabilities);
  assert.equal((await route.load({ locals: delegated, url })).announcement.content, long);
  assert.equal((await submit(delegated, 'save_announcement', { content: 'Delegated editor update' })).success, true);
  const nav = navigation.managerNavigationGroups.flatMap(group => group.items).find(item => item.href === url.pathname);
  assert.ok(nav);
  assert.equal(capabilities.resolveBusinessCapabilityForPath(url.pathname), 'manage_announcements');
  assert.equal(features.resolveFeatureKeyForPath(url.pathname), 'announcements');
  assert.equal(navigation.canViewManagerNavigationItem(nav, { businessRole: 'employee', businessCapabilities: ['manage_announcements'] }, featureModes), true);
  assert.equal(navigation.canViewManagerNavigationItem(nav, { businessRole: 'employee', businessCapabilities: [] }, featureModes), false);
  assert.equal(navigation.canViewManagerNavigationItem(nav, { businessRole: 'owner' }, { ...featureModes, announcements: 'off' }), false);
  for (const denied of [
    { ...locals('announcement-a'), userId: undefined },
    { ...locals('announcement-a'), businessRole: 'employee', businessPermissionTemplate: 'employee', businessCapabilities: [] },
    { ...locals('announcement-a'), businessRole: 'manager', businessCapabilities: ['admin_access'] },
    { ...locals('announcement-a'), featureModes: { ...featureModes, announcements: 'off' } }
  ]) {
    await assert.rejects(route.load({ locals: denied, url }), error => [401, 403].includes(error.status));
    await assert.rejects(async () => submit(denied, 'save_announcement', { content: 'Denied change' }), error => [401, 403].includes(error.status));
    await assert.rejects(async () => submit(denied, 'delete_announcement_history', { history_id: (test.sqlite.prepare('SELECT id FROM announcement_history WHERE business_id=?').get('announcement-a')).id }), error => [401, 403].includes(error.status));
  }
  const beforeMissingTenant = test.queryCount;
  await assert.rejects(route.load({ locals: { ...locals('announcement-a'), businessId: undefined }, url }));
  assert.equal(test.queryCount, beforeMissingTenant, 'Missing tenant fails before any data access');
  assert.equal((await page('announcement-a')).announcement.content, 'Delegated editor update');

  // Exercise the real request guard, not only action calls with trusted locals.
  const modes = load('src/lib/server/appFeatures.ts');
  const workspace = load('src/lib/workspaceIntent.ts');
  await modes.saveAppFeatureModes(test.db, featureModes, null, 'announcement-a');
  await modes.saveAppFeatureModes(test.db, featureModes, null, 'announcement-b');
  const token = 'isolated-announcement-session';
  insert('sessions', { id: 'announcement-session', user_id: 'owner-announcement-a',
    session_token_hash: await load('src/lib/server/auth.ts').hashSessionToken(token),
    created_at: now, last_seen_at: now, expires_at: now + 3600 });
  insert('business_users', { business_id: 'announcement-b', user_id: 'owner-announcement-a', role: 'staff', permission_template: 'staff', created_at: now, updated_at: now });
  const hooks = loadServerModules({ 'cloudflare:workers': { env: { DB: test.db }, waitUntil() {} },
    '#lib/server/observability.ts': { logOperationalEvent() {}, logOperationalError() {} },
    '#lib/server/platformDiagnostics.ts': { async recordRequestDiagnostic() {} },
    '#lib/server/operationalEvents.ts': { async processOperationalEvents() {} } })('src/hooks.server.ts');
  async function guarded({ method = 'GET', business = 'announcement-a', expected = business, session = token } = {}) {
    const cookies = new Map([['__Host-kitchen_session', session], ['kitchen_active_business', business]]);
    const request = new Request(url + (method === 'POST' ? '?/save_announcement' : ''), {
      method, headers: { origin: url.origin, [workspace.WORKSPACE_HEADER]: expected },
      body: method === 'POST' ? new URLSearchParams({ content: 'Guarded update' }) : undefined
    });
    let resolved = false;
    const event = { url: new URL(request.url), request, locals: {}, cookies: {
      serialize: serializeTestCookie, get: key => cookies.get(key), set: (key, value) => cookies.set(key, value), delete: key => cookies.delete(key)
    } };
    const response = await hooks.handle({ event, resolve: async () => {
      resolved = true;
      if (method === 'POST') await route.actions.save_announcement(event);
      else await route.load(event);
      return new Response('Allowed');
    } });
    return { response, resolved };
  }
  for (const method of ['GET', 'POST']) {
    assert.equal((await guarded({ method })).resolved, true);
    assert.equal((await guarded({ method, session: '' })).resolved, false, 'Anonymous requests cannot reach the workspace');
    assert.equal((await guarded({ method, business: 'announcement-b' })).resolved, false, 'The same identity has no announcement authority in its second restaurant');
    await modes.saveAppFeatureModes(test.db, { ...featureModes, announcements: 'off' }, null, 'announcement-a');
    assert.equal((await guarded({ method })).resolved, false, 'Feature Off blocks direct reads and writes at the actual hook');
    await modes.saveAppFeatureModes(test.db, featureModes, null, 'announcement-a');
  }
  const foreignBefore = (await page('announcement-b')).announcement.content;
  const stale = await guarded({ method: 'POST', business: 'announcement-b', expected: 'announcement-a' });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.resolved, false);
  assert.equal((await page('announcement-b')).announcement.content, foreignBefore);
  assert.equal((await submit(locals('announcement-a'), 'delete_announcement_history', {})).status, 400);
  const published = (await page('announcement-a')).announcement.content;
  const brokenDB = { ...test.db, async batch() { throw Error('Isolated database failure'); } };
  await assert.rejects(submit({ ...locals('announcement-a'), DB: brokenDB }, 'save_announcement', { content: 'Must not appear' }), /Isolated database failure/);
  assert.equal((await page('announcement-a')).announcement.content, published, 'A failed publish must not replace live content');
  await submit(locals('announcement-a'), 'save_announcement', { content: 'x'.repeat(2000) });
  assert.equal((await page('announcement-a')).announcement.content.length, 2000);
  await submit(locals('announcement-a'), 'save_announcement', { content: '' });
  assert.equal((await page('announcement-a')).announcement.content, '', 'The existing clear-announcement behavior is preserved');
  for (let i = 0; i < 45; i++) insert('announcement_history', { id: 'bounded-' + i, business_id: 'announcement-a', content: 'History ' + i, created_at: now });
  insert('announcement_history', { id: 'expired-announcement', business_id: 'announcement-a', content: 'Expired', created_at: now - 300 * 86400 });
  await submit(locals('announcement-a'), 'save_announcement', { content: 'Retention check' });
  assert.equal((await page('announcement-a')).history.length, 40, 'History loads remain bounded');
  assert.equal(test.sqlite.prepare('SELECT COUNT(*) n FROM announcement_history WHERE id=?').get('expired-announcement').n, 0);
  assert.equal((await page('announcement-b')).history.length, 1, 'Cleanup and clearing leave the other restaurant unchanged');
  const publicCopy = readFileSync('src/routes/how-it-works/+page.svelte', 'utf8');
  assert.doesNotMatch(publicCopy, /packet items before full app use|uses the app once approved/);
  assert.match(publicCopy, /does not block app access/);
  assert.deepEqual(test.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  console.log('PASS announcements: compact dashboard, independent Spotlight, dedicated editing/history, real-schema save/failure/retention, escaped text, actual hook/feature/capability denial, multi-restaurant and stale-tab isolation, nonblocking HR copy');
} finally { test.close(); }
