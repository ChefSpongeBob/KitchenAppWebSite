<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;
  $: overview = data.overview;
  $: maxErrors = Math.max(1, ...overview.trend.map(item => item.errors));
  $: attentionGroups = overview.groups.filter(item => item.kind === 'server_error').slice(0, 5);
  const healthUrl = (view: string, extra: Record<string, string> = {}) => `/staff/health?${new URLSearchParams({ view, hours: String(overview.hours), ...extra })}`;
</script>

<div class="staff-dashboard">
  <header class="staff-overview-header">
    <div><small class="staff-kicker">Crimini Operations</small><h2>Overview</h2></div>
    <form method="GET" class="staff-toolbar staff-period">{#if overview.canViewApplication}<label>Period<select name="hours" value={String(overview.hours)}><option value="1">This Hour</option><option value="24">24 Hours</option><option value="168">7 Days</option></select></label>{/if}<button type="submit">Refresh</button></form>
  </header>
  <form action="/staff/businesses" method="GET" class="staff-business-search"><label for="staff-find-business">Find Business</label><div><input id="staff-find-business" name="q" maxlength="80" placeholder="Business name or ID" /><button type="submit">Search</button></div></form>
  <dl class="staff-overview-totals">
    <div><dt>Active Businesses</dt><dd><a href="/staff/businesses">{overview.activeBusinesses}</a></dd></div>
    <div><dt>Businesses With Signals</dt><dd><a href={healthUrl(overview.canViewApplication ? 'application' : 'equipment')}>{overview.affectedBusinesses}</a></dd></div>
    {#if overview.support}<div><dt>Active Support Requests</dt><dd><a href="/staff/support">{overview.support.open + overview.support.waiting}</a></dd></div>{/if}
    <div><dt>Gateway Attention</dt><dd><a href={healthUrl('equipment')}>{overview.gateways.attention}</a></dd></div>
  </dl>
  <div class="staff-overview-grid">
    <section class="staff-panel" aria-labelledby="staff-platform-health">
      <header class="staff-panel-heading"><h2 id="staff-platform-health">Platform Health</h2><a href="/staff/health">Investigate</a></header>
      <div class="staff-service-list">
        {#if overview.metrics}
          <a href={healthUrl('application', { kind: 'server_error' })}><span>Application</span><strong>{overview.metrics.errors} recorded failures</strong></a>
          <a href={healthUrl('application', { kind: 'slow_request' })}><span>Response Time</span><strong>{overview.metrics.averageMs === null ? 'No timing sample' : `${overview.metrics.averageMs} ms sampled average`}</strong></a>
          <a href={healthUrl('application', { kind: 'access_denied' })}><span>Account Access</span><strong>{overview.metrics.denials} recorded denials</strong></a>
          <a href={healthUrl('delivery')}><span>Queued Notifications</span><strong>{overview.delivery?.failed ?? 0} recorded failures</strong></a>
        {/if}
        <a href={healthUrl('equipment')}><span>Equipment</span><strong>{overview.gateways.total ? `${overview.gateways.online} / ${overview.gateways.total} gateways online` : 'No registered gateways'}</strong></a>
        <div><span>Infrastructure Monitoring</span><strong class="staff-note">Not connected</strong></div>
      </div>
      <p class="staff-note">Recorded signals, not an uptime check. Equipment shows current contact status.</p>
    </section>
    {#if overview.canViewApplication}
      <section class="staff-panel" aria-labelledby="staff-signal-trend">
        <header class="staff-panel-heading"><h2 id="staff-signal-trend">Request Failures</h2><a href={healthUrl('application', { kind: 'server_error' })}>View Records</a></header>
        {#if overview.trend.length > 1}
          <div class="staff-trend" role="list" aria-label="Recorded request failures by period">
            {#each overview.trend as item (item.at)}<div role="listitem" title={`${new Date(item.at * 1000).toLocaleString()}: ${item.errors} failures`} aria-label={`${new Date(item.at * 1000).toLocaleString()}: ${item.errors} failures`}><span style:height={`${Math.max(item.errors ? 3 : 0, item.errors / maxErrors * 100)}%`}></span></div>{/each}
          </div>
          <div class="staff-trend-caption"><time>{new Date(overview.trend[0].at * 1000).toLocaleString()}</time><time>{new Date(overview.trend[overview.trend.length - 1].at * 1000).toLocaleString()}</time></div>
        {:else if overview.trend.length === 1}
          <div class="staff-trend-single"><strong>{overview.trend[0].errors}</strong><span>recorded failures</span><time>{new Date(overview.trend[0].at * 1000).toLocaleString()}</time></div>
          <p class="staff-note">A trend appears when more periods are recorded.</p>
        {:else}<p class="staff-empty">No observations recorded in this period.</p>{/if}
        <p class="staff-note">Only periods with recorded observations are shown.</p>
      </section>
    {/if}
    <section class="staff-panel" aria-labelledby="staff-attention">
      <header class="staff-panel-heading"><h2 id="staff-attention">Needs Attention</h2><a href="/staff/health">View All</a></header>
      <div class="staff-service-list">
        {#each attentionGroups as item}<a href={healthUrl('application', { area: item.area, kind: item.kind })}><span>{item.areaLabel}</span><strong>{item.businesses} {item.businesses === 1 ? 'business' : 'businesses'} with recorded failures</strong></a>{/each}
        {#if overview.gateways.attention}<a href={healthUrl('equipment')}><span>Gateway Connections</span><strong>{overview.gateways.businesses} {overview.gateways.businesses === 1 ? 'business' : 'businesses'}</strong></a>{/if}
        {#if overview.delivery?.failed}<a href={healthUrl('delivery')}><span>Notification Failures</span><strong>{overview.delivery.businesses} {overview.delivery.businesses === 1 ? 'business' : 'businesses'}</strong></a>{/if}
      </div>
      {#if !attentionGroups.length && !overview.gateways.attention && !overview.delivery?.failed}<p class="staff-empty">No matching failures or gateway issues recorded.</p>{/if}
    </section>
    {#if overview.support}
      <section class="staff-panel" aria-labelledby="staff-customer-support">
        <header class="staff-panel-heading"><h2 id="staff-customer-support">Customer Support</h2><a href="/staff/support">Open Queue</a></header>
        <div class="staff-service-list"><a href="/staff/support?status=open"><span>Open</span><strong>{overview.support.open}</strong></a><a href="/staff/support?status=waiting"><span>Waiting for Customer</span><strong>{overview.support.waiting}</strong></a><a href="/staff/support?priority=urgent"><span>Urgent Requests</span><strong>{overview.support.urgent}</strong></a></div>
        <a class="staff-inline-action" href="/staff/support?new=1">Record Request</a>
      </section>
    {/if}
  </div>
  <p class="staff-note">Checked {new Date(overview.checkedAt * 1000).toLocaleString()}</p>
</div>
