<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;
  const date = (value: number | null) => value ? new Date(value * 1000).toLocaleDateString() : 'Not set';
</script>
<h2>{data.business.name}</h2>
<dl class="staff-summary">
  <div><dt>Business ID</dt><dd>{data.business.id}</dd></div>
  <div><dt>Status</dt><dd>{data.business.status}</dd></div>
  <div><dt>Plan</dt><dd>{{ starter: 'Small', growth: 'Medium', enterprise: 'Large' }[data.business.plan_tier] ?? data.business.plan_tier}</dd></div>
  <div><dt>Members</dt><dd>{data.business.members}</dd></div>
  <div><dt>Gateways</dt><dd>{data.business.gateways}</dd></div>
  <div><dt>Created</dt><dd>{date(data.business.created_at)}</dd></div>
  <div><dt>Business Email</dt><dd>{data.business.contact_email || 'Not set'}</dd></div>
  <div><dt>Business Phone</dt><dd>{data.business.contact_phone || 'Not set'}</dd></div>
</dl>
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
