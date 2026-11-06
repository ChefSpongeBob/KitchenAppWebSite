<script lang="ts">
  import { page as pageState } from '$app/state';
  import { toStore } from 'svelte/store';
  const page = toStore(() => ({ ...pageState }));
  import RequestDiagnostics from '#lib/components/staff/RequestDiagnostics.svelte';
  import GatewayStatus from '#lib/components/staff/GatewayStatus.svelte';
  import SupportQueue from '#lib/components/staff/SupportQueue.svelte';
  import type { PageData } from './$types';
  export let data: PageData;
  const date = (value: number | null) => value ? new Date(value * 1000).toLocaleDateString() : 'Not set';
  const time = (value: number) => new Date(value * 1000).toLocaleString();
  const tabs = [['overview', 'Overview'], ['application', 'Application'], ['equipment', 'Equipment'], ['support', 'Support'], ['security', 'Security'], ['activity', 'Staff Activity']];
  function securityNext() {
    const params = new URLSearchParams($page.url.searchParams.toString());
    if (data.security?.next) params.set('securityAfter', data.security.next);
    return `${$page.url.pathname}?${params}`;
  }
</script>
<header class="staff-business-context"><div><a href="/staff/businesses">Businesses</a><h2>{data.business.name}</h2></div><span>{data.business.status}</span></header>
{#if data.activeView === 'overview'}
<dl class="staff-summary">
  <div><dt>Plan</dt><dd>{{ starter: 'Small', growth: 'Medium', enterprise: 'Large' }[data.business.plan_tier] ?? data.business.plan_tier}</dd></div>
  <div><dt>Members</dt><dd>{data.business.members}</dd></div><div><dt>Gateways</dt><dd>{data.business.gateways}</dd></div>
</dl>
<details class="staff-panel"><summary>Business Details</summary><dl class="staff-summary">
  <div><dt>Business ID</dt><dd>{data.business.id}</dd></div>
  <div><dt>Status</dt><dd>{data.business.status}</dd></div>
  <div><dt>Plan</dt><dd>{{ starter: 'Small', growth: 'Medium', enterprise: 'Large' }[data.business.plan_tier] ?? data.business.plan_tier}</dd></div>
  <div><dt>Members</dt><dd>{data.business.members}</dd></div>
  <div><dt>Gateways</dt><dd>{data.business.gateways}</dd></div>
  <div><dt>Created</dt><dd>{date(data.business.created_at)}</dd></div>
  <div><dt>Business Email</dt><dd>{data.business.contact_email || 'Not set'}</dd></div>
  <div><dt>Business Phone</dt><dd>{data.business.contact_phone || 'Not set'}</dd></div>
</dl>
</details>
{/if}
<nav class="staff-business-tabs" aria-label="Business investigation">
  {#each tabs as [view, label]}
    {#if !(['application', 'support'].includes(view) && !data.canViewApplication) && !(['security', 'activity'].includes(view) && !data.canViewSecurity)}
      <a href={`?view=${view}`} aria-current={data.activeView === view ? 'page' : undefined}>{label}</a>
    {/if}
  {/each}
</nav>
{#if data.activeView === 'overview'}
<nav class="staff-toolbar" aria-label="Business staff tools">
  <a href={`/staff/equipment?business=${encodeURIComponent(data.business.id)}`}>Equipment</a>
  <a href={`/staff/health?business=${encodeURIComponent(data.business.id)}`}>System Health</a>
</nav>
<h2>Store Subscriptions</h2>
<div class="staff-table-wrap"><table>
  <thead><tr><th>Store</th><th>Service</th><th>Status</th><th>Period Ends</th><th>Verified</th></tr></thead>
  <tbody>{#each data.subscriptions as subscription}<tr><td>{subscription.store}</td><td>{subscription.entitlement_key}</td><td>{subscription.status}</td><td>{date(subscription.current_period_end)}</td><td>{date(subscription.verified_at)}</td></tr>
  {:else}<tr><td colspan="5">No store subscriptions.</td></tr>{/each}</tbody>
</table></div>
{:else if data.diagnostics}
  <RequestDiagnostics data={data.diagnostics} businessId={data.business.id} />
{:else if data.equipment}
  <GatewayStatus data={data.equipment} businessId={data.business.id} />
{:else if data.support}
  <nav class="staff-toolbar"><a href={`/staff/support?business=${encodeURIComponent(data.business.id)}&new=1`}>Record Request</a><a href={`/staff/support?business=${encodeURIComponent(data.business.id)}`}>Filter Requests</a></nav>
  <SupportQueue data={data.support} staff />
  {#if data.support.next}<nav class="staff-pagination" aria-label="Business support pages"><a href={`?${new URLSearchParams({ view: 'support', after: data.support.next })}`}>More Requests</a></nav>{/if}
{:else if data.security}
  <section class="staff-panel">
    <header class="staff-panel-heading"><h2>Account Activity</h2><span>Read Only</span></header>
    <form method="GET" class="staff-toolbar"><input type="hidden" name="view" value="security" /><label>Period<select name="hours" value={String(data.security.hours)}><option value="1">This Hour</option><option value="24">24 Hours</option><option value="168">7 Days</option></select></label><button type="submit">Apply</button></form>
    <div class="staff-table-wrap"><table><thead><tr><th>When</th><th>Event</th><th>Actor</th><th>Target Account</th></tr></thead>
      <tbody>{#each data.security.events as item (item.id)}<tr><td>{time(item.created_at)}</td><td>{item.action}</td><td>{item.actor_name ?? item.actor_user_id ?? 'System'}</td><td>{item.target_user_id ?? '-'}</td></tr>{:else}<tr><td colspan="4">No recorded account activity in this period.</td></tr>{/each}</tbody>
    </table></div>
    {#if data.security.next}<nav class="staff-pagination" aria-label="Account activity pages"><a href={securityNext()}>Older Activity</a></nav>{/if}
  </section>
  <section class="staff-panel"><header class="staff-panel-heading"><h2>Announcement Publishing</h2><span>Recent 10</span></header>
    <div class="staff-table-wrap"><table><thead><tr><th>When</th><th>Published By</th><th>Account ID</th></tr></thead><tbody>
      {#each data.security.publications as item (item.id)}<tr><td>{time(item.created_at)}</td><td>{item.actor_name ?? 'Former or unavailable member'}</td><td>{item.created_by ?? '-'}</td></tr>{:else}<tr><td colspan="3">No retained publications in this period.</td></tr>{/each}
    </tbody></table></div>
  </section>
{:else if data.activeView === 'activity'}
  <section class="staff-panel"><header class="staff-panel-heading"><h2>Recent Staff Activity</h2><a href="/staff/activity">All Staff Activity</a></header>
    <ol class="staff-activity-list">{#each data.activity as item (item.id)}<li><strong>{item.action.replaceAll('_', ' ')}</strong><time>{time(item.created_at)}</time></li>{:else}<li>No recent staff activity for this business.</li>{/each}</ol>
  </section>
{/if}
