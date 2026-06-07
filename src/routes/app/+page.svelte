<script lang="ts">
  import { goto } from '$app/navigation';
  import Layout from '$lib/components/ui/Layout.svelte';
  import SchoolOfFish from '$lib/components/ui/SchoolOfFish.svelte';
  import TempGraph from '$lib/components/ui/TempGraph.svelte';
  import GuidedSpotlightTour from '$lib/components/ui/GuidedSpotlightTour.svelte';
  import { startVisiblePolling } from '$lib/client/polling';
  import { formatScheduleTimeLabel } from '$lib/assets/schedule';
  import { buildFeatureAccess, defaultAppFeatureModes, type AppFeatureAccess } from '$lib/features/appFeatures';
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
  type MenuDoc = { id: string; title: string; file_url: string | null };
  type DailySpecial = {
    category: string;
    label: string;
    content: string;
    updatedAt: number;
  };
  type EmployeeSpotlight = {
    employeeName: string;
    shoutout: string;
    updatedAt: number;
  };
  type TodayShift = {
    id: string;
    department: string;
    role: string;
    detail: string;
    startTime: string;
    endLabel: string;
    notes: string;
  };

  export let data: {
    isAdmin?: boolean;
    guided?: boolean;
    userName?: string;
    announcement?: { content: string; updatedAt: number };
    canEditAnnouncement?: boolean;
    employeeSpotlight?: EmployeeSpotlight;
    dailySpecials?: DailySpecial[];
    todayTasks?: HomeTask[];
    todaySchedule?: TodayShift[];
    todayMeta?: { assignedCount: number; unassignedCount: number };
    menuDocs?: MenuDoc[];
    topIdeas?: Idea[];
    nodeTemps?: NodeTemp[];
    tempSeries?: Record<string, number[]>;
    refreshedAt?: number;
    featureAccess?: AppFeatureAccess;
    businessName?: string;
  };
  type GuidedStep = {
    selector: string;
    title: string;
    description: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
  };

  let series: Record<string, number[]> = data.tempSeries ?? { avg: [] };
  let isAdmin = data.isAdmin ?? false;
  let guided = data.guided ?? false;
  let showGuidedTour = guided;
  let guidedSteps: GuidedStep[] = [];
  let time = '';
  let greeting = '';
  let businessName = data.businessName?.trim() || 'Crimini';
  let userName = data.userName ?? 'Team';
  let announcement = data.announcement ?? { content: '', updatedAt: 0 };
  let employeeSpotlight = data.employeeSpotlight ?? { employeeName: '', shoutout: '', updatedAt: 0 };
  let dailySpecials: DailySpecial[] = data.dailySpecials ?? [];
  let todayTasks: HomeTask[] = data.todayTasks ?? [];
  let todaySchedule: TodayShift[] = data.todaySchedule ?? [];
  let menuDocs: MenuDoc[] = data.menuDocs ?? [];
  let topIdeas: Idea[] = data.topIdeas ?? [];
  let nodeTemps: NodeTemp[] = data.nodeTemps ?? [];
  let todayMeta = data.todayMeta ?? { assignedCount: 0, unassignedCount: 0 };
  const featureAccess: AppFeatureAccess =
    data.featureAccess ?? buildFeatureAccess(defaultAppFeatureModes, isAdmin ? 'admin' : 'user');
  let lastIdeasRefresh = data.refreshedAt ?? Math.floor(Date.now() / 1000);
  const TEMP_WARNING_THRESHOLD = 42;
  const HOMEPAGE_TEMP_LIMIT = 240;

  const namesBySensor = new Map<number, string | null>(
    nodeTemps.map((node) => [node.sensorId, node.nodeName])
  );

  $: guidedSteps = [
    {
      selector: '[data-guide="home-brief"]',
      title: 'Service Header',
      description: 'Start every shift here for a quick service-state snapshot.',
      placement: 'bottom' as const
    },
    {
      selector: '[data-guide="shift-card"]',
      title: 'Shift + Announcements',
      description: 'This card keeps schedule details and active announcements visible in one place.',
      placement: 'bottom' as const
    },
    ...(featureAccess.daily_specials
      ? [{
          selector: '[data-guide="specials-focus"]',
          title: 'Daily Specials',
          description: 'Open this tile to review specials before service starts.',
          placement: 'top' as const
        }]
      : []),
    ...(featureAccess.temps
      ? [{
          selector: '[data-guide="temps-overview"]',
          title: 'Temperature Watch',
          description: 'Monitor live node readings and jump into detailed temperature logs when needed.',
          placement: 'top' as const
        }]
      : []),
    ...(featureAccess.whiteboard
      ? [{
          selector: '[data-guide="ideas-focus"]',
          title: 'Top Ideas',
          description: 'Team-submitted ideas with votes surface here so operations can act quickly.',
          placement: 'top' as const
        }]
      : []),
    ...(featureAccess.todo
      ? [{
          selector: '[data-guide="todo-focus"]',
          title: 'Today Task Queue',
          description: 'Work assigned tasks first, then pick up open tasks from the same section.',
          placement: 'top' as const
        }]
      : []),
    {
      selector: '[data-guide="quick-links"]',
      title: 'Quick Navigation',
      description: 'These cards are your fastest path to each core module during a shift.',
      placement: 'top' as const
    },
    ...(featureAccess.lists
      ? [{
          selector: '[data-guide="quick-lists"]',
          title: 'Lists Module',
          description: 'Checklists, prep lists, and inventory workflows begin here.',
          placement: 'top' as const
        }]
      : []),
    ...(featureAccess.todo
      ? [{
          selector: '[data-guide="quick-todo"]',
          title: 'ToDo Module',
          description: 'Open the full ToDo board for assignment, status, and completion tracking.',
          placement: 'top' as const
        }]
      : []),
    ...(featureAccess.whiteboard
      ? [{
          selector: '[data-guide="quick-whiteboard"]',
          title: 'Whiteboard Module',
          description: 'Use Whiteboard for suggestions, process ideas, and team feedback.',
          placement: 'top' as const
        }]
      : []),
    ...(featureAccess.temps
      ? [{
          selector: '[data-guide="quick-temps"]',
          title: 'Temps Module',
          description: 'Open full sensor history and records for compliance checks and audits.',
          placement: 'top' as const
        }]
      : [])
  ];

  function updateTime() {
    const now = new Date();
    time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const h = now.getHours();
    greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
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
    const response = await fetch('/api/whiteboard?limit=3');
    if (!response.ok) return;
    const rows = (await response.json()) as Array<{ content: string; votes: number }>;
    topIdeas = (rows ?? []).slice(0, 3).map((row) => ({ text: row.content, votes: row.votes }));
    lastIdeasRefresh = Math.floor(Date.now() / 1000);
  }

  async function clearGuidedQuery() {
    if (typeof window === 'undefined') return;
    const current = new URL(window.location.href);
    if (!current.searchParams.has('guided')) return;
    current.searchParams.delete('guided');
    const query = current.searchParams.toString();
    await goto(`${current.pathname}${query ? `?${query}` : ''}${current.hash}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true
    });
  }

  async function markGuidedTourComplete() {
    try {
      await fetch('?/complete_guided_tour', { method: 'POST' });
    } catch {
      // Best-effort save only; do not block UI close.
    }
  }

  async function handleGuidedTourClose() {
    showGuidedTour = false;
    await markGuidedTourComplete();
    await clearGuidedQuery();
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
  $: specialsSummary = activeSpecials.map((special) => special.preview).join('\n');

  onMount(() => {
    updateTime();
    const clock = setInterval(updateTime, 30000);
    const stopPolling = startVisiblePolling(
      async () => {
        const jobs: Promise<unknown>[] = [];
        if (featureAccess.temps) jobs.push(refreshTemps());
        if (featureAccess.whiteboard) jobs.push(refreshIdeas());
        if (jobs.length === 0) return;
        await Promise.all(jobs);
      },
      {
        intervalMs: 90000,
        maxIntervalMs: 5 * 60 * 1000,
        runImmediately: false,
        refreshOnVisible: true,
        jitterMs: 10000
      }
    );
    return () => {
      clearInterval(clock);
      stopPolling();
    };
  });
</script>

<Layout>
  {#if showGuidedTour}
    <GuidedSpotlightTour
      title="User First-Open Guide"
      steps={guidedSteps}
      on:finish={handleGuidedTourClose}
      on:dismiss={handleGuidedTourClose}
    />
  {/if}

  <section class="page-header" data-guide="home-brief">
    <h1>{greeting}</h1>
    <p class="header-sub">{businessName}</p>
    <span class="brief-rule" aria-hidden="true"></span>
  </section>

  <section
    class="mosaic"
    class:admin-mosaic={isAdmin}
    aria-label="Dashboard Tiles"
  >
    <div
      class="tile greeting"
      data-guide="shift-card"
    >
      <div class="greeting-main">
        <div class="greeting-copy">
          <h2>{userName}</h2>
          <span class="time">{time}</span>
        </div>
        {#if featureAccess.scheduling}
          <div class="announcement-block">
            <div class="shift-title-row">
              <span class="tile-label">Today's Shift</span>
              <img src="/crimini-mark.svg" alt="" aria-hidden="true" class="shift-crimini-icon" />
            </div>
            {#if todaySchedule.length === 0}
              <div class="shift-empty-state">
                <SchoolOfFish label="Have a good day!" />
              </div>
            {:else}
              <div class="shift-summary-list">
                {#each todaySchedule as shift}
                  <div class="shift-summary-row">
                    <strong>{shift.department} | {shift.role}</strong>
                    <span>
                      {#if shift.detail}{shift.detail} | {/if}{formatScheduleTimeLabel(shift.startTime)}{#if shift.endLabel} - {shift.endLabel}{/if}
                    </span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
      {#if featureAccess.announcements}
        <div class="shift-summary">
          <div class="announcement-copy">
            <div class="announcement-label-row">
              <span class="tile-label">Announcements</span>
              {#if data.canEditAnnouncement}
                <a href="/announcements">Edit</a>
              {/if}
            </div>
            {#if announcement.content}
              <p>{announcement.content}</p>
            {:else}
              <p class="announcement-empty">Nothing new right now.</p>
            {/if}
          </div>
        </div>
      {/if}
      {#if featureAccess.temps && highTempNodes.length > 0}
        <small class="alert">Alert: {highTempNodes.length} temp node(s) at or above {TEMP_WARNING_THRESHOLD}F</small>
      {/if}
    </div>

    {#if featureAccess.daily_specials}
    <a
      href="/specials"
      class="tile specials-card"
      data-guide="specials-focus"
    >
      <div class="tile-head">
        <span class="tile-label">Specials</span>
        <small>{activeSpecials.length} posted</small>
      </div>
      {#if activeSpecials.length === 0}
        <small class="specials-empty">No specials posted yet.</small>
      {:else}
        <p class="specials-summary">{specialsSummary}</p>
      {/if}
    </a>
    {/if}

    {#if featureAccess.menus}
    <a
      href="/menu"
      class="tile menu-card"
    >
      <div class="tile-head">
        <span class="tile-label menu-label">Menus</span>
        <small>{menuDocs.length} uploaded</small>
      </div>
      {#if menuDocs.length === 0}
        <small class="menu-empty">No menus posted yet.</small>
      {:else}
        <div class="menu-list">
          {#each menuDocs.slice(0, 3) as menu}
            <span>{menu.title}</span>
          {/each}
        </div>
      {/if}
    </a>
    {/if}

    {#if featureAccess.conversions}
    <a
      href="/conversions"
      class="tile conversion-card"
    >
      <div class="tile-head">
        <span class="tile-label">Conversions</span>
      </div>
      <strong>Kitchen measures</strong>
      <small>Quick chart + converter</small>
    </a>
    {/if}

    {#if featureAccess.employee_spotlight}
    <div
      class="tile employee-card"
    >
      <div class="tile-head employee-head">
        <div class="employee-title">
          <span class="material-icons spotlight-icon" aria-hidden="true">star</span>
          <span class="tile-label employee-label">Employee Spotlight</span>
        </div>
      </div>
      {#if employeeSpotlight.employeeName}
        <div class="employee-copy">
          <strong>{employeeSpotlight.employeeName}</strong>
          {#if employeeSpotlight.shoutout}
            <p>{employeeSpotlight.shoutout}</p>
          {/if}
        </div>
      {:else}
        <small class="employee-empty">No spotlight set yet.</small>
      {/if}
    </div>
    {/if}

    {#if featureAccess.temps}
    <div
      class="tile temps"
      data-guide="temps-overview"
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
    {/if}

    {#if featureAccess.whiteboard}
    <div
      class="tile ideas"
      data-guide="ideas-focus"
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
    {/if}

  </section>

  {#if featureAccess.todo}
  <section class="today-area" data-guide="todo-focus">
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
  {/if}

  <section class="dashboard" data-guide="quick-links" aria-label="Quick Access">
    <div class="section-row">
      <p class="section-label">Quick Access</p>
      <small class="section-muted">Core tools</small>
    </div>
    <div class="quick-link-grid">
      {#if featureAccess.lists}
        <a href="/lists" class="quick-link" data-guide="quick-lists">
          <span class="material-icons" aria-hidden="true">checklist</span>
          <strong>Lists</strong>
        </a>
      {/if}
      {#if featureAccess.todo}
        <a href="/todo" class="quick-link" data-guide="quick-todo">
          <span class="material-icons" aria-hidden="true">task_alt</span>
          <strong>ToDos</strong>
        </a>
      {/if}
      {#if featureAccess.whiteboard}
        <a href="/whiteboard" class="quick-link" data-guide="quick-whiteboard">
          <span class="material-icons" aria-hidden="true">tips_and_updates</span>
          <strong>Whiteboard</strong>
        </a>
      {/if}
      {#if featureAccess.temps}
        <a href="/temper" class="quick-link" data-guide="quick-temps">
          <span class="material-icons" aria-hidden="true">device_thermostat</span>
          <strong>Temps</strong>
        </a>
      {/if}
    </div>
  </section>
</Layout>

<style>
  .page-header { padding: 3rem 1rem 0.5rem; }
  .page-header h1 { margin: 0; font-size: 2.2rem; font-weight: var(--weight-semibold); letter-spacing: -0.03em; }
  .header-sub { margin: 0.35rem 0 0; color: var(--color-text-muted); font-size: 0.9rem; }
  .brief-rule {
    display: block;
    width: min(100%, 560px);
    height: 1px;
    margin-top: 1rem;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--color-text) 34%, transparent),
      color-mix(in srgb, var(--color-text) 12%, transparent) 58%,
      transparent
    );
  }

  .mosaic {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    grid-auto-rows: minmax(118px, auto);
    gap: 0;
    padding: 1rem;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }
  .tile {
    background: transparent;
    border: 0;
    border-right: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    box-shadow: none;
    transition:
      border-color 160ms var(--ease-out),
      background 160ms var(--ease-out);
  }
  .tile:nth-child(even) {
    border-right: 0;
  }
  .tile:hover {
    background: color-mix(in srgb, var(--color-surface-alt) 34%, transparent);
    border-color: var(--color-divider);
  }
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
  .shift-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .shift-crimini-icon {
    width: 1.9rem;
    height: 1.9rem;
    object-fit: contain;
    filter: brightness(0) saturate(100%) invert(13%) sepia(8%) saturate(747%) hue-rotate(169deg) brightness(92%) contrast(91%);
    opacity: 0.72;
    flex: 0 0 auto;
  }

  :global([data-theme='dark']) .shift-crimini-icon {
    filter:
      brightness(0) saturate(100%) invert(94%) sepia(8%) saturate(369%) hue-rotate(307deg) brightness(104%) contrast(92%);
    opacity: 0.96;
  }
  .announcement-block :global(p) {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.84rem;
    line-height: 1.45;
  }
  .announcement-empty {
    opacity: 0.85;
  }
  .announcement-copy {
    display: grid;
    gap: 0.35rem;
  }
  .announcement-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
  }
  .announcement-label-row a {
    color: var(--color-text);
    font-size: 0.72rem;
    font-weight: var(--weight-semibold);
    text-decoration: none;
  }
  .shift-summary {
    display: grid;
    gap: 0.35rem;
    margin-top: 0.9rem;
    padding-top: 0.8rem;
    border-top: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  }
  .shift-summary-list {
    display: grid;
    gap: 0.32rem;
  }
  .shift-summary-row {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: start;
    font-size: 0.8rem;
  }
  .shift-summary-row strong {
    color: var(--color-text);
    font-size: 0.8rem;
  }
  .shift-summary-row span {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.4;
  }
  .shift-empty-state {
    display: grid;
    justify-items: start;
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
    gap: 0.65rem;
    min-height: 0;
  }
  .employee-card {
    gap: 0.6rem;
    min-height: 0;
  }
  .employee-head {
    justify-content: flex-start;
  }
  .employee-title {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .employee-label {
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.02em;
    text-transform: none;
    color: var(--color-text);
  }
  .spotlight-icon {
    color: var(--color-text-muted);
    font-size: 1.05rem;
    line-height: 1;
    flex: 0 0 auto;
  }
  .employee-copy {
    display: grid;
    gap: 0.28rem;
  }
  .employee-copy strong {
    font-size: 0.98rem;
    color: var(--color-text);
  }
  .employee-copy p,
  .employee-empty {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    line-height: 1.4;
  }
  .specials-summary {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.84rem;
    line-height: 1.4;
    white-space: pre-line;
    overflow-wrap: anywhere;
    display: -webkit-box;
    line-clamp: 4;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .alert { margin-top: 0.35rem; color: color-mix(in srgb, var(--color-error) 76%, var(--color-text)); font-size: 0.78rem; }
  .specials-empty {
    color: var(--color-text-muted);
  }

  .tile-head { display: flex; justify-content: space-between; align-items: center; gap: 0.35rem; }
  .tile-head small { color: var(--color-text-muted); font-size: 0.72rem; }
  .node-strip { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0; }
  .node-pill { display: inline-flex; gap: 6px; align-items: center; font-size: 0.72rem; border: 1px solid var(--color-success); border-radius: 0; padding: 2px 7px; color: var(--color-success); }
  .node-pill.warn { border-color: var(--color-error); color: var(--color-error); }
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
    color: var(--color-error);
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
  .menu-list {
    display: grid;
    gap: 0.28rem;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    line-height: 1.25;
  }
  .menu-list span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .menu-empty {
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }
  .idea { display: flex; justify-content: space-between; font-size: var(--text-sm); color: var(--color-text-muted); }
  .conversion-card {
    gap: 0.22rem;
    color: var(--color-text);
    text-decoration: none;
  }
  .conversion-card strong {
    font-size: 1rem;
    line-height: 1.18;
  }
  .conversion-card small {
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }
  .today-area {
    margin: 1rem;
    padding: 0.85rem 0;
    border: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  .today-head { display: flex; justify-content: space-between; align-items: center; gap: 0.7rem; margin-bottom: 0.5rem; }
  .today-head h3 { margin: 0; font-size: var(--text-md); }
  .today-head small { color: var(--color-text-muted); font-size: 0.78rem; }
  .today-list { margin: 0; padding-left: 1rem; display: grid; gap: 0.35rem; }
  .today-list li { line-height: 1.35; }
  .today-list a { color: var(--color-text); text-decoration: none; }
  .today-list small { color: var(--color-text-muted); margin-left: 0.4rem; }
  .today-empty { margin: 0; color: var(--color-text-muted); font-size: var(--text-sm); }

  .dashboard {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    padding-inline: 1rem;
    margin-top: 1.2rem;
    padding-bottom: 8rem;
  }
  .section-row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.7rem;
    width: min(100%, 540px);
  }
  .section-label { font-size: var(--text-sm); color: var(--color-text-muted); letter-spacing: .08em; text-transform: uppercase; margin: 0; }
  .section-muted { color: var(--color-text-muted); font-size: 0.76rem; }
  .quick-link-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(14rem, 1fr));
    justify-content: center;
    gap: 0;
    width: min(100%, 720px);
    padding: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }
  .quick-link {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    justify-content: start;
    gap: 0.72rem;
    min-height: 4.6rem;
    padding: 0.95rem 1rem;
    color: var(--color-text);
    text-decoration: none;
    border: 0;
    border-right: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    transition:
      border-color 160ms var(--ease-out),
      background 160ms var(--ease-out),
      transform 160ms var(--ease-out);
  }
  .quick-link:nth-child(even) {
    border-right: 0;
  }
  .quick-link:nth-last-child(-n + 2) {
    border-bottom: 0;
  }
  .quick-link:hover,
  .quick-link:focus-visible {
    background: color-mix(in srgb, var(--color-surface-alt) 42%, transparent);
    color: var(--color-text);
    transform: none;
    outline: none;
  }
  .quick-link .material-icons {
    color: var(--color-text-muted);
    font-size: 1.25rem;
    line-height: 1;
  }
  .quick-link strong {
    font-size: 0.95rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.01em;
  }

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

    .mosaic {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: minmax(108px, auto);
      gap: 0;
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
      border: 0;
      border-bottom: 1px solid var(--color-divider);
      border-radius: 0;
      padding: 0.45rem 0;
      background: transparent;
      display: grid;
      gap: 0.16rem;
    }
    .today-list small {
      margin-left: 0;
    }
    .shift-summary-row {
      flex-direction: column;
      gap: 0.12rem;
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
    .quick-link-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      width: 100%;
    }
    .quick-link {
      min-height: 4.3rem;
      padding: 0.82rem 0.78rem;
    }
  }

  @media (max-width: 430px) {
    .page-header h1 {
      font-size: 1.42rem;
    }
    .section-muted {
      display: none;
    }
    .quick-link-grid {
      grid-template-columns: 1fr;
    }
    .quick-link {
      border-right: 0;
    }
    .quick-link:nth-last-child(-n + 2) {
      border-bottom: 1px solid var(--color-divider);
    }
    .quick-link:last-child {
      border-bottom: 0;
    }
    .greeting-main {
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
      gap: 0.6rem;
    }
    .announcement-block {
      padding-left: 0.6rem;
    }
  }

  @media (max-width: 430px) {
    .tile {
      border-right: 0;
    }
  }
</style>



