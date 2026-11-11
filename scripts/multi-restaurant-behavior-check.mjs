import assert from 'node:assert/strict';
import { createTestD1, loadServerModules, formRequest } from './helpers/test-d1.mjs';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const now = Math.floor(Date.now() / 1000);
const envValues = { APP_BASE_URL: 'https://criminiops.com', PASSWORD_PEPPER: 'isolated-multi-restaurant-pepper-only-value',
  SENSITIVE_DATA_KEY: btoa('isolated-multi-restaurant-key-only-value'), SENSITIVE_DATA_KEY_VERSION: 'fixture' };
function fixture(inviteOverrides = {}) {
  const test = createTestD1(); const { sqlite, db } = test;
  function insert(table, row) {
    const columns = Object.keys(row);
    sqlite.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?')})`).run(...Object.values(row));
  }
  for (const id of ['shared', 'other']) insert('users', { id, email: id + '@example.invalid', email_normalized: id + '@example.invalid',
    display_name: id, role: 'admin', password_hash: 'unchanged-fixture-hash', created_at: now, updated_at: now });
  for (const id of ['a', 'b', 'c']) {
    insert('businesses', { id, name: 'Restaurant ' + id, slug: id, status: 'active', created_at: now, updated_at: now });
    insert('business_trials', { business_id: id, owner_user_id: 'other', status: 'active', trial_started_at: now, trial_ends_at: now, created_at: now, updated_at: now });
    insert('schedule_departments', { id: 'dept-' + id, business_id: id, name: 'Kitchen', created_at: now, updated_at: now });
  }
  insert('business_users', { business_id: 'a', user_id: 'shared', role: 'owner', permission_template: 'owner', created_at: now, updated_at: now });
  insert('business_users', { business_id: 'b', user_id: 'other', role: 'owner', permission_template: 'owner', created_at: now, updated_at: now });
  insert('employee_profiles', { business_id: 'a', user_id: 'shared', real_name: 'Existing A identity', phone: '2025550101', emergency_contact_name: 'Private A contact', updated_at: now });
  insert('user_preferences', { user_id: 'shared', email_updates: 1, sms_updates: 0, dark_mode: 1, updated_at: now });
  insert('employee_sensitive_record_vault', { id: 'private-a', business_id: 'a', user_id: 'shared', record_scope: 'tax', record_type: 'withholding',
    status: 'accepted', encrypted_payload: 'PRIVATE_A_RECORD', created_at: now, updated_at: now });
  insert('sessions', { id: 'shared-session', user_id: 'shared', session_token_hash: 'fixture-session-hash', created_at: now, last_seen_at: now, expires_at: now + 3600 });
  insert('business_invites', { id: 'invite-b', business_id: 'b', email: 'shared@example.invalid', email_normalized: 'shared@example.invalid', invite_code: 'EXISTING-INVITE',
    role: 'staff', permission_template: 'staff', employment_type: 'employee', onboarding_required: 1, created_at: now, expires_at: now + 3600,
    department: 'Kitchen', primary_schedule_department: 'Kitchen', schedule_departments_json: '["Kitchen"]', ...inviteOverrides });
  const load = loadServerModules({ '#lib/server/observability.ts': { logOperationalError() {}, logOperationalEvent() {} } });
  const env = { ...envValues, DB: db };
  const locals = { DB: db, env, userId: 'shared', sessionId: 'shared-session', businessId: 'a', businessRole: 'owner' };
  const cookies = new Map([['kitchen_active_business', 'a']]);
  const fields = { existing_account: '1', invite_code: 'EXISTING-INVITE', real_name: 'New B identity', birthday: '1990-03-04', user_phone: '2025550102',
    user_address_line_1: '2 Example Street', user_address_line_2: '', user_city: 'Example', user_state: 'CO', user_postal_code: '80000',
    email: 'forged@example.invalid', business_id: 'c', role: 'owner', permission_template: 'owner', password: 'must-not-change-password', email_updates: '0', sms_updates: '1' };
  function event(overrides = {}, input = fields) {
    return { locals: { ...locals, ...overrides }, request: formRequest(input, '/register?invite=EXISTING-INVITE'),
      url: new URL('https://criminiops.com/register?invite=EXISTING-INVITE'),
      cookies: { get: key => cookies.get(key), set: (key, value) => cookies.set(key, value), delete: key => cookies.delete(key) } };
  }
  async function accept(overrides = {}, input = fields) {
    const current = event(overrides, input);
    return load('src/lib/server/businessInvitations.ts').acceptExistingAccountInvitation(current, await current.request.formData());
  }
  const count = table => sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n;
  return { ...test, insert, load, env, locals, cookies, fields, event, accept, count };
}
async function check(label, run, overrides) {
  const test = fixture(overrides);
  try { await run(test); assert.deepEqual(test.sqlite.prepare('PRAGMA foreign_key_check').all(), []); console.log('PASS ' + label); }
  finally { test.close(); }
}

