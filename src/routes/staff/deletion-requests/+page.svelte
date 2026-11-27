<script lang="ts">
  import { DELETION_REVIEW_STATUSES } from '#lib/deletionRequests.ts';
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData;
  const label = (value: string) => Object.hasOwn(DELETION_REVIEW_STATUSES, value)
    ? DELETION_REVIEW_STATUSES[value as keyof typeof DELETION_REVIEW_STATUSES] : 'Other';
  const date = (value: number) => new Date(value * 1000).toLocaleString('en-US', { timeZone: 'America/Denver', timeZoneName: 'short' });
</script>

<svelte:head><title>Deletion Requests | Crimini Staff</title></svelte:head>
<header class="staff-business-context"><h2>Deletion Requests</h2>{#if data.detail}<a href="/staff/deletion-requests">All Requests</a>{/if}</header>
<p class="staff-note">Review only. Status changes do not delete data.</p>
{#if form?.error}<p class="staff-feedback error" role="alert">{form.error}</p>{/if}

{#if data.detail}
  <dl class="staff-summary">
    <div><dt>Request Type</dt><dd>{data.detail.request_scope === 'workspace' ? 'Business Workspace' : 'User Account'}</dd></div>
    <div><dt>Email Supplied</dt><dd>{data.detail.email}</dd></div>
    <div><dt>Workspace Supplied</dt><dd>{data.detail.workspace_name || 'Not supplied'}</dd></div>
    <div><dt>Signed-in Restaurant</dt><dd>{data.detail.business_name || 'No restaurant linked'}</dd></div>
    <div><dt>Received</dt><dd>{date(data.detail.created_at)}</dd></div>
    <div><dt>Last Reviewed</dt><dd>{data.detail.reviewed_at ? date(data.detail.reviewed_at) : 'Not reviewed'}</dd></div>
  </dl>
  <section class="staff-message"><h3>Request Details</h3><p>{data.detail.details || 'None supplied.'}</p></section>
  <p class="staff-note">Confirm identity and workspace authority separately before any deletion. Supplied details are not verification.</p>
  <form method="POST" action={`?request=${encodeURIComponent(data.detail.id)}&/review`} class="staff-toolbar">
    <input type="hidden" name="review_revision" value={data.detail.review_revision} />
    <label>Status<select name="status" value={data.detail.status}>
      {#if !Object.hasOwn(DELETION_REVIEW_STATUSES, data.detail.status)}<option value={data.detail.status} disabled>{label(data.detail.status)}</option>{/if}
      {#each Object.entries(DELETION_REVIEW_STATUSES) as [value, text]}<option {value}>{text}</option>{/each}
    </select></label>
    <button type="submit">Save Review</button>
  </form>
{:else if data.queue}
  <form method="GET" class="staff-toolbar">
    <label>Status<select name="status" value={data.queue.status}>
      {#each Object.entries(DELETION_REVIEW_STATUSES) as [value, text]}<option {value}>{text}</option>{/each}
      <option value="all">All</option>
    </select></label><button type="submit">Apply</button>
  </form>
  <div class="staff-table-wrap"><table>
    <thead><tr><th scope="col">Received</th><th scope="col">Email</th><th scope="col">Workspace Supplied</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Review</th></tr></thead>
    <tbody>{#each data.queue.requests as item (item.id)}<tr>
      <td>{date(item.created_at)}</td><td>{item.email}</td><td>{item.workspace_name || 'Not supplied'}</td>
      <td>{item.request_scope === 'workspace' ? 'Workspace' : 'Account'}</td><td>{label(item.status)}</td>
      <td><a href={`?request=${encodeURIComponent(item.id)}`} aria-label={`Review request from ${item.email}`}>Review</a></td>
    </tr>{:else}<tr><td colspan="6">No matching requests.</td></tr>{/each}</tbody>
  </table></div>
  {#if data.queue.next}<nav class="staff-pagination" aria-label="Request pages"><a href={`?status=${encodeURIComponent(data.queue.status)}`}>First Page</a><a href={`?status=${encodeURIComponent(data.queue.status)}&after=${encodeURIComponent(data.queue.next)}`}>Next Page</a></nav>{/if}
{/if}
