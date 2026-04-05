<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import TempGraph from '$lib/components/ui/TempGraph.svelte';
  import { startVisiblePolling } from '$lib/client/polling';
  import { fly, fade } from 'svelte/transition';
  import { onMount } from 'svelte';

  type HomeTask = {
    id: string;
    title: string;
    description: string | null;
    assigned_to: string | null;
    assigned_name: string | null;
    assigned_email: string | null;
  };
  type Idea = { text: string; votes: number };
  type NodeTemp = { sensorId: number; nodeName: string | null; temperature: number; ts: number };
  type DailySpecial = {
    category: 'roll' | 'nigiri' | 'sashimi' | 'kitchen';
    label: string;
    content: string;
    updatedAt: number;
  };

  export let data: {
    isAdmin?: boolean;
    userName?: string;
    announcement?: { content: string; updatedAt: number };
    dailySpecials?: DailySpecial[];
    todayTasks?: HomeTask[];
    todayMeta?: { assignedCount: number; unassignedCount: number };
    topIdeas?: Idea[];
    nodeTemps?: NodeTemp[];
    tempSeries?: Record<string, number[]>;
    refreshedAt?: number;
  };

  let series: Record<string, number[]> = data.tempSeries ?? { avg: [] };
  let isAdmin = data.isAdmin ?? false;
  let time = '';
  let greeting = '';
  let topGreeting = '';
  let userName = data.userName ?? 'Team';
  let announcement = data.announcement ?? { content: '', updatedAt: 0 };
  let dailySpecials: DailySpecial[] = data.dailySpecials ?? [];
  let todayTasks: HomeTask[] = data.todayTasks ?? [];
  let topIdeas: Idea[] = data.topIdeas ?? [];
  let nodeTemps: NodeTemp[] = data.nodeTemps ?? [];
  let todayMeta = data.todayMeta ?? { assignedCount: 0, unassignedCount: 0 };
  let lastIdeasRefresh = data.refreshedAt ?? Math.floor(Date.now() / 1000);
  let px = 0;
  let py = 0;
  const TEMP_WARNING_THRESHOLD = 42;
  const HOMEPAGE_TEMP_LIMIT = 480;

  const namesBySensor = new Map<number, string | null>(
    nodeTemps.map((node) => [node.sensorId, node.nodeName])
  );

  function updateTime() {
    const now = new Date();
    time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const h = now.getHours();
    greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    topGreeting = h < 12 ? 'おはよう' : h < 18 ? 'こんにちは' : 'こんばんは';
  }

  function handleMove(e: MouseEvent | TouchEvent) {
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    px = x / window.innerWidth - 0.5;
    py = y / window.innerHeight - 0.5;
  }

  function secondsAgoLabel(unixTs: number) {
    const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixTs);
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  function buildTempState(rows: Array<{ sensor_id: number; temperature: number; ts: number }>) {
    const latestBySensor = new Map<number, { sensor_id: number; temperature: number; ts: number }>();
    for (const row of rows) {
      if (!latestBySensor.has(row.sensor_id)) {
        latestBySensor.set(row.sensor_id, row);
        if (latestBySensor.size >= 3) break;
      }
    }

    nodeTemps = Array.from(latestBySensor.values())
      .sort((a, b) => a.sensor_id - b.sensor_id)
      .map((row) => ({
        sensorId: row.sensor_id,
        nodeName: namesBySensor.get(row.sensor_id) ?? null,
        temperature: row.temperature,
        ts: row.ts
      }));

    const buckets = new Map<number, { sum: number; count: number }>();
    for (const row of rows) {
      const bucket = Math.floor(row.ts / 300) * 300;
      const current = buckets.get(bucket) ?? { sum: 0, count: 0 };
      current.sum += row.temperature;
      current.count += 1;
      buckets.set(bucket, current);
    }
    series = {
      avg: Array.from(buckets.entries())
        .sort((a, b) => a[0] - b[0])
        .slice(-24)
        .map(([, value]) => Number((value.sum / value.count).toFixed(2)))
    };
  }

  async function refreshTemps() {
    const response = await fetch(`/api/temps?limit=${HOMEPAGE_TEMP_LIMIT}`);
    if (!response.ok) return;
    const rows = (await response.json()) as Array<{ sensor_id: number; temperature: number; ts: number }>;
    if (!rows?.length) return;
    buildTempState(rows);
  }

  async function refreshIdeas() {
    const response = await fetch('/api/whiteboard');
    if (!response.ok) return;
    const rows = (await response.json()) as Array<{ content: string; votes: number }>;
    topIdeas = (rows ?? []).slice(0, 3).map((row) => ({ text: row.content, votes: row.votes }));
    lastIdeasRefresh = Math.floor(Date.now() / 1000);
  }

  $: latestTempTs = nodeTemps.length ? Math.max(...nodeTemps.map((node) => node.ts)) : 0;
  $: tempFreshText = latestTempTs ? secondsAgoLabel(latestTempTs) : 'no data';
  $: ideasFreshText = secondsAgoLabel(lastIdeasRefresh);
  $: highTempNodes = nodeTemps.filter((node) => node.temperature >= TEMP_WARNING_THRESHOLD);
  $: activeSpecials = dailySpecials
    .filter((special) => special.content.trim().length > 0)
    .map((special) => ({
      ...special,
      preview: special.content.trim()
    }));

  onMount(() => {
    updateTime();
    const clock = setInterval(updateTime, 1000);
    const stopPolling = startVisiblePolling(
      () => Promise.all([refreshTemps(), refreshIdeas()]).then(() => undefined),
      { intervalMs: 60000, runImmediately: false, refreshOnVisible: true }
    );
    return () => {
      clearInterval(clock);
      stopPolling();
    };
  });