await check('existing account joins a second paid restaurant with atomic separate profile/packet/role and unchanged credentials, preferences and original HR', async t => {
  const original = JSON.stringify(t.sqlite.prepare("SELECT * FROM employee_profiles WHERE business_id='a'").all());
  const preferences = JSON.stringify(t.sqlite.prepare('SELECT * FROM user_preferences').all());
  await assert.rejects(t.accept(), { location: '/register/welcome?onboarding=1' });
  assert.equal(t.count('users'), 2);
  assert.equal(t.sqlite.prepare("SELECT password_hash FROM users WHERE id='shared'").get().password_hash, 'unchanged-fixture-hash');
  assert.equal(JSON.stringify(t.sqlite.prepare('SELECT * FROM user_preferences').all()), preferences);
  assert.equal(JSON.stringify(t.sqlite.prepare("SELECT * FROM employee_profiles WHERE business_id='a'").all()), original);
  const membership = t.sqlite.prepare("SELECT * FROM business_users WHERE business_id='b' AND user_id='shared'").get();
  assert.equal(membership.role, 'staff'); assert.equal(membership.permission_template, 'staff');
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM business_users WHERE business_id='c'").get().n, 0);
  const profile = t.sqlite.prepare("SELECT * FROM employee_profiles WHERE business_id='b'").get();
  assert.equal(profile.real_name, 'New B identity'); assert.equal(profile.emergency_contact_name, '');
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM employee_onboarding_packages WHERE business_id='b'").get().n, 1);
  assert.equal(t.sqlite.prepare("SELECT status FROM employee_onboarding_items WHERE business_id='b' AND form_key='personal_information'").get().status, 'submitted');
  assert.equal(t.sqlite.prepare("SELECT status FROM employee_onboarding_items WHERE business_id='b' AND form_key='emergency_contact'").get().status, 'pending');
  assert.ok(!JSON.stringify(t.sqlite.prepare("SELECT * FROM employee_sensitive_record_vault WHERE business_id='b'").all()).includes('PRIVATE_A_RECORD'));
  assert.equal(t.cookies.get('kitchen_active_business'), 'b');
  const contextA = await t.load('src/lib/server/business.ts').getUserBusinessContext(t.db, 'shared', 'a');
  const contextB = await t.load('src/lib/server/business.ts').getUserBusinessContext(t.db, 'shared', 'b');
  assert.ok(contextA.businessCapabilities.includes('manage_permissions')); assert.equal(contextB.businessCapabilities.includes('admin_access'), false);
  assert.equal(t.count('account_audit_logs') >= 1, true);
  const retry = await t.accept(); assert.equal(retry.status, 403); assert.equal(t.count('employee_onboarding_packages'), 1);
});

await check('late packet write failure rolls membership, invite claim, profile, audit and packet back together; retry is safe', async t => {
  t.sqlite.exec("CREATE TRIGGER fixture_fail_packet BEFORE INSERT ON employee_sensitive_record_vault WHEN NEW.business_id='b' BEGIN SELECT RAISE(ABORT,'isolated packet failure'); END");
  const result = await t.accept(); assert.equal(result.status, 503); assert.equal(result.data.values.realName, t.fields.real_name);
  assert.equal(t.sqlite.prepare("SELECT used_at FROM business_invites WHERE id='invite-b'").get().used_at, null);
  for (const table of ['employee_profiles','employee_onboarding_packages','employee_onboarding_items','employee_employment_records','account_audit_logs']) {
    assert.equal(t.sqlite.prepare(`SELECT COUNT(*) n FROM ${table} WHERE business_id='b'`).get().n, 0, table);
  }
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM business_users WHERE business_id='b' AND user_id='shared'").get().n, 0);
  assert.equal(t.cookies.get('kitchen_active_business'), 'a');
  t.sqlite.exec('DROP TRIGGER fixture_fail_packet');
  await assert.rejects(t.accept(), { location: '/register/welcome?onboarding=1' });
});

