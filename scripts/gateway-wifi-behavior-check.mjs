import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function loadSource(path, dependencies) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  new Function('require', 'exports', source)((name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  return exports;
}

const serial = 'gateway-wifi-unit-test';
const credentialHash = createHash('sha256').update('unit-test-only-factory-credential').digest('hex');
let lastSeenAt = null;
const queries = [];
const db = {
  prepare(sql) {
    const statement = {
      bindings: [],
      bind(...values) { this.bindings = values; return this; },
      async first() {
        queries.push({ sql, bindings: this.bindings });
        assert.match(sql, /business_id = \?/);
        assert.match(sql, /is_active = 1/);
        assert.match(sql, /revoked_at IS NULL/);
        if (this.bindings[0] !== 'gateway-a' || this.bindings[1] !== 'business-a') return null;
        return { id: 'gateway-a', external_device_id: serial, key_hash: credentialHash, last_seen_at: lastSeenAt };
      }
    };
    return statement;
  }
};
const provisioning = loadSource('src/lib/server/temperatureDeviceProvisioning.ts', {
  '$app/env': { dev: false },
  '#lib/server/iotIngest.ts': {},
  '#lib/server/temperatureSensors.ts': { normalizeDeviceSerial: value => value.toLowerCase() }
});
const session = await provisioning.loadGatewayProvisioningSession(db, 'business-a', 'gateway-a');
assert.equal(session.networkName, `Crimini-${serial}`);
assert.equal(session.networkPassword, createHmac('sha256', Buffer.from(credentialHash, 'hex'))
  .update(`crimini-setup-wifi-v1:${serial}`).digest('hex').slice(0, 32));
assert.equal(session.setupUrl, 'http://192.168.4.1/');
assert.equal(JSON.stringify(session).includes(credentialHash), false);
await assert.rejects(provisioning.loadGatewayProvisioningSession(db, 'business-b', 'gateway-a'));
await assert.rejects(provisioning.loadGatewayConnectionStatus(db, 'business-b', 'gateway-a'));
console.log('PASS Wi-Fi setup credentials and connection status enforce tenant gateway ownership');

const audit = [];
let registrationInput;
const actionsModule = loadSource('src/routes/admin/sensors/+page.server.ts', {
  '@sveltejs/kit': { fail: (status, data) => ({ status, data }) },
  '#lib/server/admin.ts': { requireAdmin: role => { if (role !== 'admin') throw Error('Access denied'); } },
  '#lib/server/iotIngest.ts': {},
  '#lib/server/tenant.ts': { requireBusinessId: locals => locals.businessId, ensureTenantSchema: async () => {} },
  '#lib/server/temperatureDeviceProvisioning.ts': {
    ...provisioning,
    claimTemperatureGateway: async (_db, input) => {
      registrationInput = input;
      return { id: 'new-gateway-a', serial: input.serial };
    }
  },
  '#lib/server/temperatureMonitoring.ts': {},
  '#lib/server/security.ts': { checkRateLimit: async () => ({ allowed: true }), writeAuditLogSafe: async (_db, entry) => audit.push(entry) }
});
function event(fields, businessId = 'business-a', userRole = 'admin') {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, String(value));
  return {
    locals: { DB: db, businessId, userRole, userId: 'manager-a' },
    request: new Request('https://criminiops.com/admin/sensors', { method: 'POST', body: form }),
    setHeaders: headers => assert.equal(headers['cache-control'], 'no-store'),
    getClientAddress: () => '127.0.0.1'
  };
}
const registered = await actionsModule.actions.register_gateway(event({
  external_device_id: serial, display_name: 'Kitchen Gateway'
}));
assert.equal(registered.gatewayId, 'new-gateway-a');
assert.equal(registered.success, true);
assert.deepEqual(registrationInput, {
  businessId: 'business-a', serial, displayName: 'Kitchen Gateway', createdBy: 'manager-a'
});
assert.equal((await actionsModule.actions.register_gateway(event({ external_device_id: serial }))).status, 400);
await assert.rejects(actionsModule.actions.register_gateway(event({
  external_device_id: serial, display_name: 'Kitchen Gateway'
}, 'business-a', 'user')));
console.log('PASS gateway registration returns the tenant-owned gateway ID for the Wi-Fi setup handoff');

