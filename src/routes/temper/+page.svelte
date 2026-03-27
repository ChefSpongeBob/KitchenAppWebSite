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

  let temps: Array<{ sensor_id: number; temperature: number; ts: number }> = [];
  let latest: Record<number, number> = {};
  let lastSeen: Record<number, number> = {};
  let seenSensorIds: number[] = [];
  const TEMP_WARNING_THRESHOLD = 42;

  const URL = '/api/temps';

  const defaultNodeNames: Record<number, string> = {
    1: 'Cook Bus',
    2: 'Bus 7',
    3: 'Bus 8',
    4: 'Bus 9'
  };

  const nodeNames: Record<number, string> = {
    ...defaultNodeNames,
    ...(data.nodeNames ?? []).reduce<Record<number, string>>((acc, row) => {
      acc[row.sensor_id] = row.name;
      return acc;
    }, {})
  };

  async function load() {
    try {
      const res = await fetch(URL);
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
      temps = responseData;
      seenSensorIds = Array.from(seenIds).sort((a, b) => a - b);
    } catch (err) {
      console.error('Failed to load temps:', err);
    }
  }

  onMount(() => {
    const stopPolling = startVisiblePolling(load, {
      intervalMs: 30000,
      runImmediately: true,
      refreshOnVisible: true
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
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - ts < fiveMinutes;
  }

  $: nodeIds = (() => {
    const baselineIds = Array.from({ length: 15 }, (_, i) => i + 1);
    const namedIds = Object.keys(nodeNames).map((v) => Number(v)).filter((v) => Number.isFinite(v));
    return Array.from(new Set([...baselineIds, ...namedIds, ...seenSensorIds])).sort((a, b) => a - b);
  })();
  $: warningNodes = nodeIds
    .filter((node) => latest[node] !== undefined && latest[node] >= TEMP_WARNING_THRESHOLD)
    .map((node) => ({
      sensorId: node,
      name: nodeNames[node] ?? `Node ${node}`,
      temperature: latest[node],
      ts: lastSeen[node]
    }));
</script>

<PageHeader title="Kitchen Temps" subtitle="12h history" />

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

<div class="grid">
  {#each nodeIds as node}
    <div class="tile {tempClass(latest[node])}">
      <h2 title="Sensor ID: {node}">{nodeNames[node] ?? `Node ${node}`}</h2>

      {#if latest[node] !== undefined}
        <div class="temp">{latest[node]}F</div>
        <small class="seen">
          Last update: {formatTime(lastSeen[node])}
          {#if !isOnline(lastSeen[node])}
            (stale)
          {/if}
        </small>
      {:else}
        <div class="temp offline">--</div>
        <small class="seen">No recent data</small>
      {/if}
    </div>
  {/each}
</div>

<style>
  .warning-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem;
    margin: 0 0 1rem;
  }

  .warning-card {
    border: 1px solid rgba(220, 38, 38, 0.38);
    background:
      linear-gradient(180deg, rgba(220, 38, 38, 0.16), rgba(220, 38, 38, 0.04)),
      color-mix(in srgb, var(--color-surface) 90%, black 10%);
    border-radius: var(--radius-lg);
    padding: 0.9rem 1rem;
    display: grid;
    gap: 0.22rem;
    box-shadow: 0 10px 28px rgba(127, 29, 29, 0.16);
    color: var(--color-text);
  }

  .warning-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #fca5a5;
  }

  .warning-card strong {
    font-size: 1rem;
  }

  .warning-reading {
    font-size: 1.7rem;
    font-weight: var(--weight-bold);
    color: #fecaca;
    line-height: 1.05;
  }

  .warning-card small {
    color: rgba(255, 232, 232, 0.78);
    font-size: 0.76rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 14px;
    margin: 20px 0;
  }

  .tile {
    background: #1e1e1e;
    padding: 18px;
    border-radius: 16px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    color: white;
    transition: border 0.3s ease, background 0.3s ease, transform 0.2s ease;
  }

  .tile:hover {
    transform: translateY(-4px);
  }

  .temp {
    font-size: 2.2rem;
    font-weight: bold;
  }

  .seen {
    display: block;
    margin-top: 6px;
    font-size: 0.75rem;
    opacity: 0.6;
  }

  .offline {
    opacity: 0.4;
  }

  .hot {
    border: 2px solid #ff4d4d;
  }

  .cold {
    border: 2px solid #4da6ff;
  }

  .normal {
    border: 2px solid #2ecc71;
  }

  @media (max-width: 760px) {
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

    .tile:hover {
      transform: none;
    }

    .temp {
      font-size: 1.45rem;
      line-height: 1.1;
    }
  }

  @media (max-width: 430px) {
    .warning-row {
      grid-template-columns: 1fr;
    }

    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