for (const [label, edit] of [
  ['revoked invite', "UPDATE business_invites SET revoked_at=1"],
  ['expired invite', 'UPDATE business_invites SET expires_at=1'],
  ['used invite', "UPDATE business_invites SET used_at=1,used_by_user_id='other'"],
  ['unpaid restaurant', "UPDATE business_trials SET status='pending_payment' WHERE business_id='b'"],
  ['inactive identity', "UPDATE users SET is_active=0 WHERE id='shared'"]
]) await check(label + ' cannot join or change the selected restaurant', async t => {
  t.sqlite.exec(edit); const result = await t.accept(); assert.ok([403,409].includes(result.status));
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM business_users WHERE business_id='b' AND user_id='shared'").get().n, 0);
  assert.equal(t.cookies.get('kitchen_active_business'), 'a');
});

for (const [label, edit] of [
  ['revocation', 'UPDATE business_invites SET revoked_at=1'],
  ['role change', "UPDATE business_invites SET role='owner',permission_template='owner'"],
  ['session revocation', 'UPDATE sessions SET revoked_at=1'],
  ['billing revocation', "UPDATE business_trials SET status='past_due' WHERE business_id='b'"]
]) await check('commit-time ' + label + ' cannot slip between lookup and acceptance', async t => {
  const raceDb = { ...t.db, async batch(statements) { t.sqlite.exec(edit); return t.db.batch(statements); } };
  const result = await t.accept({ DB: raceDb, env: { ...t.env, DB: raceDb } }); assert.equal(result.status, 409);
  assert.equal(t.count('account_audit_logs'), 0);
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM business_users WHERE business_id='b' AND user_id='shared'").get().n, 0);
  assert.equal(t.cookies.get('kitchen_active_business'), 'a');
});

await check('anonymous and wrong identities cannot accept, and an existing membership is not reactivated or promoted', async t => {
  await assert.rejects(t.accept({ userId: undefined }), { location: '/login?invite=EXISTING-INVITE' });
  assert.equal((await t.accept({ userId: 'other' })).status, 403);
  t.insert('business_users', { business_id: 'b', user_id: 'shared', role: 'staff', permission_template: 'staff', is_active: 0, created_at: now, updated_at: now });
  assert.equal((await t.accept()).status, 409);
  assert.equal(t.sqlite.prepare("SELECT is_active FROM business_users WHERE business_id='b' AND user_id='shared'").get().is_active, 0);
});

for (const [role, required, employment] of [['owner',0,'employee'],['owner',1,'employee'],['external',1,'contractor'],['manager',1,'employee']]) {
  await check(`${role} / ${employment} preserves optional-owner and contractor packet choices`, async t => {
    await assert.rejects(t.accept(), { location: `/register/welcome?onboarding=${required && employment!=='contractor'?'1':'0'}` });
    assert.equal(t.count('employee_onboarding_packages'), required && employment!=='contractor' ? 1 : 0);
    assert.equal(t.sqlite.prepare("SELECT role FROM business_users WHERE business_id='b' AND user_id='shared'").get().role, role);
  }, { role, permission_template: role==='manager'?'general_manager':role==='external'?'consultant':role, onboarding_required:required, employment_type:employment });
}

await check('actual registration handler routes existing-account acceptance without signup passwords or altered global consent', async t => {
  const result = await t.load('src/routes/register/+page.server.ts').load({ locals:t.locals, url:t.event().url });
  assert.equal(result.existingInviteAccount,true);assert.equal(result.canAcceptInvite,true);assert.equal(result.invitationBusinessName,'Restaurant b');
  await assert.rejects(t.load('src/routes/register/+page.server.ts').actions.default(t.event()),{location:'/register/welcome?onboarding=1'});
});

