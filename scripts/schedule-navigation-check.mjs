import assert from 'node:assert/strict';
import { loadServerModules } from './helpers/test-d1.mjs';

const { createScheduleNavigationGuard } = loadServerModules()('src/lib/client/scheduleNavigation.ts');
function fixture() {
  const state = { dirty: true, inFlight: null, submitting: false };
  const actions = [];
  const options = { state: () => state, async save() { actions.push('save'); state.dirty = false; return true; },
    async navigate(url) { actions.push(url.pathname + url.search); }, history(delta) { actions.push('history:' + delta); },
    notify() { actions.push('notice'); } };
  const navigation = { type: 'link', willUnload: false, to: { url: new URL('https://criminiops.com/admin/schedule?week=2026-11-09') },
    cancel() { actions.push('cancel'); } };
  return { state, actions, options, navigation };
}
{
  const { state, actions, options, navigation } = fixture();
  await createScheduleNavigationGuard(options)(navigation);
  assert.deepEqual(actions, ['cancel','save','/admin/schedule?week=2026-11-09']); assert.equal(state.dirty, false);
}
{
  const { state, actions, options, navigation } = fixture(); let finish;
  state.inFlight = new Promise(resolve => { finish = resolve; });
  const guard = createScheduleNavigationGuard(options);
  const work = guard(navigation); guard(navigation);
  assert.deepEqual(actions, ['cancel','cancel']);
  finish(true); state.inFlight = null;
  await work;
  assert.equal(actions.filter(action => action === 'save').length, 1);
  assert.equal(actions.filter(action => action.startsWith('/admin')).length, 1);
}
{
  const { state, actions, options, navigation } = fixture(); options.save = async () => false;
  await createScheduleNavigationGuard(options)(navigation);
  assert.deepEqual(actions, ['cancel','notice']); assert.equal(state.dirty, true);
}
{
  const { actions, options, navigation } = fixture();
  navigation.type = 'popstate'; navigation.delta = -1;
  await createScheduleNavigationGuard(options)(navigation);
  assert.deepEqual(actions, ['cancel','save','history:-1']);
}
{
  const { actions, options, navigation } = fixture(); navigation.willUnload = true;
  await createScheduleNavigationGuard(options)(navigation);
  assert.deepEqual(actions, ['cancel'], 'Use native unload confirmation, not an unreliable fire-and-forget save');
}
{
  const { state, actions, options, navigation } = fixture(); state.submitting = true;
  await createScheduleNavigationGuard(options)(navigation);
  assert.deepEqual(actions, ['cancel','notice']);
  actions.length = 0; navigation.to.url = new URL('https://criminiops.com/login');
  await createScheduleNavigationGuard(options)(navigation);
  assert.deepEqual(actions, [], 'Expired-session redirects must not trap the user in the builder');
}
{
  const { state, actions, options, navigation } = fixture(); state.dirty = false;
  await createScheduleNavigationGuard(options)(navigation);
  assert.deepEqual(actions, []);
}
console.log('PASS schedule navigation: save before week/route change, pending edits, duplicate clicks, failed save, Back, unload warning, publishing and expired-session escape');
