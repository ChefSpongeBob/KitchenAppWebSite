<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import TempGraph from "$lib/components/ui/TempGraph.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";

  // ---- STATE ----
  let temps: Array<{ sensor_id: number; temperature: number; ts: number }> = [];
  let latest: Record<number, number> = {};
  let series: Record<number, number[]> = {};
  let lastSeen: Record<number, number> = {};

  const URL = "/api/temps";

  // ---- LOAD FUNCTION ----
  async function load() {
    try {
      const res = await fetch(URL);
      const data = await res.json();

      const latestMap: Record<number, number> = {};
      const grouped: Record<number, number[]> = {};
      const seen: Record<number, number> = {};

      for (const row of data) {
        const sensor = row.sensor_id;
        const temp = Number(row.temperature);

        // convert ts to milliseconds for JS Date
        const tsMs = row.ts > 1e10 ? row.ts : row.ts * 1000;

        latestMap[sensor] = temp;

        if (!grouped[sensor]) grouped[sensor] = [];
        grouped[sensor].push(temp);

        seen[sensor] = tsMs;
      }

      // update reactive variables
      latest = latestMap;
      series = grouped;
      lastSeen = seen;
      temps = data;
    } catch (err) {
      console.error("Failed to load temps:", err);
    }
  }

  // ---- SINGLE ONMOUNT FOR INITIAL LOAD + LIVE REFRESH ----
  onMount(() => {
    load();
    const interval = setInterval(load, 30000); // refresh every 30s
    return () => clearInterval(interval);
  });

  // ---- HELPER FUNCTIONS ----
  function tempClass(temp?: number) {
    if (temp === undefined) return "";
    if (temp > 75) return "hot";
    if (temp < 38) return "cold";
    return "normal";
  }

  function formatTime(ts?: number) {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }
</script>

<!-- ---- PAGE HEADER ---- -->
<PageHeader
  title="Kitchen Temps"
  subtitle="12h history"
/>

<!-- ---- TEMP GRAPH ---- -->
<div class="graph-wrap" in:fade={{ duration: 400 }}>
  <TempGraph {series} height={160}/>
</div>


<!-- ---- SENSOR CARDS ---- -->
<div class="grid">
  {#each Array.from({ length: 15 }, (_, i) => i + 1) as node}
    <div class="tile {tempClass(latest[node])}">
      <h2>Node {node}</h2>

      {#if latest[node] !== undefined}
        <div class="temp">{latest[node]}°F</div>
        <small class="seen">
          Last update: {formatTime(lastSeen[node])}
        </small>
      {:else}
        <div class="temp offline">--</div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .graph-wrap{
    width:100%;
    max-width:700px;
    margin:auto;
  }

  .grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
    gap:14px;
    margin:20px 0;
  }

  .tile{
    background:#1e1e1e;
    padding:18px;
    border-radius:16px;
    text-align:center;
    box-shadow:0 4px 12px rgba(0,0,0,.4);
    color:white;

    transition:
      border 0.3s ease,
      background 0.3s ease,
      transform 0.2s ease;
  }

  .tile:hover{
    transform: translateY(-4px);
  }

  .temp{
    font-size:2.2rem;
    font-weight:bold;
  }

  .seen{
    display:block;
    margin-top:6px;
    font-size:0.75rem;
    opacity:0.6;
  }

  .offline{
    opacity:0.4;
  }

  .hot{ border:2px solid #ff4d4d; }
  .cold{ border:2px solid #4da6ff; }
  .normal{ border:2px solid #2ecc71; }
</style>
