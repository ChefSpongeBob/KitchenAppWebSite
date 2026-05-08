const baseUrl = process.env.APP_BASE_URL;
const token = process.env.SMOKE_INTERNAL_TOKEN;

if (!baseUrl || !token) {
  console.error('APP_BASE_URL and SMOKE_INTERNAL_TOKEN are required for schema readiness checks.');
  process.exit(1);
}

const endpoint = new URL('/api/internal/schema-readiness', baseUrl).toString();
const response = await fetch(endpoint, {
  headers: {
    'x-smoke-token': token
  }
});

const payload = await response.json().catch(() => null);
if (!response.ok || !payload?.ok) {
  console.error('Production schema readiness failed.');
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

console.log('Production schema readiness passed.');
