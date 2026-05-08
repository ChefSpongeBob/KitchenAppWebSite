<script lang="ts">
  import { onMount } from 'svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { startVisiblePolling } from '$lib/client/polling';

  type NodeName = {
    sensor_id: number;
    name: string;
  };

  export let data: {
    nodeNames?: NodeName[];
  };

  let latest: Record<number, number> = {};
  let lastSeen: Record<number, number> = {};
  let seenSensorIds: number[] = [];
  const TEMP_WARNING_THRESHOLD = 42;

  const URL = '/api/temps?limit=180';

  const nodeNames: Record<number, string> = {
    ...(data.nodeNames ?? []).reduce<Record<number, string>>((acc, row) => {
      acc[row.sensor_id] = row.name;
      return acc;
    }, {})
  };

  async function load() {
    try {
      const res = await fetch(URL);
      if (!res.ok) return;
      const responseData = await res.json();

      const latestMap: Record<number, number> = {};
      const seen: Record<number, number> = {};
      const seenIds = new Set<number>();

      for (const row of responseData) {
        const sensor = row.sensor_id;
        const temp = Number(row.temperature);
        const tsMs = row.ts > 1e10 ? row.ts : row.ts * 1000;
        if (!Number.isFinite(sensor) || !Number.isFinite(temp) || !Number.isFinite(tsMs)) continue;
        seenIds.add(sensor);

        if (latestMap[sensor] === undefined) {
          latestMap[sensor] = temp;
        }

        if (seen[sensor] === undefined) {
          seen[sensor] = tsMs;
        }
      }

      latest = latestMap;
      lastSeen = seen;
      seenSensorIds = Array.from(seenIds).sort((a, b) => a - b);
    } catch (err) {
      console.error('Failed to load temps:', err);
    }
  }

  onMount(() => {
    const stopPolling = startVisiblePolling(load, {
      intervalMs: 45000,
      maxIntervalMs: 5 * 60 * 1000,
      runImmediately: true,
      refreshOnVisible: true,
      jitterMs: 8000
    });
    return () => stopPolling();
  });

  function tempClass(temp?: number) {
    if (temp === undefined) return '';
    if (temp >= TEMP_WARNING_THRESHOLD) return 'hot';
    if (temp < 38) return 'cold';
    return 'normal';
  }

  function formatTime(ts?: number) {
    if (!ts) return '--';
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function isOnline(ts?: number) {
    if (!ts) return false;
    const staleThresholdMs = 6 * 60 * 1000;
    return Date.now() - ts < staleThresholdMs;
  }

  $: nodeIds = (() => {
    const namedIds = Object.keys(nodeNames).map((v) => Number(v)).filter((v) => Number.isFinite(v));
    return Array.from(new Set([...namedIds, ...seenSensorIds])).sort((a, b) => a - b);
  })();
  $: onlineCount = nodeIds.filter((node) => isOnline(lastSeen[node])).length;
  $: warningNodes = nodeIds
    .filter((node) => latest[node] !== undefined && latest[node] >= TEMP_WARNING_THRESHOLD)
    .map((node) => ({
      sensorId: node,
      name: nodeNames[node] ?? `Node ${node}`,
      temperature: latest[node],
      ts: lastSeen[node]
    }));
</script>

<PageHeader title="Kitchen Temps" />

<section class="status-strip" aria-label="Temperature status">
  <div>
    <span>Configured</span>
    <strong>{Object.keys(nodeNames).length}</strong>
  </div>
  <div>
    <span>Online</span>
    <strong>{onlineCount}/{nodeIds.length}</strong>
  </div>
  <div>
    <span>Warnings</span>
    <strong>{warningNodes.length}</strong>
  </div>
</section>

{#if warningNodes.length > 0}
  <section class="warning-row" aria-label="Temperature warnings">
    {#each warningNodes as node}
      <div class="warning-card">
        <span class="warning-label">Temp Warning</span>
        <strong>{node.name}</strong>
        <div class="warning-reading">{node.temperature.toFixed(1)}F</div>
        <small>Last update: {formatTime(node.ts)}</small>
      </div>
    {/each}
  </section>
{/if}

{#if nodeIds.length === 0}
  <section class="empty-state">
    <strong>No sensor nodes yet.</strong>
    <span>Add node names in Camera & Sensors.</span>
  </section>
{:else}
  <div class="grid">
    {#each nodeIds as node}
      <div class="tile {tempClass(latest[node])}">
        <div class="node-head">
          <h2 title="Sensor ID: {node}">{nodeNames[node] ?? `Node ${node}`}</h2>
          <span class:offline={!isOnline(lastSeen[node])}>{isOnline(lastSeen[node]) ? 'Online' : 'Stale'}</span>
        </div>

        {#if latest[node] !== undefined}
          <div class="temp">{latest[node]}F</div>
          <small class="seen">Last update: {formatTime(lastSeen[node])}</small>
        {:else}
          <div class="temp offline">--</div>
          <small class="seen">No recent data</small>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .status-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1px;
    overflow: hidden;
    border: var(--surface-outline);
    border-radius: var(--radius-lg);
    background: var(--color-border);
    box-shadow: var(--shadow-xs);
    margin-bottom: 1rem;
  }

  .status-strip > div {
    display: grid;
    gap: 0.2rem;
    padding: 0.86rem 0.95rem;
    background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  }

  .status-strip span {
    color: var(--color-text-muted);
    font-size: 0.82rem;
  }

  .status-strip strong {
    font-size: clamp(1.12rem, 2vw, 1.55rem);
    line-height: 1.05;
  }

  .warning-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem;
    margin: 0 0 1rem;
  }

  .warning-card {
    border: 1px solid color-mix(in srgb, var(--color-error) 38%, var(--color-border) 62%);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--color-error) 14%, transparent), transparent),
      var(--color-surface);
    border-radius: var(--radius-lg);
    padding: 0.9rem 1rem;
    display: grid;
    gap: 0.22rem;
    box-shadow: var(--shadow-xs);
    color: var(--color-text);
  }

  .warning-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: color-mix(in srgb, var(--color-error) 72%, var(--color-text) 28%);
  }

  .warning-card strong {
    font-size: 1rem;
  }

  .warning-reading {
    font-size: 1.7rem;
    font-weight: var(--weight-bold);
    color: color-mix(in srgb, var(--color-error) 76%, var(--color-text) 24%);
    line-height: 1.05;
  }

  .warning-card small {
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 14px;
    margin: 20px 0;
  }

  .tile {
    position: relative;
    background: var(--surface-wash), var(--color-surface);
    padding: 1rem;
    border: var(--surface-outline);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xs);
    color: var(--color-text);
    transition: border-color 0.2s ease, background 0.2s ease;
    overflow: hidden;
  }

  .node-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .node-head h2 {
    margin: 0;
    font-size: 1rem;
  }

  .node-head span {
    border: 1px solid color-mix(in srgb, var(--color-success) 42%, var(--color-border) 58%);
    border-radius: 999px;
    color: color-mix(in srgb, var(--color-success) 72%, var(--color-text) 28%);
    padding: 0.14rem 0.48rem;
    font-size: 0.7rem;
    font-weight: var(--weight-semibold);
  }

  .node-head span.offline {
    border-color: color-mix(in srgb, var(--color-warning) 42%, var(--color-border) 58%);
    color: color-mix(in srgb, var(--color-warning) 74%, var(--color-text) 26%);
  }

  .temp {
    margin-top: 1rem;
    font-size: 2.2rem;
    font-weight: var(--weight-bold);
  }

  .seen {
    display: block;
    margin-top: 6px;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .offline {
    color: var(--color-text-muted);
  }

  .empty-state {
    display: grid;
    gap: 0.2rem;
    border: var(--surface-outline);
    border-radius: var(--radius-lg);
    background: var(--surface-wash), var(--color-surface);
    padding: 1rem;
    color: var(--color-text);
  }

  .empty-state span {
    color: var(--color-text-muted);
  }

  .hot {
    border-color: color-mix(in srgb, var(--color-error) 72%, var(--color-border) 28%);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--color-error) 9%, transparent), transparent 70%),
      var(--color-surface);
  }

  .cold {
    border-color: color-mix(in srgb, var(--color-primary) 68%, var(--color-border) 32%);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 8%, transparent), transparent 70%),
      var(--color-surface);
  }

  .normal {
    border-color: color-mix(in srgb, var(--color-success) 58%, var(--color-border) 42%);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--color-success) 8%, transparent), transparent 70%),
      var(--color-surface);
  }

  @media (max-width: 760px) {
    .status-strip {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .warning-row {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem;
      margin-bottom: 0.8rem;
    }

    .warning-card {
      padding: 0.75rem 0.8rem;
    }

    .warning-reading {
      font-size: 1.35rem;
    }

    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin: 14px 0 0;
    }

    .tile {
      padding: 12px 10px;
      border-radius: 12px;
    }

    .temp {
      font-size: 1.45rem;
      line-height: 1.1;
    }
  }

  @media (max-width: 430px) {
    .status-strip {
      grid-template-columns: 1fr;
    }

    .warning-row {
      grid-template-columns: 1fr;
    }

    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>