</script>

<Layout>
  <section class="page-header" in:fly={{ y: 20, duration: 500 }}>
    <h1>{topGreeting}, {userName}</h1>
    <p class="header-sub">Here's what's happening today</p>
    <img class="divider" src="/knife-divider.svg" alt="" aria-hidden="true" />
  </section>

  <section
    class="mosaic"
    class:admin-mosaic={isAdmin}
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
      <div class="greeting-main">
        <div class="greeting-copy">
          <h2>{greeting}</h2>
          <span class="time">{time}</span>
        </div>
        <div class="announcement-block">
          <span class="tile-label">Announcements</span>
          {#if announcement.content}
            <p>{announcement.content}</p>
          {:else}
            <p class="announcement-empty">Nothing new right now.</p>
          {/if}
        </div>
      </div>
      {#if highTempNodes.length > 0}
        <small class="alert">Alert: {highTempNodes.length} temp node(s) at or above {TEMP_WARNING_THRESHOLD}F</small>
      {/if}
    </div>

    <a
      href="/specials"
      class="tile specials-card"
      style="transform: translate({px * 2}px, {py * 2}px);"
      in:fly={{ y: 20, duration: 525 }}
    >
      <div class="tile-head">
        <span class="tile-label">Daily Specials</span>
        <small>{activeSpecials.length} posted</small>
      </div>
      {#if activeSpecials.length === 0}
        <small class="specials-empty">No specials up yet.</small>
      {:else}
        <div class="specials-list">
          {#each activeSpecials as special}
            <div class="special-row">
              <strong>{special.label}</strong>
              <span>{special.preview}</span>
            </div>
          {/each}
        </div>
      {/if}
    </a>

    <a
      href="/menu"
      class="tile menu-card"
      style="transform: translate({px * 3}px, {py * 3}px);"
      in:fly={{ y: 20, duration: 540 }}
    >
      <div class="tile-head">
        <span class="tile-label menu-label">Main &amp; Secret Menu</span>
        <small>pdfs</small>
      </div>
    </a>

    <div
      class="tile temps"
      style="transform: translate({px * 4}px, {py * 4}px);"
      in:fly={{ y: 20, duration: 550 }}
    >
      <div class="tile-head">
        <span class="tile-label">Kitchen Temps</span>
        <small>updated {tempFreshText}</small>
      </div>
      <div class="node-strip">
        {#if nodeTemps.length === 0}
          <small>No recent nodes</small>
        {:else}
          {#each nodeTemps as node}
            <div class="node-pill" class:warn={node.temperature >= TEMP_WARNING_THRESHOLD}>
              <strong>{node.nodeName ?? `N${node.sensorId}`}</strong>
              <span>{node.temperature.toFixed(1)}F</span>
            </div>
          {/each}
        {/if}
      </div>
      {#if highTempNodes.length > 0}
        <div class="temp-warnings">
          {#each highTempNodes as node}
            <a href="/temper" class="temp-warning-line">
              <strong>{node.nodeName ?? `Node ${node.sensorId}`}</strong>
              <span>{node.temperature.toFixed(1)}F</span>
            </a>
          {/each}
        </div>
      {/if}
      <div class="mini-graph">
        <TempGraph {series} height={40} />
      </div>
    </div>

    <div
      class="tile ideas"
      style="transform: translate({px * 8}px, {py * 8}px);"
      in:fly={{ y: 20, duration: 600 }}
    >
      <div class="tile-head">
        <span class="tile-label">Top Ideas</span>
        <small>updated {ideasFreshText}</small>
      </div>
      {#if topIdeas.length === 0}
        <small>No ideas posted.</small>
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
    <div class="today-head">
      <h3>Today</h3>
      <small>{todayMeta.assignedCount} assigned | {todayMeta.unassignedCount} open</small>
    </div>
    {#if todayTasks.length === 0}
      <p class="today-empty">Nothing assigned right now.</p>
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
    <div class="section-row">
      <p class="section-label">Quick Access</p>
      <small class="section-muted">Tap a card to continue</small>
    </div>
    <a href="/lists" class="card-link">
      <DashboardCard title="Lists" />
    </a>
    <a href="/todo" class="card-link">
      <DashboardCard title="ToDos" />
    </a>
    <a href="/whiteboard" class="card-link">
      <DashboardCard title="Whiteboard" />
    </a>
    <a href="/temper" class="card-link">
      <DashboardCard title="Temps" />
    </a>
    {#if isAdmin}
      <a href="/meeting-notes" class="card-link">
        <DashboardCard title="Meeting Notes" />
      </a>
    {/if}
  </section>
</Layout>

<style>
  .page-header { padding: 3rem 1rem 0.5rem; }
  .page-header h1 { margin: 0; font-size: 2.2rem; font-weight: var(--weight-semibold); letter-spacing: -0.03em; }
  .header-sub { margin: 0.35rem 0 0; color: var(--color-text-muted); font-size: 0.9rem; }
  .divider {
    display: block;
    width: 112px;
    height: auto;
    margin-top: -6px;
    margin-left: 1.35rem;
    transform: rotate(45deg);
    transform-origin: left center;
    filter:
      brightness(0) saturate(100%) invert(95%) sepia(12%) saturate(308%) hue-rotate(296deg) brightness(111%) contrast(94%)
      drop-shadow(0 2px 8px rgba(195, 32, 43, 0.18));
    opacity: 0.98;
  }

  .mosaic { display: grid; grid-template-columns: 1.2fr 1fr; grid-auto-rows: 118px; gap: 12px; padding: 1rem; }
  .tile { background: linear-gradient(160deg, color-mix(in srgb, var(--color-surface) 88%, var(--color-primary) 12%), var(--color-surface)); border: 1px solid color-mix(in srgb, var(--color-border) 75%, transparent); border-radius: var(--radius-lg); padding: 14px; display: flex; flex-direction: column; justify-content: center; transition: transform .25s ease, box-shadow .25s ease, border-color .2s ease; }
  .tile:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); }
  .greeting { grid-row: span 2; }
  .greeting-main {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 0.85rem;
    align-items: start;
  }
  .greeting-copy {
    display: grid;
    gap: 0.3rem;
    align-content: start;
  }
  .greeting h2 { margin: 0; font-size: 1.5rem; }
  .time { color: var(--color-text-muted); }
  .announcement-block {
    display: grid;
    gap: 0.35rem;
    align-content: start;
    padding-left: 0.85rem;
    border-left: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  }
  .announcement-block p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.84rem;
    line-height: 1.45;
  }
  .announcement-empty {
    opacity: 0.85;
  }
  .specials-list {
    display: grid;
    gap: 0.35rem;
  }
  .specials-card {
    text-decoration: none;
    color: inherit;
    gap: 0.7rem;
    min-height: 0;
  }
  .menu-card {
    text-decoration: none;
    color: inherit;
    gap: 0.55rem;
    min-height: 0;
  }
  .special-row {
    display: grid;
    grid-template-columns: 4.8rem 1fr;
    gap: 0.5rem;
    align-items: start;
    font-size: 0.76rem;
  }
  .special-row strong {
    color: var(--color-text);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .special-row span {
    color: var(--color-text-muted);
    line-height: 1.35;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .alert { margin-top: 0.35rem; color: #fca5a5; font-size: 0.78rem; }
  .specials-empty {
    color: var(--color-text-muted);
  }

  .tile-head { display: flex; justify-content: space-between; align-items: center; gap: 0.35rem; }
  .tile-head small { color: var(--color-text-muted); font-size: 0.72rem; }
  .node-strip { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0; }
  .node-pill { display: inline-flex; gap: 6px; align-items: center; font-size: 0.72rem; border: 1px solid var(--color-border); border-radius: 999px; padding: 2px 7px; color: var(--color-text-muted); }
  .node-pill.warn { border-color: #f59e0b; color: #f59e0b; }
  .node-pill strong { color: var(--color-text); font-size: 0.7rem; }
  .temp-warnings {
    display: grid;
    gap: 0.28rem;
    margin-top: 0.35rem;
  }
  .temp-warning-line {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    text-decoration: none;
    color: #fecaca;
    font-size: 0.76rem;
    line-height: 1.25;
  }
  .temp-warning-line strong {
    font-weight: var(--weight-semibold);
  }
  .mini-graph { width: 100%; height: 40px; margin-top: 4px; overflow: hidden; }
  .tile-label { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .08em; color: var(--color-text-muted); }
  .menu-label {
    font-family: inherit;
    font-size: 0.92rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.02em;
    text-transform: none;
    color: var(--color-text);
  }
  .idea { display: flex; justify-content: space-between; font-size: var(--text-sm); color: var(--color-text-muted); }
  .today-area { margin: 1rem; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background:
      linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 7%, transparent), transparent 35%),
      var(--color-surface); }
  .today-head { display: flex; justify-content: space-between; align-items: center; gap: 0.7rem; margin-bottom: 0.5rem; }
  .today-head h3 { margin: 0; font-size: var(--text-md); }
  .today-head small { color: var(--color-text-muted); font-size: 0.78rem; }
  .today-list { margin: 0; padding-left: 1rem; display: grid; gap: 0.35rem; }
  .today-list li { line-height: 1.35; }
  .today-list a { color: var(--color-text); text-decoration: none; }
  .today-list small { color: var(--color-text-muted); margin-left: 0.4rem; }
  .today-empty { margin: 0; color: var(--color-text-muted); font-size: var(--text-sm); }

  .dashboard { display: flex; flex-direction: column; gap: 1.1rem; padding-inline: 1rem; margin-top: 1.2rem; padding-bottom: 8rem; }
  .dashboard :global(.card) {
    border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 6%, transparent), transparent 45%),
      var(--color-surface);
  }
  .section-row { display: flex; justify-content: space-between; align-items: center; gap: 0.7rem; }
  .section-label { font-size: var(--text-sm); color: var(--color-text-muted); letter-spacing: .08em; text-transform: uppercase; margin: 0; }
  .section-muted { color: var(--color-text-muted); font-size: 0.76rem; }
  .card-link { text-decoration: none; display: block; }

  @media (max-width: 760px) {
    .page-header {
      padding: 1.35rem 0.9rem 0.4rem;
    }
    .page-header h1 {
      font-size: 1.55rem;
      line-height: 1.15;
    }
    .header-sub {
      font-size: 0.82rem;
    }

    .divider {
      width: 92px;
      margin-top: -5px;
      margin-left: 1rem;
    }
    .mosaic {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: minmax(108px, auto);
      gap: 10px;
      padding: 0.85rem 0.9rem;
    }
    .greeting {
      grid-column: 1 / -1;
      grid-row: auto;
    }
    .greeting-main {
      grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
      gap: 0.7rem;
    }
    .specials-card,
    .menu-card,
    .ideas {
      min-height: 0;
      align-self: stretch;
    }
    .tile {
      padding: 12px;
      min-height: 108px;
    }
    .greeting h2 {
      font-size: 1.25rem;
    }
    .announcement-block {
      padding-left: 0.7rem;
    }
    .special-row {
      grid-template-columns: 4.2rem 1fr;
    }
    .tile-head {
      flex-wrap: wrap;
      row-gap: 0.2rem;
    }
    .tile-head small {
      font-size: 0.68rem;
    }
    .node-pill {
      font-size: 0.68rem;
      padding: 2px 6px;
    }
    .today-area {
      margin: 0.9rem;
      padding: 0.7rem;
    }
    .today-head {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.25rem;
    }
    .today-list {
      list-style: none;
      padding-left: 0;
      gap: 0.45rem;
    }
    .today-list li {
      border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
      border-radius: 10px;
      padding: 0.45rem 0.55rem;
      background: color-mix(in srgb, var(--color-surface) 92%, var(--color-primary) 8%);
      display: grid;
      gap: 0.16rem;
    }
    .today-list small {
      margin-left: 0;
    }
    .dashboard {
      gap: 0.85rem;
      margin-top: 0.85rem;
      padding-inline: 0.9rem;
      padding-bottom: 6.5rem;
    }
    .section-row {
      flex-wrap: wrap;
      row-gap: 0.2rem;
    }
  }

  @media (max-width: 430px) {
    .page-header h1 {
      font-size: 1.42rem;
    }
    .section-muted {
      display: none;
    }
    .greeting-main {
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
      gap: 0.6rem;
    }
    .announcement-block {
      padding-left: 0.6rem;
    }
    .special-row {
      grid-template-columns: 1fr;
      gap: 0.18rem;
    }
  }

  @media (hover: none) {
    .tile,
    .tile:hover {
      transform: none !important;
    }
  }
</style>

