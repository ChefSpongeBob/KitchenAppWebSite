<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import TempGraph from '$lib/components/ui/TempGraph.svelte';
  import { fly, fade } from 'svelte/transition';
  import { onMount } from 'svelte';

  type HomeTask = {
    id: string;
    title: string;
    description: string | null;
    assigned_name: string | null;
    assigned_email: string | null;
  };
  type Idea = { text: string; votes: number };
  type NodeTemp = { sensorId: number; nodeName: string | null; temperature: number; ts: number };

  export let data: {
    userName?: string;
    todayTasks?: HomeTask[];
    topIdeas?: Idea[];
    nodeTemps?: NodeTemp[];
    tempSeries?: Record<string, number[]>;
  };

  let series: Record<string, number[]> = data.tempSeries ?? { avg: [] };
  let time = '';
  let greeting = '';
  let userName = data.userName ?? 'Team';
  let todayTasks: HomeTask[] = data.todayTasks ?? [];
  let topIdeas: Idea[] = data.topIdeas ?? [];
  let nodeTemps: NodeTemp[] = data.nodeTemps ?? [];
  let px = 0;
  let py = 0;

  function updateTime() {
    const now = new Date();
    time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const h = now.getHours();
    greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  function handleMove(e: MouseEvent | TouchEvent) {
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    px = x / window.innerWidth - 0.5;
    py = y / window.innerHeight - 0.5;
  }

  onMount(() => {
    updateTime();
    const i = setInterval(updateTime, 1000);
    return () => clearInterval(i);
  });
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
    aria-label="Dashboard Tiles"
    in:fade={{ duration: 500 }}
  >
    <div
      class="tile greeting"
      style="transform: translate({px * -6}px, {py * -6}px);"
      in:fly={{ y: 20, duration: 500 }}
    >
      <h2>{greeting}</h2>
      <span class="time">{time}</span>
    </div>

    <div
      class="tile temps"
      style="transform: translate({px * 4}px, {py * 4}px);"
      in:fly={{ y: 20, duration: 550 }}
    >
      <div class="tile-label">Kitchen Temps</div>
      <div class="node-strip">
        {#if nodeTemps.length === 0}
          <small>No recent nodes</small>
        {:else}
          {#each nodeTemps as node}
            <div class="node-pill">
              <strong>{node.nodeName ?? `N${node.sensorId}`}</strong>
              <span>{node.temperature.toFixed(1)}F</span>
            </div>
          {/each}
        {/if}
      </div>
      <div class="mini-graph">
        <TempGraph {series} height={40} />
      </div>
    </div>

    <div
      class="tile ideas"
      style="transform: translate({px * 8}px, {py * 8}px);"
      in:fly={{ y: 20, duration: 600 }}
    >
      <div class="tile-label">Top Ideas</div>
      {#if topIdeas.length === 0}
        <small>No whiteboard ideas yet.</small>
      {:else}
        {#each topIdeas as idea}
          <div class="idea">
            <span>{idea.text}</span>
            <small>{idea.votes}</small>
          </div>
        {/each}
      {/if}
    </div>
  </section>

  <section class="today-area">
    <h3>Today</h3>
    {#if todayTasks.length === 0}
      <p class="today-empty">No assigned or open tasks right now.</p>
    {:else}
      <ul class="today-list">
        {#each todayTasks as task}
          <li>
            <a href="/todo">{task.title}</a>
            <small>Assigned: {task.assigned_name ?? task.assigned_email ?? 'Anyone'}</small>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="dashboard" aria-label="Quick Access">
    <p class="section-label">Quick Access</p>
    <a href="/lists" class="card-link">
      <DashboardCard title="Lists" description="Prep lists, inventory, and orders" />
    </a>
    <a href="/todo" class="card-link">
      <DashboardCard title="ToDos" description="Track your tasks" />
    </a>
    <a href="/whiteboard" class="card-link">
      <DashboardCard title="Whiteboard" description="Notes and ideas" />
    </a>
    <a href="/temper" class="card-link">
      <DashboardCard title="Temps" description="Temperature logs" />
    </a>
  </section>
</Layout>

<style>
  .page-header { padding: 3rem 1rem 0.5rem; }
  .page-header h1 { margin: 0; font-size: 2.2rem; font-weight: var(--weight-semibold); letter-spacing: -0.03em; }
  .divider { height: 1px; background: var(--color-border); margin-top: 12px; opacity: .6; }
  .mosaic { display: grid; grid-template-columns: 1.2fr 1fr; grid-auto-rows: 110px; gap: 12px; padding: 1rem; }
  .tile { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 14px; display: flex; flex-direction: column; justify-content: center; transition: transform .25s ease, box-shadow .25s ease; }
  .tile:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); }
  .greeting { grid-row: span 2; }
  .greeting h2 { margin: 0; font-size: 1.5rem; }
  .time { margin-top: 6px; color: var(--color-text-muted); }
  .node-strip { display: flex; gap: 6px; flex-wrap: wrap; margin: 2px 0 6px; }
  .node-pill { display: inline-flex; gap: 6px; align-items: center; font-size: 0.72rem; border: 1px solid var(--color-border); border-radius: 999px; padding: 2px 7px; color: var(--color-text-muted); }
  .node-pill strong { color: var(--color-text); font-size: 0.7rem; }
  .mini-graph { width: 100%; height: 40px; margin-top: 6px; overflow: hidden; }
  .tile-label { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .08em; color: var(--color-text-muted); margin-bottom: 6px; }
  .idea { display: flex; justify-content: space-between; font-size: var(--text-sm); color: var(--color-text-muted); }
  .today-area { margin: 1rem; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); }
  .today-area h3 { margin: 0 0 0.5rem; font-size: var(--text-md); }
  .today-list { margin: 0; padding-left: 1rem; display: grid; gap: 0.35rem; }
  .today-list a { color: var(--color-text); text-decoration: none; }
  .today-list small { color: var(--color-text-muted); margin-left: 0.4rem; }
  .today-empty { margin: 0; color: var(--color-text-muted); font-size: var(--text-sm); }
  .dashboard { display: flex; flex-direction: column; gap: 1.1rem; padding-inline: 1rem; margin-top: 2rem; padding-bottom: 8rem; }
  .section-label { font-size: var(--text-sm); color: var(--color-text-muted); letter-spacing: .08em; text-transform: uppercase; }
  .card-link { text-decoration: none; display: block; }
</style>