await check('the actual manager invitation sender accepts an existing identity and its tenant position reaches the new membership', async t => {
  const business=t.load('src/lib/server/business.ts');
  await business.ensureDefaultBusinessPositions(t.db,'b','other');
  const position=t.sqlite.prepare("SELECT id FROM business_positions WHERE business_id='b' AND account_type='staff' AND is_active=1 LIMIT 1").get();
  assert.ok(position);
  const admin=t.load('src/lib/server/admin.ts');
  const result=await admin.createUserInvite(formRequest({email:'shared@example.invalid',position_id:position.id,onboarding_required:'1'},'/admin/onboarding'),
    {...t.locals,userId:'other',userRole:'admin',businessId:'b',businessRole:'owner',businessPermissionTemplate:'owner'},'https://criminiops.com',t.env);
  assert.equal(result.success,true);
  const invitation=t.sqlite.prepare("SELECT invite_code FROM business_invites WHERE business_id='b' AND position_id=?").get(position.id);
  await assert.rejects(t.accept({}, {...t.fields,invite_code:invitation.invite_code}),{location:'/register/welcome?onboarding=1'});
  assert.equal(t.sqlite.prepare("SELECT position_id FROM business_users WHERE business_id='b' AND user_id='shared'").get().position_id,position.id);
});

await check('reopening an accepted invitation offers only its own still-active membership, never another account or revoked membership', async t => {
  await assert.rejects(t.accept(),{location:'/register/welcome?onboarding=1'});
  const registration=t.load('src/routes/register/+page.server.ts');
  assert.deepEqual({...((await registration.load(t.event())).acceptedInvitation)},{businessId:'b',businessName:'Restaurant b'});
  assert.equal((await registration.load(t.event({userId:'other'}))).acceptedInvitation,null);
  assert.equal((await registration.load(t.event({userId:undefined}))).acceptedInvitation,null);
  t.sqlite.exec("UPDATE business_users SET is_active=0 WHERE business_id='b' AND user_id='shared'");
  assert.equal((await registration.load(t.event())).acceptedInvitation,null);
});

await check('actual employee removal from B preserves the shared identity, sessions, owner membership and retained records in A', async t => {
  await assert.rejects(t.accept(),{location:'/register/welcome?onboarding=1'});
  t.insert('sessions', {id:'other-session',user_id:'other',session_token_hash:'other-fixture-hash',created_at:now,last_seen_at:now,expires_at:now+3600});
  await assert.rejects(t.load('src/lib/server/admin.ts').deleteUser(formRequest({user_id:'shared'},'/admin/users'),
    {...t.locals,userId:'other',sessionId:'other-session',userRole:'admin',businessId:'b',businessRole:'owner',businessPermissionTemplate:'owner'}),{location:'/admin/users'});
  assert.equal(t.sqlite.prepare("SELECT is_active FROM business_users WHERE business_id='b' AND user_id='shared'").get().is_active,0);
  assert.equal(t.sqlite.prepare("SELECT role FROM business_users WHERE business_id='a' AND user_id='shared'").get().role,'owner');
  assert.equal(t.sqlite.prepare("SELECT password_hash FROM users WHERE id='shared'").get().password_hash,'unchanged-fixture-hash');
  assert.equal(t.sqlite.prepare("SELECT revoked_at FROM sessions WHERE id='shared-session'").get().revoked_at,null);
  assert.equal(t.sqlite.prepare("SELECT emergency_contact_name FROM employee_profiles WHERE business_id='a'").get().emergency_contact_name,'Private A contact');
});

