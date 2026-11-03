<script lang="ts">
  import { page as pageState } from '$app/state';
  import { toStore } from 'svelte/store';
  const page = toStore(() => ({ ...pageState }));
  import RequestDiagnostics from '#lib/components/staff/RequestDiagnostics.svelte';
  import GatewayStatus from '#lib/components/staff/GatewayStatus.svelte';
  import type { PageData } from './$types';
  export let data: PageData;
  const activityLabels: Record<string, string> = { staff_email_verified: 'Staff Email Verified', staff_membership_added: 'Staff Added',
    staff_access_revoked: 'Staff Access Revoked', staff_access_updated: 'Staff Access Updated', gateway_reserved: 'Gateway Reserved',
    gateway_reservation_released: 'Reservation Released', staff_verification_email_updated: 'Verification Email Updated',
    staff_verification_email_changed: 'New Verification Email Confirmed', platform_owner_bootstrapped: 'Platform Owner Enabled' };
</script>

<div class="staff-dashboard">
  <section class="staff-command" aria-labelledby="staff-dashboard-title">
    <div class="staff-command-title"><span class="material-icons" aria-hidden="true">space_dashboard</span><div><small>Crimini Operations</small><h2 id="staff-dashboard-title">Dashboard</h2></div></div>
    {#if data.diagnostics.canViewApplication}
      <dl class="staff-snapshot"><div><dt>Recorded Failures</dt><dd>{data.diagnostics.metrics?.errors ?? 0}</dd></div><div><dt>Slow Responses</dt><dd>{data.diagnostics.metrics?.slow ?? 0}</dd></div><div><dt>Access Denials</dt><dd>{data.diagnostics.metrics?.denials ?? 0}</dd></div></dl>
    {:else}<p class="staff-note">Equipment Operations</p>{/if}
  </section>
  <div class="staff-dashboard-toolbar">
    <form action="/staff/businesses" method="GET" class="staff-toolbar"><label>Find Business<input name="q" maxlength="80" placeholder="Business name or ID" /></label><button type="submit">Search</button></form>
    <div class="staff-check-time"><span>Checked {new Date(data.diagnostics.checkedAt * 1000).toLocaleTimeString()}</span><a href={$page.url.pathname + $page.url.search} data-sveltekit-reload>Refresh</a></div>
  </div>
  <div class="staff-dashboard-columns">
    <div class="staff-dashboard-main"><RequestDiagnostics data={data.diagnostics} /><GatewayStatus data={data.equipment} /></div>
    <aside class="staff-dashboard-aside">
      <section class="staff-panel"><header class="staff-panel-heading"><h2>Workspaces</h2></header>
        <nav class="staff-workspace-links" aria-label="Staff workspaces">
          <a href="/staff/businesses"><span class="material-icons" aria-hidden="true">storefront</span><span>Businesses<small>Accounts & investigation</small></span></a>
          <a href="/staff/equipment"><span class="material-icons" aria-hidden="true">router</span><span>Equipment<small>Inventory & assignments</small></span></a>
          {#if data.canViewActivity}<a href="/staff/team"><span class="material-icons" aria-hidden="true">badge</span><span>Staff<small>Platform access</small></span></a>{/if}
        </nav>
      </section>
      {#if data.canViewActivity}
        <section class="staff-panel"><header class="staff-panel-heading"><h2>Recent Staff Activity</h2><a href="/staff/activity">View All</a></header>
          <ol class="staff-activity-list">{#each data.activity as item (item.id)}<li><strong>{activityLabels[item.action] ?? 'Staff Activity'}</strong><time datetime={new Date(item.created_at * 1000).toISOString()}>{new Date(item.created_at * 1000).toLocaleString()}</time>
            {#if item.business_id}<a href={`/staff/businesses/${encodeURIComponent(item.business_id)}`}>Open Business</a>{/if}</li>{:else}<li>No recent staff activity.</li>{/each}</ol>
        </section>
      {/if}
    </aside>
  </div>
</div>
