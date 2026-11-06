<script lang="ts">
  import { enhance } from '$app/forms';
  import { page as pageState } from '$app/state';
  import { toStore } from 'svelte/store';
  import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from '#lib/support.ts';
  import type { loadSupportRequest } from '#lib/server/platformSupport.ts';
  const page = toStore(() => ({ ...pageState }));
  export let data: Awaited<ReturnType<typeof loadSupportRequest>>;
  export let staff = false;
  export let action = '?/reply';
  let sending = false;
  function older() {
    const params = new URLSearchParams($page.url.searchParams.toString());
    params.delete('/reply'); if (data.next) params.set('messagesAfter', data.next);
    return `${$page.url.pathname}?${params}`;
  }
</script>
<section class="support-conversation">
  <header class="staff-record-header"><h2>{data.request.subject}</h2><p class="support-meta">{SUPPORT_CATEGORIES[data.request.category as keyof typeof SUPPORT_CATEGORIES]} / {SUPPORT_STATUSES[data.request.status as keyof typeof SUPPORT_STATUSES]}{data.request.priority === 'urgent' ? ' / Urgent' : ''}</p></header>
  {#if staff && data.contact}<p class="support-meta">{data.contact.display_name ?? 'Customer'} / {data.contact.email}</p>{/if}
  {#if data.next}<a href={older()}>Older Messages</a>{/if}
  <div class="support-messages">
    {#each data.messages as message (message.id)}<article class="staff-message support-message">
      <header><strong>{message.author_type === 'staff' ? 'Crimini Staff' : staff ? 'Customer' : 'You'}</strong><time>{new Date(message.created_at * 1000).toLocaleString()}</time>{#if message.visibility === 'internal'}<span>Internal Note</span>{/if}</header>
      <p>{message.body}</p>
    </article>{/each}
  </div>
  {#if staff || data.request.status !== 'closed'}
    <form method="POST" {action} class="support-response" use:enhance={() => { sending = true; return async ({ update }) => { try { await update({ navigate: false }); } finally { sending = false; } }; }}>
      <input type="hidden" name="request_id" value={data.request.id} /><input type="hidden" name="business_id" value={data.request.business_id} /><input type="hidden" name="revision" value={data.request.revision} />
      {#if staff}<div class="staff-toolbar">
        <label>Message Type<select name="visibility">{#if data.request.requester_user_id}<option value="customer">Reply to Customer</option>{/if}<option value="internal">Internal Note</option></select></label>
        <label>Status<select name="status" value={data.request.status}>{#each Object.entries(SUPPORT_STATUSES) as [value, label]}<option {value}>{label}</option>{/each}</select></label>
        <label>Priority<select name="priority" value={data.request.priority}><option value="normal">Normal</option><option value="urgent">Urgent</option></select></label>
      </div>{/if}
      <label>{staff ? 'Message (optional for status changes)' : 'Reply'}<textarea name="body" maxlength="4000" required={!staff} rows="4"></textarea></label>
      <p class="support-meta">{staff ? 'Replies appear on the customer Support page; no automatic email. Internal notes stay in Staff.' : 'Do not include passwords, banking details, tax forms, or identity documents.'}</p>
      <button type="submit" disabled={sending}>{sending ? 'Saving...' : staff ? 'Save Update' : 'Send Reply'}</button>
    </form>
  {:else}<p class="support-meta">This request is closed. You can create a new request if you need more help.</p>{/if}
</section>
<style>
  .support-meta { color: var(--color-text-muted); font-size: 0.74rem; }
  .support-message { padding-block: 1rem; border-bottom: 1px solid var(--color-divider); }
  .support-message header { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; font-size: 0.72rem; color: var(--color-text-muted); }
  .support-message p { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.85rem; margin: 0.6rem 0 0; }
  .support-response { display: grid; gap: 0.8rem; margin-top: 1.2rem; }
  label { display: grid; gap: 0.3rem; font-size: 0.8rem; }
  textarea { width: 100%; min-height: 6rem; resize: vertical; box-sizing: border-box; }
  button { justify-self: start; }
</style>
