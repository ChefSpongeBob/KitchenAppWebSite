<script lang="ts">
  import StaffActivityChart from '#lib/components/staff/StaffActivityChart.svelte';
  import type { PageData } from './$types';
  export let data: PageData;
  $: overview = data.overview;
  $: attentionGroups = overview.groups.filter(item => item.kind === 'server_error').slice(0, 4);
  $: supportTotal = overview.support ? overview.support.open + overview.support.waiting : 0;
  $: gatewayStates = [
    { label: 'Online', count: overview.gateways.online, tone: 'online' },
    { label: 'Offline', count: overview.gateways.offline, tone: 'offline' },
    { label: 'Not connected', count: overview.gateways.unconnected, tone: 'unconnected' },
    { label: 'Timestamp issues', count: overview.gateways.timestampIssues, tone: 'timestamp' }
  ];
  $: workspaces = [
    { label: 'Businesses', href: '/staff/businesses', icon: 'domain' },
    ...(overview.canViewApplication ? [{ label: 'Support', href: '/staff/support', icon: 'support_agent' }] : []),
    { label: 'Equipment', href: '/staff/equipment', icon: 'router' },
    { label: 'System Health', href: '/staff/health', icon: 'monitor_heart' },
    ...(data.staff.role === 'owner' ? [
      { label: 'Staff', href: '/staff/team', icon: 'manage_accounts' },
      { label: 'Activity', href: '/staff/activity', icon: 'history' }
    ] : []),
    { label: 'Security', href: '/staff/security', icon: 'verified_user' }
  ];
  const healthUrl = (view: string, extra: Record<string, string> = {}) => `/staff/health?${new URLSearchParams({ view, hours: String(overview.hours), ...extra })}`;
</script>

<svelte:head><title>Operations Dashboard | Crimini Staff</title></svelte:head>

