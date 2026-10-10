function processorUrl(baseUrl) {
  return `${String(baseUrl || 'https://criminiops.com').replace(/\/+$/, '')}/api/internal/operational-events/process`;
}

function temperatureProcessorUrl(baseUrl) {
  return `${String(baseUrl || 'https://criminiops.com').replace(/\/+$/, '')}/api/internal/temperature-monitoring/process`;
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

async function processTemperatureBatch(env, businessIds) {
  const response = await fetch(temperatureProcessorUrl(env.APP_BASE_URL), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.SMOKE_INTERNAL_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ businessIds })
  });

  if (!response.ok) {
    throw new Error(`Temperature alert processor returned HTTP ${response.status}.`);
  }

  return response.json();
}

async function dispatchTemperatureAlerts(env) {
  if (!env.SMOKE_INTERNAL_TOKEN) {
    throw new Error('SMOKE_INTERNAL_TOKEN is not configured.');
  }
  if (!env.DB) {
    throw new Error('DB is not configured for the scheduled dispatcher.');
  }

  const pageSize = 250;
  let cursor = '';
  let pages = 0;
  let businessesProcessed = 0;
  let alertsProcessed = 0;

  while (pages < 20) {
    const result = await env.DB.prepare(
      `SELECT DISTINCT business_id
       FROM temperature_sensor_nodes
       WHERE is_active = 1
         AND revoked_at IS NULL
         AND business_id > ?
       ORDER BY business_id ASC
       LIMIT ?`
    )
      .bind(cursor, pageSize)
      .all();
    const businessIds = (result.results ?? [])
      .map((row) => String(row.business_id ?? '').trim())
      .filter(Boolean);
    if (businessIds.length === 0) break;

    const batches = [];
    for (let offset = 0; offset < businessIds.length; offset += 25) {
      batches.push(businessIds.slice(offset, offset + 25));
    }
    for (let offset = 0; offset < batches.length; offset += 5) {
      const summaries = await Promise.all(
        batches.slice(offset, offset + 5).map((batch) => processTemperatureBatch(env, batch))
      );
      businessesProcessed += summaries.reduce((total, summary) => total + Number(summary.businessesProcessed ?? 0), 0);
      alertsProcessed += summaries.reduce((total, summary) => total + Number(summary.processed ?? 0), 0);
    }

    cursor = businessIds[businessIds.length - 1];
    pages += 1;
    if (businessIds.length < pageSize) break;
  }

  console.log('Temperature alert processing complete.', { businessesProcessed, alertsProcessed });
}

export default {
  async scheduled(controller, env, ctx) {
    const jobs = [dispatch(env)];
    const scheduledMinute = Math.floor(Number(controller?.scheduledTime ?? Date.now()) / 60000);
    if (scheduledMinute % 5 === 0) {
      jobs.push(dispatchTemperatureAlerts(env));
    }
    ctx.waitUntil(Promise.all(jobs));
  }
};