const sensorPage = readFileSync('src/routes/admin/sensors/+page.svelte', 'utf8');
const registerHandler = sensorPage.match(/const registerGateway: SubmitFunction = async[\s\S]*?(?=\s+onMount\()/)?.[0];
assert.ok(registerHandler, 'Registration enhancement must be present');
const handlerSource = ts.transpileModule(`${registerHandler}\nexport { registerGateway };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const handoffEvents = [];
class SetupForm { requestSubmit() { handoffEvents.push('setup-submit'); } }
const handlerExports = {};
new Function('exports', 'withFeedback', 'tick', 'document', 'HTMLFormElement', handlerSource)(
  handlerExports,
  async () => async () => { handoffEvents.push('feedback-and-reload'); },
  async () => { handoffEvents.push('render'); },
  { getElementById: id => {
    assert.equal(id, 'gateway-setup-new-gateway-a');
    return new SetupForm();
  } },
  SetupForm
);
const handleRegistration = await handlerExports.registerGateway({
  formElement: { reset: () => handoffEvents.push('reset') }
});
await handleRegistration({ result: { type: 'success', data: registered } });
assert.deepEqual(handoffEvents, ['feedback-and-reload', 'reset', 'render', 'setup-submit']);
handoffEvents.length = 0;
await handleRegistration({ result: { type: 'failure', status: 400, data: { error: 'Invalid serial' } } });
assert.deepEqual(handoffEvents, ['feedback-and-reload']);
assert.match(sensorPage, /action="\?\/register_gateway" use:enhance=\{registerGateway\}/);
console.log('PASS successful registration opens the existing Wi-Fi guide after rendering; failures keep the inputs');

const setup = await actionsModule.actions.gateway_setup(event({ gateway_id: 'gateway-a' }));
assert.equal(setup.provisioning.networkPassword, session.networkPassword);
assert.equal(JSON.stringify(audit).includes(session.networkPassword), false);
assert.equal((await actionsModule.actions.gateway_setup(event({ gateway_id: 'gateway-a' }, 'business-b'))).status, 400);
await assert.rejects(actionsModule.actions.gateway_setup(event({ gateway_id: 'gateway-a' }, 'business-a', 'user')));
const startedAt = Math.floor(Date.now() / 1000) - 60;
lastSeenAt = startedAt - 1;
assert.equal((await actionsModule.actions.gateway_connection(event({ gateway_id: 'gateway-a', started_at: startedAt }))).connected, false);
lastSeenAt = startedAt + 30;
assert.equal((await actionsModule.actions.gateway_connection(event({ gateway_id: 'gateway-a', started_at: startedAt }))).connected, true);
assert.equal((await actionsModule.actions.gateway_connection(event({ gateway_id: 'gateway-a', started_at: startedAt }, 'business-b'))).status, 400);
assert.equal((await actionsModule.actions.gateway_connection(event({ gateway_id: 'gateway-a', started_at: 0 }))).status, 400);
console.log('PASS desktop setup requires management access and a fresh check-in before reporting connected');

let authenticated = true;
let monitoringEnabled = true;
const api = loadSource('src/routes/api/temps/+server.ts', {
  '@sveltejs/kit': { json: (value, options) => Response.json(value, options) },
  'cloudflare:workers': { waitUntil() { throw Error('No request context in this isolated test.'); } },
  '#lib/temperatureTiming.ts': loadSource('src/lib/temperatureTiming.ts', {}),
  '#lib/server/retention.ts': {},
  '#lib/server/iotIngest.ts': { authenticateIoTDevice: async () => authenticated ? { id: 'gateway-a', businessId: 'business-a' } : null },
  '#lib/server/tenant.ts': { ensureTenantSchema: async () => {} },
  '#lib/server/appFeatures.ts': { loadAppFeatureModes: async () => ({ temps: monitoringEnabled ? 'all' : 'off' }) },
  '#lib/server/temperatureSensors.ts': { normalizeDeviceSerial: value => value.toLowerCase() },
  '#lib/server/temperatureDeviceProvisioning.ts': {},
  '#lib/server/trial.ts': { getBusinessTrialAccess: async () => ({ allowApp: true }) },
  '#lib/server/observability.ts': {},
  '#lib/server/temperatureMonitoring.ts': {}
});
async function gatewayRequest(body) {
  return api.POST({
    locals: { env: { DB: { prepare: () => { throw Error('Status check must not write sensor readings'); } } } },
    url: new URL('https://criminiops.com/api/temps'),
    request: new Request('https://criminiops.com/api/temps', { method: 'POST', body: JSON.stringify(body) })
  });
}
let response = await gatewayRequest({ gateway_status: true });
assert.equal(response.status, 200);
assert.equal(response.headers.get('cache-control'), 'no-store');
assert.deepEqual(await response.json(), { connected: true });
authenticated = false;
assert.equal((await gatewayRequest({ gateway_status: true })).status, 401);
authenticated = true;
monitoringEnabled = false;
assert.equal((await gatewayRequest({ gateway_status: true })).status, 403);
monitoringEnabled = true;
assert.equal((await gatewayRequest({ gateway_status: true, password: 'must-not-be-accepted' })).status, 400);
console.log('PASS authenticated gateway check-in works without creating temperature rows or accepting Wi-Fi credentials');

const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
const storage = new Map();
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key)
} });
try {
  const progress = loadSource('src/lib/client/gatewayProvisioning.ts', {});
  const saved = { gatewayId: 'gateway-a', businessId: 'business-a', startedAt, step: 2 };
  progress.saveGatewaySetupProgress({ ...saved, password: session.networkPassword });
  assert.deepEqual(progress.readGatewaySetupProgress(), saved);
  assert.equal([...storage.values()].join('').includes(session.networkPassword), false);
  progress.saveGatewaySetupProgress({ ...saved, startedAt: 1 });
  assert.equal(progress.readGatewaySetupProgress(), null);
  progress.saveGatewaySetupProgress(null);
  assert.equal(progress.readGatewaySetupProgress(), null);
} finally {
  if (storageDescriptor) Object.defineProperty(globalThis, 'sessionStorage', storageDescriptor);
  else delete globalThis.sessionStorage;
}
console.log('PASS setup progress survives network changes without persisting network credentials');
