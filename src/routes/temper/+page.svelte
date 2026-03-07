<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import TempGraph from '$lib/components/ui/TempGraph.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  type NodeName = {
    sensor_id: number;
    name: string;
  };

  export let data: {
    nodeNames?: NodeName[];
  };

  let temps: Array<{ sensor_id: number; temperature: number; ts: number }> = [];
  let latest: Record<number, number> = {};
  let series: Record<number, number[]> = {};
  let lastSeen: Record<number, number> = {};
  let seenSensorIds: number[] = [];

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
      const grouped: Record<number, number[]> = {};
      const seen: Record<number, number> = {};
      const seenIds = new Set<number>();

      for (const row of responseData) {
        const sensor = row.sensor_id;
        const temp = Number(row.temperature);
        const tsMs = row.ts > 1e10 ? row.ts : row.ts * 1000;
        if (!Number.isFinite(sensor) || !Number.isFinite(temp) || !Number.isFinite(tsMs)) continue;
        seenIds.add(sensor);

        latestMap[sensor] = temp;

        if (!grouped[sensor]) grouped[sensor] = [];
        grouped[sensor].push(temp);

        seen[sensor] = tsMs;
      }

      latest = latestMap;
      series = grouped;
      lastSeen = seen;
      temps = responseData;
      seenSensorIds = Array.from(seenIds).sort((a, b) => a - b);
    } catch (err) {
      console.error('Failed to load temps:', err);
    }
  }

  onMount(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  });

  function tempClass(temp?: number) {
    if (temp === undefined) return '';
    if (temp > 75) return 'hot';
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
  $: hasGraphData = Object.values(series).some((vals) => Array.isArray(vals) && vals.length > 1);
</script>

<PageHeader title="Kitchen Temps" subtitle="12h history" />

<div class="graph-wrap" in:fade={{ duration: 400 }}>
  {#if hasGraphData}
    <TempGraph {series} height={84} />
  {:else}
    <div class="graph-empty">No recent graph data yet.</div>
  {/if}
</div>

<div class="grid">
  {#each nodeIds as node}
    <div class="tile {tempClass(latest[node])}">
      <h2 title="Sensor ID: {node}">{nodeNames[node] ?? `Node ${node}`}</h2>

      {#if latest[node] !== undefined && isOnline(lastSeen[node])}
        <div class="temp">{latest[node]}F</div>
        <small class="seen">Last update: {formatTime(lastSeen[node])}</small>
      {:else}
        <div class="temp offline">--</div>
        <small class="seen">No recent data</small>
      {/if}
    </div>
  {/each}
</div>

<style>
  .graph-wrap {
    width: 100%;
    max-width: 700px;
    margin: 0 auto 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 0.35rem 0.45rem;
    background: var(--color-surface);
    min-height: 96px;
    display: flex;
    align-items: center;
  }

  .graph-empty {
    width: 100%;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.82rem;
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
    .graph-wrap {
      max-width: 100%;
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
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
