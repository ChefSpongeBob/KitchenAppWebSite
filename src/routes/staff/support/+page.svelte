<script lang="ts">
  import { page as pageState } from '$app/state';
  import { toStore } from 'svelte/store';
  import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from '#lib/support.ts';
  import SupportQueue from '#lib/components/staff/SupportQueue.svelte';
  import SupportRequestForm from '#lib/components/staff/SupportRequestForm.svelte';
  import type { PageData, ActionData } from './$types';
  const page = toStore(() => ({ ...pageState }));
  export let data: PageData;
  export let form: ActionData;
  function next() { const params = new URLSearchParams($page.url.searchParams.toString()); if (data.queue.next) params.set('after', data.queue.next); return `?${params}`; }
</script>
<header class="staff-business-context"><h2>Support</h2><a href={data.business ? `/staff/businesses/${encodeURIComponent(data.business.id)}?view=support` : '/staff/businesses'}>{data.business?.name ?? 'Find Business'}</a></header>
{#if form?.error}<p class="staff-feedback error" role="alert">{form.error}</p>{/if}
<form method="GET" class="staff-toolbar">
  {#if data.business}<input type="hidden" name="business" value={data.business.id} />{/if}
  <label>Status<select name="status" value={data.queue.status}><option value="active">Active</option>{#each Object.entries(SUPPORT_STATUSES) as [value, label]}<option {value}>{label}</option>{/each}<option value="all">All</option></select></label>
  <label>Category<select name="category" value={data.queue.category}><option value="">All Categories</option>{#each Object.entries(SUPPORT_CATEGORIES) as [value, label]}<option {value}>{label}</option>{/each}</select></label>
  <label>Priority<select name="priority" value={data.queue.priority}><option value="">All Priorities</option><option value="urgent">Urgent</option></select></label><button type="submit">Apply</button>
  {#if data.business}<a href="/staff/support">All Businesses</a>{/if}
</form>
<SupportQueue data={data.queue} staff />
{#if data.queue.next}<nav class="staff-pagination" aria-label="Support pages"><a href={next()}>More Requests</a></nav>{/if}
<section class="staff-panel">
  <details open={data.creating}><summary>Record Phone / Email Request</summary>
    {#if data.business}<h3>{data.business.name}</h3><SupportRequestForm submissionId={data.submissionId} businessId={data.business.id} action={`?/create&business=${encodeURIComponent(data.business.id)}&new=1`} />
    {:else}<p class="staff-note">Select the business before recording a request.</p><a href="/staff/businesses">Find Business</a>{/if}
  </details>
</section>
