<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import TempGraph from "$lib/components/ui/TempGraph.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";

  let latest: Record<number, number> = {};
  let series: Record<number, number[]> = {};
  let lastSeen: Record<number, number> = {};

  const URL = "https://ktchwork.chefspongebobsrecepiebook.workers.dev/";

  async function load(){
    const res = await fetch(URL);
    const batches = await res.json();

    const latestMap: Record<number, number> = {};
    const grouped: Record<number, number[]> = {};

    const now = Date.now();

    for (const b of batches){
      if (!b.readings) continue;

      for (const r of b.readings){
        const t = Number(r.temperature);

        latestMap[r.node] = t;

        if (!grouped[r.node]) grouped[r.node] = [];
        grouped[r.node].push(t);

        // 👇 use real time when loaded
        lastSeen[r.node] = now;
      }
    }

    latest = latestMap;
    series = grouped;
  }

  // live refresh
  onMount(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  });

  // temp highlight
  function tempClass(temp?: number){
    if (temp === undefined) return "";
    if (temp > 75) return "hot";
    if (temp < 38) return "cold";
    return "normal";
  }

  // format clock time
  function formatTime(ts?: number){
    if (!ts) return "—";

    return new Date(ts).toLocaleTimeString([],{
      hour:'2-digit',
      minute:'2-digit'
    });
  }
</script>

<PageHeader
  title="Kitchen Temps"
  subtitle="12h history"
/>

<div class="graph-wrap" in:fade={{ duration: 400 }}>
  <TempGraph {series} height={160}/>
</div>

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

