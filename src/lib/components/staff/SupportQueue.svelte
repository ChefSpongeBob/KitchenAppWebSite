<script lang="ts">
  import type { listSupportRequests } from '#lib/server/platformSupport.ts';
  import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from '#lib/support.ts';
  export let data: Awaited<ReturnType<typeof listSupportRequests>>;
  export let staff = false;
</script>
<div class="staff-table-wrap support-table-wrap"><table>
  <thead><tr><th>Request</th>{#if staff}<th>Business</th>{/if}<th>Status</th><th>Updated</th></tr></thead>
  <tbody>{#each data.requests as item (item.id)}<tr>
    <td><a href={staff ? `/staff/support/${encodeURIComponent(item.id)}` : `/support?request=${encodeURIComponent(item.id)}`}>{item.subject}</a><small>{SUPPORT_CATEGORIES[item.category as keyof typeof SUPPORT_CATEGORIES] ?? 'Support'}{item.priority === 'urgent' ? ' / Urgent' : ''}</small></td>
    {#if staff}<td><a href={`/staff/businesses/${encodeURIComponent(item.business_id)}?view=support`}>{item.business_name}</a></td>{/if}
    <td>{SUPPORT_STATUSES[item.status as keyof typeof SUPPORT_STATUSES] ?? item.status}</td><td>{new Date(item.updated_at * 1000).toLocaleString()}</td>
  </tr>{:else}<tr><td colspan={staff ? 4 : 3}>No matching requests.</td></tr>{/each}</tbody>
</table></div>
<style>
  .support-table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th, td { padding: 0.8rem 0.5rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--color-divider); }
  th { font-weight: 500; color: var(--color-text-muted); }
  td:first-child { max-width: 28rem; overflow-wrap: anywhere; }
  small { display: block; margin-top: 0.3rem; font-size: 0.67rem; color: var(--color-text-muted); }
</style>
