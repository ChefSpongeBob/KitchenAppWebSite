<script lang="ts">
  import { page as pageState } from '$app/state';
  import { toStore } from 'svelte/store';
  const page = toStore(() => ({ ...pageState }));
  import type { PageData } from './$types';
  import RequestDiagnostics from '#lib/components/staff/RequestDiagnostics.svelte';
  import GatewayStatus from '#lib/components/staff/GatewayStatus.svelte';
  export let data: PageData;
  const date = (value: number | null) => value ? new Date(value * 1000).toLocaleString() : 'None recorded';
  const statuses = ['failed', 'pending', 'processing'] as const;
  function viewUrl(changes: Record<string, string>) {
    const params = new URLSearchParams($page.url.searchParams.toString());
    for (const [key, value] of Object.entries(changes)) params.set(key, value);
    return `/staff/health?${params}`;
  }
</script>

<h2>System Health</h2>
{#if data.business}
  <div class="staff-toolbar">
    <a href={`/staff/businesses/${encodeURIComponent(data.business.id)}`}>{data.business.name}</a>
    <a href="/staff/businesses">Change Business</a>
    <a href={$page.url.pathname + $page.url.search} data-sveltekit-reload>Refresh</a>
  </div>
  <dl class="staff-summary">
    <div><dt>Checked</dt><dd>{date(data.checkedAt)}</dd></div>
    {#if data.canViewDelivery}
      <div><dt>Email Configuration</dt><dd>{data.emailConfigured === null ? 'Unknown' : data.emailConfigured ? 'Configured' : 'Not configured'}</dd></div>
      <div><dt>Dispatcher Heartbeat</dt><dd>Not recorded</dd></div>
    {/if}
  </dl>

  <section aria-labelledby="health-gateways">
    <h2 id="health-gateways">Gateway Connections</h2>
    <div class="staff-table-wrap"><table>
      <thead><tr><th>Gateway</th><th>Serial</th><th>Last Contact</th><th>Status</th></tr></thead>
      <tbody>{#each data.gateways as gateway (gateway.id)}
        <tr><td>{gateway.display_name}</td><td>{gateway.external_device_id}</td><td>{date(gateway.last_seen_at)}</td><td class:health-warning={gateway.connection !== 'Online'}>{gateway.connection}</td></tr>
      {:else}<tr><td colspan="4">No active gateways.</td></tr>{/each}</tbody>
    </table></div>
    <nav class="staff-pagination" aria-label="Gateway health pages">
      {#if data.controls.gatewayPage > 1}<a href={viewUrl({ gateways: String(data.controls.gatewayPage - 1) })}>Previous</a>{/if}
      <span>Page {data.controls.gatewayPage}</span>
      {#if data.moreGateways && data.controls.gatewayPage < 1000}<a href={viewUrl({ gateways: String(data.controls.gatewayPage + 1) })}>Next</a>{/if}
    </nav>
  </section>

  {#if data.delivery}
    <section aria-labelledby="health-jobs">
      <h2 id="health-jobs">Queued Notifications</h2>
      <p class="health-note">Direct invite and account emails are not included.</p>
      <nav class="staff-toolbar" aria-label="Notification status">
        {#each statuses as status}<a href={viewUrl({ queue: status, jobs: '1' })} aria-current={data.controls.queueStatus === status ? 'page' : undefined}>{status === 'failed' ? 'Failed' : status === 'pending' ? 'Pending' : 'Processing'}</a>{/each}
      </nav>
      <div class="staff-table-wrap"><table>
        <thead><tr><th>Area</th><th>Status</th><th>Attempts</th><th>Created</th><th>Next Attempt</th></tr></thead>
        <tbody>{#each data.delivery.jobs as job (job.id)}
          <tr><td>{job.category}</td><td>{job.condition}</td><td>{job.attempts}</td><td>{date(job.createdAt)}</td><td>{date(job.nextAttemptAt)}</td></tr>
        {:else}<tr><td colspan="5">No {data.controls.queueStatus} notifications.</td></tr>{/each}</tbody>
      </table></div>
      <nav class="staff-pagination" aria-label="Notification pages">
        {#if data.controls.queuePage > 1}<a href={viewUrl({ jobs: String(data.controls.queuePage - 1) })}>Previous</a>{/if}
        <span>Page {data.controls.queuePage}</span>
        {#if data.delivery.moreJobs && data.controls.queuePage < 1000}<a href={viewUrl({ jobs: String(data.controls.queuePage + 1) })}>Next</a>{/if}
      </nav>
    </section>

    <section aria-labelledby="health-attempts">
      <h2 id="health-attempts">Queue Delivery Attempts</h2>
      <p class="health-note">Accepted means provider acceptance, not confirmed delivery.</p>
      <div class="staff-table-wrap"><table>
        <thead><tr><th>When</th><th>Channel</th><th>Status</th><th>Issue</th></tr></thead>
        <tbody>{#each data.delivery.attempts as attempt (attempt.id)}
          <tr><td>{date(attempt.attemptedAt)}</td><td>{attempt.channel}</td><td>{attempt.status}</td><td>{attempt.issue ?? '-'}</td></tr>
        {:else}<tr><td colspan="4">No delivery attempts recorded.</td></tr>{/each}</tbody>
      </table></div>
      <nav class="staff-pagination" aria-label="Delivery attempt pages">
        {#if data.controls.attemptPage > 1}<a href={viewUrl({ attempts: String(data.controls.attemptPage - 1) })}>Previous</a>{/if}
        <span>Page {data.controls.attemptPage}</span>
        {#if data.delivery.moreAttempts && data.controls.attemptPage < 1000}<a href={viewUrl({ attempts: String(data.controls.attemptPage + 1) })}>Next</a>{/if}
      </nav>
    </section>
  {/if}
{:else}
  <nav class="staff-business-tabs" aria-label="System health views">
    {#if data.canViewApplication}<a href="?view=application" aria-current={data.view === 'application' ? 'page' : undefined}>Application</a>{/if}
    <a href="?view=equipment" aria-current={data.view === 'equipment' ? 'page' : undefined}>Equipment</a>
    {#if data.canViewApplication}<a href="?view=delivery" aria-current={data.view === 'delivery' ? 'page' : undefined}>Notifications</a>{/if}
  </nav>
  {#if data.diagnostics}<RequestDiagnostics data={data.diagnostics} />{/if}
  {#if data.equipment}<GatewayStatus data={data.equipment} />{/if}
  {#if data.failures}
    <form method="GET" class="staff-toolbar"><input type="hidden" name="view" value="delivery" /><label>Period<select name="hours" value={String(data.failures.hours)}><option value="1">This Hour</option><option value="24">24 Hours</option><option value="168">7 Days</option></select></label><button type="submit">Apply</button></form>
    <h2>Recorded Notification Failures</h2>
    <div class="staff-table-wrap"><table><thead><tr><th>Business</th><th>Area</th><th>Created</th><th>Attempts</th></tr></thead><tbody>
      {#each data.failures.rows as row (row.id)}<tr><td><a href={`/staff/health?business=${encodeURIComponent(row.business_id)}`}>{row.business_name}</a></td><td>{row.category}</td><td>{date(row.created_at)}</td><td>{row.delivery_attempts}</td></tr>{:else}<tr><td colspan="4">No recorded failures in this period.</td></tr>{/each}
    </tbody></table></div>
    {#if data.failures.next}<nav class="staff-pagination" aria-label="Failure pages"><a href={viewUrl({ deliveryAfter: data.failures.next })}>Older Failures</a></nav>{/if}
    <p class="staff-note">Queued notifications only. Direct account emails and inbox delivery are not monitored here.</p>
  {/if}
{/if}

<style>
  section { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-divider); }
  .health-note { margin: -0.4rem 0 1rem; font-size: 0.75rem; color: var(--color-text-muted); }
  .health-warning { font-weight: 600; }
  [aria-current='page'] { font-weight: 700; }
</style>
