<script lang="ts">
  import { page as pageState } from '$app/state';
  import { toStore } from 'svelte/store';
  const page = toStore(() => ({ ...pageState }));
  import type { loadGatewayAttention } from '#lib/server/platformStaffDashboard.ts';
  export let data: Awaited<ReturnType<typeof loadGatewayAttention>>;
  export let businessId: string | undefined = undefined;
  const date = (value: number | null) => value && value > 0 ? new Date(value * 1000).toLocaleString() : 'No contact recorded';
  function nextUrl() {
    const params = new URLSearchParams($page.url.searchParams.toString());
    if (data.next) params.set('gatewaysAfter', data.next);
    return `${$page.url.pathname}?${params}`;
  }
</script>
<section class="staff-panel" aria-labelledby="gateway-connections">
  <header class="staff-panel-heading"><h2 id="gateway-connections">{businessId ? 'Gateway Connections' : 'Gateway Attention'}</h2><a href={businessId ? `/staff/health?business=${encodeURIComponent(businessId)}` : '/staff/equipment'}>{businessId ? 'System Health' : 'Equipment'}</a></header>
  <div class="staff-table-wrap"><table><thead><tr>{#if !businessId}<th>Business</th>{/if}<th>Gateway</th><th>Status</th><th>Last Contact</th></tr></thead>
    <tbody>{#each data.gateways as gateway (gateway.id)}<tr>
      {#if !businessId}<td><a href={`/staff/businesses/${encodeURIComponent(gateway.business_id)}?view=equipment`}>{gateway.business_name}</a></td>{/if}
      <td><strong>{gateway.display_name}</strong><small class="staff-cell-meta">{gateway.external_device_id}</small></td><td class:staff-warning={gateway.connection !== 'Online'}>{gateway.connection}</td><td>{date(gateway.last_seen_at)}</td>
    </tr>{:else}<tr><td colspan={businessId ? 3 : 4}>{businessId ? 'No active gateways.' : 'No gateways currently need attention.'}</td></tr>{/each}</tbody>
  </table></div>
  {#if data.next}<nav class="staff-pagination" aria-label="Gateway pages"><a href={nextUrl()}>More Gateways</a></nav>{/if}
</section>