await check('login keeps invite context, offers the restaurant chooser and switching uses only checked fixed destinations', async t => {
  const login = t.load('src/routes/login/+page.server.ts');
  const invitation = await login.load({locals:t.locals,url:new URL('https://criminiops.com/login?invite=EXISTING-INVITE')});
  assert.equal(invitation.activeSession.continuePath,'/register?invite=EXISTING-INVITE');
  await assert.rejects(t.accept(),{location:'/register/welcome?onboarding=1'});
  const regular = await login.load({locals:t.locals,url:new URL('https://criminiops.com/login')});
  assert.equal(regular.activeSession.continuePath,'/workspace');
  const chooser = await t.load('src/routes/workspace/+page.server.ts').load({locals:t.locals});
  assert.deepEqual(chooser.businesses.map(row=>row.businessId).sort(),['a','b']);
  const switchRoute=t.load('src/routes/workspace/switch/+server.ts');
  const choose=input=>switchRoute.POST({...t.event(),request:formRequest(input,'/workspace/switch')});
  await assert.rejects(choose({business_id:'c',entry:'login'}),{status:403});
  await assert.rejects(choose({business_id:'b',entry:'login',next:'https://evil.example.invalid'}),{location:'/settings?onboarding=1'});
  await assert.rejects(choose({business_id:'a',next:'https://evil.example.invalid'}),{location:'/app'});
  const nativeRequest=formRequest({business_id:'b',entry:'login'},'/workspace/switch');
  nativeRequest.headers.set('accept','application/json');nativeRequest.headers.set('x-crimini-native','1');
  const native=await switchRoute.POST({...t.event(),request:nativeRequest});
  assert.deepEqual(await native.json(),{location:'/settings?onboarding=1'});
  const cookieOptions=t.load('src/lib/server/activeBusiness.ts');
  assert.equal(cookieOptions.getActiveBusinessCookieOptions(nativeRequest).sameSite,'none');
  assert.equal(cookieOptions.getActiveBusinessCookieOptions(t.event().request).sameSite,'lax');
  assert.equal(cookieOptions.getActiveBusinessCookieDeleteOptions(nativeRequest).sameSite,'none');
  t.sqlite.exec("UPDATE business_users SET is_active=0 WHERE business_id='b' AND user_id='shared'");
  await assert.rejects(choose({business_id:'b'}),{status:403});
  await assert.rejects(t.load('src/routes/workspace/+page.server.ts').load({locals:t.locals}),{location:'/app'});
});

{
  const exports={},requests=[],destinations=[],notices=[];
  let native=true,reply=Response.json({location:'/app'});
  const source=ts.transpileModule(readFileSync('src/lib/client/restaurantSwitch.ts','utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
  }).outputText;
  runInNewContext(source,{exports,require:()=>({pushToast:message=>notices.push(message)}),
    window:{get __CRIMINI_NATIVE__(){return native;},location:{assign:path=>destinations.push(path)}},
    FormData:class {constructor(form){this.fields=form.fields;}},
    fetch:async(path,options)=>{requests.push({path,options});return reply;},Error});
  let submit;const attributes=new Map();
  const form={fields:{business_id:'b'},addEventListener:(type,fn)=>submit=fn,removeEventListener:(type,fn)=>{assert.equal(fn,submit);submit=null;},
    setAttribute:(key,value)=>attributes.set(key,value),removeAttribute:key=>attributes.delete(key)};
  const action=exports.nativeRestaurantSwitch(form);let prevented=false;
  const event={preventDefault(){prevented=true;}};
  native=false;await submit(event);assert.equal(prevented,false);assert.equal(requests.length,0);
  native=true;await submit(event);assert.equal(prevented,true);assert.deepEqual(destinations,['/app']);
  assert.equal(requests[0].path,'/workspace/switch');assert.equal(requests[0].options.credentials,'include');
  assert.equal(requests[0].options.body.fields.business_id,'b');assert.equal(attributes.has('aria-busy'),false);
  reply=Response.json({location:'/settings?onboarding=1'});await submit(event);assert.equal(destinations.at(-1),'/settings?onboarding=1');
  for(const response of [new Response('',{status:403}),Response.json({location:'https://evil.example.invalid'})]) {
    const before=destinations.length;reply=response;await submit(event);assert.equal(destinations.length,before);
  }
  assert.equal(notices.length,2);
  reply=Response.json({location:'/app'});await submit(event);assert.equal(destinations.at(-1),'/app');
  action.destroy();assert.equal(submit,null);
  console.log('PASS actual native restaurant-switch client: authenticated backend submission, local-shell reload, retry/error handling and web progressive fallback');
}

