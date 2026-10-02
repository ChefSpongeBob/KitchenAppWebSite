function processorUrl(baseUrl) {
  return `${String(baseUrl || 'https://criminiops.com').replace(/\/+$/, '')}/api/internal/operational-events/process`;
}

async function dispatch(env) {
  if (!env.SMOKE_INTERNAL_TOKEN) {
    throw new Error('SMOKE_INTERNAL_TOKEN is not configured.');
  }

  const response = await fetch(processorUrl(env.APP_BASE_URL), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.SMOKE_INTERNAL_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ limit: 100 })
  });

  if (!response.ok) {
    throw new Error(`Operational email processor returned HTTP ${response.status}.`);
  }

  const summary = await response.json();
  console.log('Operational email dispatch complete.', summary);
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(dispatch(env));
  }
};
