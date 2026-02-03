<script>
  import Layout from '$lib/components/ui/Layout.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import TempGraph from '$lib/components/ui/TempGraph.svelte';
  import { fly, fade } from 'svelte/transition';
  import { onMount } from 'svelte';


let series = {};

async function loadTemps(){
  const res = await fetch("https://ktchwork.chefspongebobsrecepiebook.workers.dev/");
  const batches = await res.json();

  const grouped = {};

  for(const b of batches){
    if(!b.readings) continue;

    for(const r of b.readings){
      if(!grouped[r.node]) grouped[r.node] = [];
      grouped[r.node].push(r.temperature);
    }
  }

  series = grouped;
}

onMount(()=>{
  loadTemps();
});

  /* ===== Time + Greeting ===== */
  let time = '';
  let greeting = '';
  let userName = "SousChef";

  function updateTime() {
    const now = new Date();

    time = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    const h = now.getHours();
    greeting =
      h < 12 ? 'Good morning' :
      h < 18 ? 'Good afternoon' :
      'Good evening';
  }

  onMount(() => {
    updateTime();
    const i = setInterval(updateTime, 1000);
    return () => clearInterval(i);
  });

  /* ===== Parallax ===== */
  let px = 0;
  let py = 0;

  function handleMove(e) {
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;

    px = (x / window.innerWidth - 0.5);
    py = (y / window.innerHeight - 0.5);
  }

  /* ===== Top Ideas ===== */
  const topIdeas = [
    { text: "Late-night menu", votes: 12 },
    { text: "Mango crab roll", votes: 8 },
    { text: "Seasonal specials", votes: 5 }
  ];
</script>

<Layout>

<section class="page-header" in:fly={{ y: 20, duration: 500 }}>
  <h1>{greeting}, {userName}</h1>
  <div class="divider"></div>
</section>

<section
  class="mosaic"
  on:mousemove={handleMove}
  on:touchmove={handleMove}
  in:fade={{ duration: 500 }}
>

  <!-- Greeting Tile -->
  <div
    class="tile greeting"
    style="transform: translate({px * -6}px, {py * -6}px);"
    in:fly={{ y: 20, duration: 500 }}
  >
    <h2>{greeting}</h2>
    <span class="time">{time}</span>
  </div>

  <!-- Temps Tile -->
  <div
    class="tile temps"
    style="transform: translate({px * 4}px, {py * 4}px);"
    in:fly={{ y: 20, duration: 550 }}
  >
    <div class="tile-label">Kitchen Temps</div>

    <!-- SAME SIZE CONTAINER -->
    <div class="mini-graph">
      <TempGraph {series} height={40} />

    </div>
  </div>

  <!-- Ideas Tile -->
  <div
    class="tile ideas"
    style="transform: translate({px * 8}px, {py * 8}px);"
    in:fly={{ y: 20, duration: 600 }}
  >
    <div class="tile-label">Top Ideas</div>

    {#each topIdeas as idea}
      <div class="idea">
        <span>{idea.text}</span>
        <small>▲ {idea.votes}</small>
      </div>
    {/each}
  </div>

</section>

<DashboardCard
  title="Today"
  description="No critical alerts. Kitchen running normally."
/>

<section class="dashboard">
  <p class="section-label">Quick Access</p>

  <a href="/lists" class="card-link">
    <DashboardCard
      title="Lists"
      description="Prep lists, inventory, and orders"
    />
  </a>

  <a href="/todo" class="card-link">
    <DashboardCard
      title="ToDos"
      description="Track your tasks"
    />
  </a>

  <a href="/whiteboard" class="card-link">
    <DashboardCard
      title="Whiteboard"
      description="Notes and ideas"
    />
  </a>

  <a href="/temps" class="card-link">
    <DashboardCard
      title="Temps"
      description="Temperature logs"
    />
  </a>

</section>

</Layout>

<style>

.page-header{
  padding: 3rem 1rem 0.5rem;
}

.page-header h1{
  margin:0;
  font-size:2.2rem;
  font-weight:var(--weight-semibold);
  letter-spacing:-0.03em;
}

.divider{
  height:1px;
  background:var(--color-border);
  margin-top:12px;
  opacity:.6;
}

.mosaic{
  display:grid;
  grid-template-columns:1.2fr 1fr;
  grid-auto-rows:110px;
  gap:12px;
  padding:1rem;
}

.tile{
  background:var(--color-surface);
  border:1px solid var(--color-border);
  border-radius:var(--radius-lg);
  padding:14px;
  display:flex;
  flex-direction:column;
  justify-content:center;
  transition: transform .25s ease, box-shadow .25s ease;
}

.tile:hover{
  transform:translateY(-2px);
  box-shadow:var(--shadow-sm);
}

.greeting{
  grid-row:span 2;
}

.greeting h2{
  margin:0;
  font-size:1.5rem;
}

.time{
  margin-top:6px;
  color:var(--color-text-muted);
}

.temps strong{
  font-size:1.4rem;
}

/* 👇 THIS KEEPS GRAPH SMALL */
.mini-graph{
  width:100%;
  height:40px;
  margin-top:6px;
  overflow:hidden;
}

.tile-label{
  font-size:var(--text-xs);
  text-transform:uppercase;
  letter-spacing:.08em;
  color:var(--color-text-muted);
  margin-bottom:6px;
}

.idea{
  display:flex;
  justify-content:space-between;
  font-size:var(--text-sm);
  color:var(--color-text-muted);
}

.dashboard{
  display:flex;
  flex-direction:column;
  gap:1.1rem;
  padding-inline:1rem;
  margin-top:2rem;
  padding-bottom:8rem;
}

.section-label{
  font-size:var(--text-sm);
  color:var(--color-text-muted);
  letter-spacing:.08em;
  text-transform:uppercase;
}

.card-link{
  text-decoration:none;
  display:block;
}

</style>
