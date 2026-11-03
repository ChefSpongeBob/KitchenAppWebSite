import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const tools = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare, Response: WorkerResponse } = tools('miniflare');
const { buildSync } = tools('esbuild');
const cloudflare = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const { outputFiles } = buildSync({
  stdin: { contents: `
    import { sendTransactionalEmail } from './src/lib/server/email.ts';
    export default { async fetch() {
      return Response.json(await sendTransactionalEmail({
        env: { RESEND_API_KEY: 'runtime-fixture', RESEND_FROM_EMAIL: 'test@example.invalid' },
        to: 'employee@example.invalid', subject: 'Runtime check', html: '', text: ''
      }));
    }};`, resolveDir: process.cwd(), sourcefile: 'email-runtime-check.js' },
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false
});
let status = 200, calls = 0;
const runtime = new Miniflare({
  host: '127.0.0.1', port: 0, cf: false, telemetry: { enabled: false },
  workers: [{
    config: { name: 'email-runtime-check', compatibilityDate: cloudflare.compatibility_date, compatibilityFlags: cloudflare.compatibility_flags,
      manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: outputFiles[0].text } } } },
    dev: { outboundService: { type: 'fetcher', handler: async request => {
      assert.equal(request.url, 'https://api.resend.com/emails');
      assert.equal(request.method, 'POST');
      assert.equal(request.headers.get('authorization'), 'Bearer runtime-fixture');
      calls++;
      return status === 200 ? WorkerResponse.json({ id: 'runtime-receipt' })
        : new WorkerResponse(null, { status, headers: { location: 'https://untrusted.example.invalid' } });
    } } }
  }]
});
try {
  for (status of [200, 301, 302, 303, 307, 308]) {
    const before = calls;
    const response = await runtime.dispatchFetch('https://runtime.example.invalid');
    const result = await response.json();
    assert.equal(calls, before + 1, 'Workerd must make exactly one provider request, never follow redirects');
    assert.equal(result.sent, status === 200);
    if (status !== 200) assert.equal(result.reason, 'Email provider returned an unexpected redirect.');
  }
  console.log('PASS actual Workers runtime: email fetch options accepted, provider receipt confirmed, every redirect rejected without credential forwarding');
} finally { await runtime.dispose(); }