<div class="staff-dashboard">
  <header class="board-heading">
    <div><span class="board-kicker">Crimini Operations</span><h1>Dashboard</h1></div>
    <form action="/staff/businesses" method="GET" class="business-search">
      <label for="staff-find-business" class="visually-hidden">Find business</label>
      <span class="material-icons" aria-hidden="true">search</span><input id="staff-find-business" name="q" maxlength="80" placeholder="Find a business" /><button type="submit">Search</button>
    </form>
    <form method="GET" class="board-period">
      {#if overview.canViewApplication}<label for="staff-window" class="visually-hidden">Analytics period</label><select id="staff-window" name="hours" value={String(overview.hours)}><option value="1">This hour</option><option value="24">24 hours</option><option value="168">7 days</option></select>{/if}
      <button type="submit"><span class="material-icons" aria-hidden="true">refresh</span>Refresh</button>
    </form>
  </header>

  <dl class="board-snapshot">
    <div><dt><span class="material-icons" aria-hidden="true">domain</span>Active Businesses</dt><dd><a href="/staff/businesses">{overview.activeBusinesses}</a></dd><small>Across Crimini</small></div>
    <div><dt><span class="material-icons" aria-hidden="true">radar</span>Affected Businesses</dt><dd>{overview.affectedBusinesses}</dd><small>Recorded issues / equipment</small></div>
    {#if overview.support}<div><dt><span class="material-icons" aria-hidden="true">forum</span>Active Support</dt><dd><a href="/staff/support">{supportTotal}</a></dd><small>{overview.support.urgent} urgent</small></div>{/if}
    <div><dt><span class="material-icons" aria-hidden="true">sensors</span>Gateway Attention</dt><dd class:has-issue={overview.gateways.attention > 0}><a href={healthUrl('equipment')}>{overview.gateways.attention}</a></dd><small>{overview.gateways.total} registered</small></div>
  </dl>

  <div class="board-main" class:equipment-only={!overview.canViewApplication}>
    {#if overview.metrics}
      <section class="board-module analytics-module" aria-labelledby="staff-analytics-title">
        <header class="module-heading"><div><span class="board-kicker">Application Analytics</span><h2 id="staff-analytics-title">Failures & Tenant Impact</h2></div><a href={healthUrl('application', { kind: 'server_error' })}>Investigate<span class="material-icons" aria-hidden="true">north_east</span></a></header>
        <div class="analytics-totals">
          <div><strong class="failure-value">{overview.metrics.errors}</strong><span>Recorded failures</span></div>
          <div><strong>{overview.metrics.slow}</strong><span>Slow responses</span></div>
          <div><strong>{overview.metrics.averageMs ?? '--'}<small> ms</small></strong><span>Sampled response time</span></div>
        </div>
        <StaffActivityChart points={overview.trend} hours={overview.hours} since={overview.since} checkedAt={overview.checkedAt} />
      </section>
    {/if}

    <aside class="board-module attention-module" aria-labelledby="staff-attention-title">
      <header class="module-heading"><div><span class="board-kicker">Triage</span><h2 id="staff-attention-title">Needs Attention</h2></div><span class="material-icons attention-symbol" aria-hidden="true">adjust</span></header>
      <div class="attention-list">
        {#each attentionGroups as item}
          <a class="attention-item" href={healthUrl('application', { area: item.area, kind: item.kind })}><span class="signal-icon material-icons" aria-hidden="true">error_outline</span><span><strong>{item.areaLabel}</strong><small>Recorded failures</small></span><span class="attention-count">{item.businesses}<small>tenants</small></span></a>
        {/each}
        {#if overview.gateways.attention}<a class="attention-item" href={healthUrl('equipment')}><span class="signal-icon material-icons" aria-hidden="true">wifi_off</span><span><strong>Gateway Contact</strong><small>{overview.gateways.attention} gateways</small></span><span class="attention-count">{overview.gateways.businesses}<small>tenants</small></span></a>{/if}
        {#if overview.delivery?.failed}<a class="attention-item" href={healthUrl('delivery')}><span class="signal-icon material-icons" aria-hidden="true">notification_important</span><span><strong>Notification Failures</strong><small>{overview.delivery.failed} queued events</small></span><span class="attention-count">{overview.delivery.businesses}<small>tenants</small></span></a>{/if}
        {#if !attentionGroups.length && !overview.gateways.attention && !overview.delivery?.failed}<div class="module-empty"><span class="material-icons" aria-hidden="true">done_all</span><strong>No matching issues recorded</strong></div>{/if}
      </div>
      {#if overview.metrics}<a class="access-summary" href={healthUrl('application', { kind: 'access_denied' })}><span class="material-icons" aria-hidden="true">shield</span><span>Recorded access denials</span><strong>{overview.metrics.denials}</strong></a>{/if}
    </aside>
  </div>

  <div class="board-secondary" class:equipment-only={!overview.support}>
    <section class="board-module equipment-module" aria-labelledby="staff-equipment-title">
      <header class="module-heading"><div><span class="board-kicker">Equipment</span><h2 id="staff-equipment-title">Gateway Connections</h2></div><a href={healthUrl('equipment')}>View Equipment<span class="material-icons" aria-hidden="true">north_east</span></a></header>
      <div class="equipment-summary"><strong>{overview.gateways.online}<span> / {overview.gateways.total}</span></strong><span><i class="online-dot"></i>Online now</span></div>
      {#if overview.gateways.total}
        <div class="connection-bar" aria-hidden="true">{#each gatewayStates as state}{#if state.count}<span class={state.tone} style:width={`${state.count / overview.gateways.total * 100}%`}></span>{/if}{/each}</div>
        <div class="connection-legend">{#each gatewayStates as state}{#if state.count || state.tone === 'online' || state.tone === 'offline'}<span><i class={state.tone}></i>{state.label}<strong>{state.count}</strong></span>{/if}{/each}</div>
      {:else}<p class="module-note">No registered gateways.</p>{/if}
    </section>
    {#if overview.support}
      <section class="board-module support-module" aria-labelledby="staff-support-title">
        <header class="module-heading"><div><span class="board-kicker">Customer Support</span><h2 id="staff-support-title">Workload</h2></div><a href="/staff/support">Open Queue<span class="material-icons" aria-hidden="true">north_east</span></a></header>
        <div class="support-counts"><a href="/staff/support?status=open"><strong>{overview.support.open}</strong><span>Open</span></a><a href="/staff/support?status=waiting"><strong>{overview.support.waiting}</strong><span>Waiting</span></a><a class:has-issue={overview.support.urgent > 0} href="/staff/support?priority=urgent"><strong>{overview.support.urgent}</strong><span>Urgent</span></a></div>
        {#if supportTotal}<div class="support-bar" aria-hidden="true"><span class="support-open" style:width={`${overview.support.open / supportTotal * 100}%`}></span><span class="support-waiting" style:width={`${overview.support.waiting / supportTotal * 100}%`}></span></div>{/if}
        <a class="record-request" href="/staff/support?new=1"><span class="material-icons" aria-hidden="true">add</span>Record Request</a>
      </section>
    {/if}
  </div>

  <section class="board-workspaces" aria-labelledby="staff-workspaces-title">
    <header><h2 id="staff-workspaces-title">Quick Access</h2><span>Staff workspaces</span></header>
    <nav class="workspace-tabs" aria-label="Quick access workspaces">{#each workspaces as workspace}<a href={workspace.href}><span class="material-icons" aria-hidden="true">{workspace.icon}</span><strong>{workspace.label}</strong><span class="material-icons workspace-arrow" aria-hidden="true">north_east</span></a>{/each}</nav>
  </section>
  <footer class="board-footnote"><span><i></i>Updated <time>{new Date(overview.checkedAt * 1000).toLocaleString()}</time></span><span>Observed activity, not uptime. Infrastructure monitoring not connected.</span></footer>
</div>

<style>
  .staff-dashboard { --staff-failure: #e3a08b; --staff-tenant: #85c4cc; --board-mono: 'Consolas', 'SFMono-Regular', monospace; display: grid; gap: 1.35rem; padding-block: 1.5rem 2rem; }
  .board-heading { display: flex; align-items: center; gap: 1.3rem; flex-wrap: wrap; }
  .board-heading > div { margin-right: auto; }
  .board-kicker { display: block; color: var(--color-text-muted); font-size: 0.61rem; letter-spacing: 0.14em; text-transform: uppercase; }
  h1 { font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.05em; line-height: 1.1; margin: 0.35rem 0 0; }
  .business-search, .board-period { display: flex; align-items: center; gap: 0.7rem; margin: 0; }
  .business-search { border-bottom: 1px solid var(--color-divider); padding: 0.3rem 0; }
  .business-search > .material-icons { color: var(--color-text-muted); font-size: 1.1rem; }
  .business-search input { width: 14rem; padding: 0.3rem 0; background: transparent; border: 0; font-size: 0.78rem; }
  .board-period select { min-height: 2rem; padding: 0.35rem 1.5rem 0.35rem 0.5rem; font-size: 0.73rem; }
  .board-heading button { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.72rem; padding: 0.3rem 0; }
  .board-heading button .material-icons { font-size: 1rem; }
  .board-snapshot { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin: 0; border-block: 1px solid var(--color-divider); background: linear-gradient(100deg, rgb(133 196 204 / 4%), transparent 70%); }
  .board-snapshot > div { padding: 1.1rem 1.35rem; border-right: 1px solid var(--color-divider); }
  .board-snapshot > div:last-child { border-right: 0; }
  .board-snapshot dt { display: flex; align-items: center; gap: 0.5rem; color: var(--color-text-muted); font-size: 0.7rem; }
  .board-snapshot dt .material-icons { font-size: 1rem; color: var(--staff-tenant); opacity: 0.8; }
  .board-snapshot dd { font: 500 clamp(1.7rem, 3vw, 2.2rem)/1.2 var(--board-mono); letter-spacing: -0.07em; margin: 0.65rem 0 0.2rem; }
  .board-snapshot small { font-size: 0.63rem; color: var(--color-text-muted); }
  .board-snapshot a { color: inherit; text-decoration: none; }
  .board-main { display: grid; grid-template-columns: minmax(0, 2.15fr) minmax(270px, 1fr); gap: 1.25rem; }
  .board-module { min-width: 0; padding: 1.2rem; background: linear-gradient(150deg, rgb(255 255 255 / 2%), rgb(255 255 255 / 0.3%)); border: 1px solid var(--color-divider); border-radius: 0; }
  .module-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.8rem; margin-bottom: 1.4rem; }
  .module-heading h2 { font-size: 1rem; line-height: 1.3; font-weight: 600; letter-spacing: -0.025em; margin: 0.35rem 0 0; }
  .module-heading > a { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.67rem; color: var(--color-text-muted); text-decoration: none; white-space: nowrap; padding-block: 0.25rem; border-bottom: 1px solid var(--color-divider); }
  .module-heading > a .material-icons { font-size: 0.85rem; }
  .analytics-totals { display: flex; flex-wrap: wrap; gap: 0.8rem 2rem; margin-bottom: 1.6rem; }
  .analytics-totals > div { display: grid; gap: 0.25rem; }
  .analytics-totals strong { font: 500 1.55rem/1.2 var(--board-mono); letter-spacing: -0.05em; }
  .analytics-totals strong small { font-size: 0.75rem; color: var(--color-text-muted); font-weight: 400; }
  .analytics-totals span { font-size: 0.63rem; color: var(--color-text-muted); }
  .failure-value { color: var(--staff-failure); }
  .attention-module { display: flex; flex-direction: column; }
  .attention-symbol { font-size: 1.2rem; color: var(--color-warning); }
  .attention-list { display: grid; gap: 0.2rem; }
  .attention-item { display: grid; grid-template-columns: 1rem 1fr auto; align-items: center; gap: 0.7rem; padding: 0.8rem 0; color: inherit; text-decoration: none; }
  .signal-icon { font-size: 1rem; color: var(--color-warning); }
  .attention-item strong { display: block; font-weight: 500; font-size: 0.75rem; }
  .attention-item small { display: block; font-size: 0.6rem; color: var(--color-text-muted); margin-top: 0.25rem; }
  .attention-count { font: 1.1rem/1.2 var(--board-mono); text-align: right; }
  .attention-count small { font-family: var(--font-body); }
  .access-summary { display: flex; align-items: center; gap: 0.6rem; padding-top: 1rem; margin-top: auto; border-top: 1px solid var(--color-divider); text-decoration: none; font-size: 0.68rem; color: var(--color-text-muted); }
  .access-summary .material-icons { font-size: 1rem; }
  .access-summary strong { margin-left: auto; color: var(--color-text); font-family: var(--board-mono); }
  .module-empty { display: grid; justify-items: start; gap: 0.8rem; padding-block: 1.3rem; color: var(--color-text-muted); font-size: 0.74rem; }
  .module-empty strong { font-weight: 400; }
  .module-empty .material-icons { color: var(--staff-tenant); }
  .board-secondary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; }
  .equipment-summary { display: flex; gap: 1rem; align-items: baseline; margin-bottom: 1rem; }
  .equipment-summary > strong { font: 1.8rem/1.2 var(--board-mono); letter-spacing: -0.05em; }
  .equipment-summary strong span { color: var(--color-text-muted); font-size: 1.1rem; }
  .equipment-summary > span { display: flex; align-items: center; gap: 0.4rem; color: var(--color-text-muted); font-size: 0.68rem; }
  .online-dot, .connection-legend i { display: inline-block; width: 6px; height: 6px; border-radius: 50%; }
  .online-dot { background: var(--staff-tenant); }
  .connection-bar, .support-bar { height: 5px; display: flex; gap: 3px; margin-block: 0.85rem; background: rgb(255 255 255 / 3%); }
  .online { background: var(--staff-tenant); }
  .offline { background: var(--staff-failure); }
  .unconnected { background: #64757b; }
  .timestamp { background: var(--color-warning); }
  .connection-legend { display: flex; flex-wrap: wrap; gap: 0.65rem 1.25rem; margin-top: 1.2rem; }
  .connection-legend > span { display: flex; align-items: center; gap: 0.4rem; font-size: 0.65rem; color: var(--color-text-muted); }
  .connection-legend strong { font-family: var(--board-mono); color: var(--color-text); margin-left: 0.2rem; }
  .support-counts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  .support-counts a { display: grid; gap: 0.3rem; text-decoration: none; color: inherit; }
  .support-counts strong { font: 1.8rem/1.2 var(--board-mono); }
  .support-counts span { font-size: 0.68rem; color: var(--color-text-muted); }
  .support-open { background: var(--staff-tenant); }
  .support-waiting { background: #66787f; }
  .record-request { display: inline-flex; align-items: center; gap: 0.35rem; margin-top: 1.1rem; border-bottom: 1px solid var(--color-divider); padding-bottom: 0.2rem; color: var(--color-text-muted); font-size: 0.67rem; text-decoration: none; }
  .record-request .material-icons { font-size: 0.9rem; }
  .module-note { font-size: 0.75rem; color: var(--color-text-muted); }
  .board-workspaces { border-top: 1px solid var(--color-divider); margin-top: 0.5rem; padding-top: 1.2rem; }
  .board-workspaces > header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin-bottom: 0.6rem; }
  .board-workspaces h2 { margin: 0; font-size: 0.9rem; }
  .board-workspaces header > span { font-size: 0.65rem; color: var(--color-text-muted); }
  .workspace-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 1.5rem; }
  .workspace-tabs a { display: flex; align-items: center; gap: 0.65rem; padding: 1.1rem 0; border-bottom: 1px solid var(--color-divider); text-decoration: none; color: var(--color-text); }
  .workspace-tabs .material-icons { font-size: 1.15rem; color: var(--staff-tenant); }
  .workspace-tabs strong { font-size: 0.76rem; font-weight: 500; }
  .workspace-tabs .workspace-arrow { margin-left: auto; color: var(--color-text-muted); font-size: 0.9rem; }
  .workspace-tabs a:hover, .attention-item:hover { color: var(--staff-tenant); }
  .has-issue, .support-counts a.has-issue { color: var(--staff-failure); }
  .board-footnote { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.6rem 2rem; font-size: 0.6rem; color: var(--color-text-muted); padding-top: 0.35rem; }
  .board-footnote > span:first-child { display: flex; align-items: center; gap: 0.4rem; }
  .board-footnote i { width: 4px; height: 4px; background: var(--staff-tenant); border-radius: 50%; }
  .equipment-only { grid-template-columns: 1fr; }
  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  @media (max-width: 1000px) { .board-main { grid-template-columns: minmax(0, 1.7fr) minmax(240px, 1fr); } .board-heading > div { flex: 1; } .business-search input { width: 10rem; } }
  @media (max-width: 800px) { .board-main, .board-secondary { grid-template-columns: 1fr; } .attention-module { grid-row: 1; } .board-snapshot { grid-template-columns: repeat(2, minmax(0, 1fr)); } .board-snapshot > div { border-bottom: 1px solid var(--color-divider); } .board-snapshot > div:nth-child(even) { border-right: 0; } .board-snapshot > div:nth-last-child(-n+2) { border-bottom: 0; } .workspace-tabs { grid-template-columns: repeat(3, minmax(0, 1fr)); } .board-period { margin-left: auto; } }
  @media (max-width: 560px) { .staff-dashboard { gap: 1rem; padding-top: 1rem; } .board-heading { gap: 1rem; } .board-heading > div { flex-basis: 100%; } .business-search { flex: 1 1 100%; } .business-search input { width: 100%; flex: 1; min-width: 0; } .board-period { margin-left: 0; } .board-snapshot > div { padding: 0.9rem 0.75rem; } .board-snapshot dt { font-size: 0.63rem; gap: 0.35rem; } .board-snapshot dt .material-icons { font-size: 0.85rem; } .board-snapshot small { font-size: 0.56rem; } .board-module { padding: 1rem 0.8rem; } .module-heading { gap: 0.5rem; } .module-heading h2 { font-size: 0.9rem; } .module-heading > a { font-size: 0.6rem; } .analytics-totals { gap: 0.7rem 1.2rem; margin-bottom: 1.1rem; } .analytics-totals strong { font-size: 1.3rem; } .analytics-totals span { font-size: 0.57rem; } .workspace-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 1rem; } .workspace-tabs a { gap: 0.45rem; } .workspace-tabs strong { font-size: 0.7rem; } }
</style>
