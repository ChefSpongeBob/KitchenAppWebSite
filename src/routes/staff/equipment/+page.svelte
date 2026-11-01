<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData;
  const pageUrl = (page: number) => `?${new URLSearchParams({ q: data.q, page: String(page), ...(data.business ? { business: data.business.id } : {}) })}`;
</script>
<h2>Equipment</h2>
{#if data.canAssign && !data.changesUnlocked}<p><a href={`/staff/security?next=${encodeURIComponent($page.url.pathname + $page.url.search)}`}>Verify Staff Access</a></p>{/if}
{#if form && 'error' in form}<p class="staff-feedback error" role="alert">{form.error}</p>{:else if form && 'message' in form}<p class="staff-feedback" role="status">{form.message}</p>{/if}
<form method="GET" class="staff-toolbar">
  {#if data.business}<input type="hidden" name="business" value={data.business.id} />{/if}
  <label>Search gateways<input name="q" value={data.q} maxlength="80" placeholder="Gateway serial" /></label>
  <button type="submit">Search</button>
</form>
{#if data.business}<p>Assign to <strong>{data.business.name}</strong> - <a href="/staff/businesses">Change Business</a></p>
{:else if data.canAssign}<p><a href="/staff/businesses">Choose Business</a></p>{/if}
<div class="staff-table-wrap"><table>
  <thead><tr><th>Gateway</th><th>Status</th><th>Business</th>{#if data.canAssign}<th>Assignment</th>{/if}</tr></thead>
  <tbody>{#each data.equipment as device}
    <tr><td>{device.serial}</td><td>{device.claim_status === 'available' && device.reserved_business_id ? 'Reserved' : device.claim_status}</td>
      <td>{device.claimed_business_name ?? device.reserved_business_name ?? 'Unassigned'}</td>
      {#if data.canAssign}<td>
        {#if device.claim_status === 'available' && !device.claimed_business_id}
          {#if device.reserved_business_id || data.business}
            <details><summary>{device.reserved_business_id ? 'Release Reservation' : 'Reserve Gateway'}</summary>
              <form method="POST" action={device.reserved_business_id ? '?/release' : '?/reserve'} use:enhance class="staff-toolbar">
                <input type="hidden" name="serial" value={device.serial} />
                {#if data.business}<input type="hidden" name="business_id" value={data.business.id} />{/if}
                <label>Reason<input name="reason" required maxlength="200" /></label>
                <label class="staff-confirm"><input type="checkbox" name="confirmed" value="yes" required />Confirm equipment change</label>
                <button type="submit" disabled={!data.changesUnlocked}>Confirm</button>
              </form>
            </details>
          {/if}
        {/if}
      </td>{/if}
    </tr>
  {:else}<tr><td colspan={data.canAssign ? 4 : 3}>No gateways found.</td></tr>{/each}</tbody>
</table></div>
<nav class="staff-pagination" aria-label="Equipment pages">
  {#if data.page > 1}<a href={pageUrl(data.page - 1)}>Previous</a>{/if}<span>Page {data.page}</span>
  {#if data.hasNext && data.page < 1000}<a href={pageUrl(data.page + 1)}>Next</a>{/if}
</nav>
