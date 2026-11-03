<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;
  const planNames: Record<string, string> = { starter: 'Small', growth: 'Medium', enterprise: 'Large' };
</script>
<h2>Businesses</h2>
<form method="GET" class="staff-toolbar">
  <label>Search businesses<input name="q" value={data.q} maxlength="80" placeholder="Business name or ID" /></label>
  <button type="submit">Search</button>
</form>
<div class="staff-table-wrap">
  <table>
    <thead><tr><th>Business</th><th>Plan</th><th>Status</th></tr></thead>
    <tbody>
      {#each data.businesses as business}
        <tr><td><a href={`/staff/businesses/${encodeURIComponent(business.id)}`}>{business.name}</a></td><td>{planNames[business.plan_tier] ?? business.plan_tier}</td><td>{business.status}</td></tr>
      {:else}<tr><td colspan="3">No businesses found.</td></tr>{/each}
    </tbody>
  </table>
</div>
<nav class="staff-pagination" aria-label="Business pages">
  {#if data.hasPrevious}<a href={`?${new URLSearchParams({ q: data.q })}`}>First Results</a>{/if}
  {#if data.next}<a href={`?${new URLSearchParams({ q: data.q, afterName: data.next.name, afterId: data.next.id })}`}>More Businesses</a>{/if}
</nav>
