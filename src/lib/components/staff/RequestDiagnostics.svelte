<script lang="ts">
  import { page as pageState } from '$app/state';
  import { toStore } from 'svelte/store';
  const page = toStore(() => ({ ...pageState }));
  import type { loadRequestDiagnostics } from '#lib/server/platformStaffDashboard.ts';
  export let data: Awaited<ReturnType<typeof loadRequestDiagnostics>>;
  export let businessId: string | undefined = undefined;
  const date = (value: number) => new Date(value * 1000).toLocaleString();
  const areas = [['application', 'Application'], ['lists', 'Lists'], ['recipes', 'Recipes'], ['documents', 'Documents & Menus'],
    ['scheduling', 'Scheduling'], ['temperature', 'Temperature'], ['accounts', 'Accounts'], ['people', 'People & HR'],
    ['billing', 'Billing'], ['announcements', 'Announcements']];
  function nextUrl() {
    const params = new URLSearchParams($page.url.searchParams.toString());
    if (data.next) params.set('after', data.next); else params.delete('after');
    return `${$page.url.pathname}?${params}`;
  }
</script>

{#if data.canViewApplication}
  <section class="staff-panel" aria-labelledby="request-issues">
    <header class="staff-panel-heading"><h2 id="request-issues">Needs Attention</h2><span>{data.issues.length}{data.next ? '+' : ''} {data.issues.length === 1 && !data.next ? 'group' : 'groups'}</span></header>
    <form method="GET" class="staff-toolbar staff-filters">
      <input type="hidden" name="view" value="application" />
      <label>Period<select name="hours" value={String(data.hours)}><option value="1">This Hour</option><option value="24">24 Hours</option><option value="168">7 Days</option></select></label>
      <label>Area<select name="area" value={data.area}><option value="">All Areas</option>{#each areas as [value, label]}<option {value}>{label}</option>{/each}</select></label>
      <label>Type<select name="kind" value={data.kind}><option value="">All Issues</option><option value="server_error">Request Failed</option><option value="access_denied">Access Denied</option><option value="slow_request">Slow Response</option></select></label>
      <button type="submit">Apply</button>
    </form>
    <div class="staff-issue-list">
      {#each data.issues as issue (issue.id)}
        <article class="staff-issue" class:staff-issue-error={issue.kind === 'server_error'}>
          <div class="staff-issue-title"><strong>{issue.kindLabel}</strong><span>{issue.areaLabel}</span>
            {#if !businessId}{#if issue.business_id}<a href={`/staff/businesses/${encodeURIComponent(issue.business_id)}?view=application`}>{issue.business_name}</a>{:else}<span>Platform</span>{/if}{/if}
          </div>
          <div class="staff-issue-detail"><code>{issue.route_id}</code><span>{issue.operation.replaceAll('_', ' ')} · HTTP {issue.status}</span></div>
          <dl class="staff-issue-facts"><div><dt>Occurrences</dt><dd>{issue.occurrences}</dd></div><div><dt>First Seen</dt><dd>{date(issue.first_seen_at)}</dd></div><div><dt>Last Seen</dt><dd>{date(issue.last_seen_at)}</dd></div><div><dt>Slowest</dt><dd>{issue.max_duration_ms} ms</dd></div></dl>
          <details class="staff-reference"><summary>Request Reference</summary><code>{issue.last_request_id}</code></details>
        </article>
      {:else}<p class="staff-empty">No recorded issues match these filters.</p>{/each}
    </div>
    {#if data.next}<nav class="staff-pagination" aria-label="Issue pages"><a href={nextUrl()}>Older Issues</a></nav>{/if}
  </section>
  <section class="staff-panel" aria-labelledby="request-performance">
    <header class="staff-panel-heading"><h2 id="request-performance">Performance</h2><span>All areas · {data.hours === 168 ? '7 days' : `${data.hours} hours`}</span></header>
    <dl class="staff-summary">
      <div><dt>Sampled Successes</dt><dd>{data.metrics?.samples ?? 0}</dd></div>
      <div><dt>Sampled Average</dt><dd>{data.metrics?.averageMs === null || !data.metrics ? 'Not recorded' : `${data.metrics.averageMs} ms`}</dd></div>
      <div><dt>Sampled Maximum</dt><dd>{data.metrics?.maxMs === null || !data.metrics ? 'Not recorded' : `${data.metrics.maxMs} ms`}</dd></div>
    </dl>
    <p class="staff-note">1% sample of successful app responses. Server time, not device or network speed.</p>
    <p class="staff-note">Cloudflare CPU, database usage, and infrastructure latency are not connected here.</p>
  </section>
{/if}