await check('real password sign-in chooses among restaurants and retains the additional-restaurant invitation', async t => {
  const auth=t.load('src/lib/server/auth.ts');
  const password='Isolated-original-password7!';
  const hash=await auth.hashPassword(password,t.env);
  t.sqlite.prepare("UPDATE users SET password_hash=? WHERE id='shared'").run(hash);
  await assert.rejects(t.accept(),{location:'/register/welcome?onboarding=1'});
  const login=t.load('src/routes/login/+page.server.ts');
  function attempt(query='') {
    return login.actions.login({...t.event({userId:undefined}),url:new URL('https://criminiops.com/login'+query),
      request:formRequest({email:'shared@example.invalid',password},'/login?/login'),getClientAddress:()=> '192.0.2.40'});
  }
  await assert.rejects(attempt(),{location:'/workspace'});
  await assert.rejects(attempt('?invite=EXISTING-INVITE'),{location:'/register?invite=EXISTING-INVITE'});
  assert.equal((await auth.verifyPassword(password,t.sqlite.prepare("SELECT password_hash FROM users WHERE id='shared'").get().password_hash,t.env)).valid,true);
});

await check('actual hook enforces selected-restaurant roles, billing and stale-tab guards while allowing secure restaurant selection', async t => {
  await assert.rejects(t.accept(),{location:'/register/welcome?onboarding=1'});
  const token='isolated-multi-restaurant-session';
  t.sqlite.prepare("UPDATE sessions SET session_token_hash=? WHERE id='shared-session'").run(await t.load('src/lib/server/auth.ts').hashSessionToken(token));
  const hooks=loadServerModules({
    'cloudflare:workers':{env:t.env,waitUntil(){}},
    '#lib/server/observability.ts':{logOperationalEvent(){},logOperationalError(){}},
    '#lib/server/platformDiagnostics.ts':{async recordRequestDiagnostic(){}},
    '#lib/server/operationalEvents.ts':{async processOperationalEvents(){}}
  })('src/hooks.server.ts');
  async function probe(path,business='b',method='GET',expected) {
    const cookies=new Map([['__Host-kitchen_session',token],['kitchen_active_business',business]]);
    const url=new URL(path,'https://criminiops.com');let resolved=false;
    const headers={origin:url.origin};if(expected)headers['x-crimini-workspace']=expected;
    const event={url,request:new Request(url,{method,headers}),locals:{},cookies:{get:key=>cookies.get(key),set:(key,value)=>cookies.set(key,value),delete:key=>cookies.delete(key)}};
    try {
      const response=await hooks.handle({event,resolve:async()=>{resolved=true;return new Response('Authorized');}});
      return {response,resolved,event,cookies};
    }catch(error){return {error,resolved,event,cookies};}
  }
  const a=await probe('/admin','a');assert.equal(a.resolved,true);assert.equal(a.event.locals.businessRole,'owner');
  const b=await probe('/admin');assert.equal(b.resolved,false);assert.equal(b.error.location,'/app');
  const dashboard=await probe('/app');assert.equal(dashboard.resolved,true);assert.equal(dashboard.event.locals.businessRole,'staff');assert.equal(dashboard.event.locals.userRole,'user');
  const before=t.sqlite.prepare('SELECT total_changes() n').get().n;
  const stale=await probe('/admin/creator?/create_recipe','b','POST','a');assert.equal(stale.response.status,409);assert.equal(stale.resolved,false);
  assert.equal(t.sqlite.prepare('SELECT total_changes() n').get().n,before);
  t.sqlite.exec("UPDATE business_trials SET status='pending_payment' WHERE business_id='b'");
  const denied=await probe('/app');assert.equal(denied.resolved,false);assert.equal(denied.error.location,'/billing?access=required');
  assert.equal((await probe('/workspace')).resolved,true);
  assert.equal((await probe('/workspace/switch','b','POST')).resolved,true);
  t.sqlite.exec("UPDATE business_trials SET status='trialing',trial_ends_at=1 WHERE business_id='b'");
  assert.equal((await probe('/workspace')).resolved,true);
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM businesses WHERE id='b'").get().n,1,'Selecting another restaurant cannot purge the previous one');
  t.sqlite.exec("UPDATE business_users SET is_active=0 WHERE user_id='shared'");
  const invitation=await probe('/register?invite=EXISTING-INVITE');assert.equal(invitation.resolved,true);assert.equal(invitation.event.locals.userId,'shared');assert.equal(invitation.event.locals.businessId,undefined);
  assert.equal((await probe('/workspace')).resolved,true);
  assert.equal((await probe('/app')).resolved,false);
});
