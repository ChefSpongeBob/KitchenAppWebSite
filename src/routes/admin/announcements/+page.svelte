<script lang="ts">
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { SubmitFunction } from '$app/forms';
  import type { PageData, ActionData } from './$types';
  import Layout from '#lib/components/ui/Layout.svelte';
  import PageHeader from '#lib/components/ui/PageHeader.svelte';
  import ManagerSectionNav from '#lib/components/ui/ManagerSectionNav.svelte';
  import { pushToast } from '#lib/client/toasts.ts';

  export let data: PageData;
  export let form: ActionData;
  let editing = Boolean(form?.error);
  let pending = false;
  let message = '';
  let failed = false;

  function formatDate(value: number) {
    return new Date(value * 1000).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function preview(content: string) {
    const text = content.replace(/\s+/g, ' ').trim();
    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
  }

  const withFeedback: SubmitFunction = ({ formElement, cancel }) => {
    if (pending) { cancel(); return; }
    const publishing = formElement.getAttribute('action') === '?/save_announcement';
    pending = true;
    message = '';
    return async ({ result }) => {
      try {
        if (result.type === 'success') {
          await applyAction(result);
          await invalidateAll();
          if (publishing) editing = false;
          failed = false;
          message = publishing ? 'Announcement saved.' : 'History entry deleted.';
        } else if (result.type === 'failure') {
          await applyAction(result);
          failed = true;
          message = result.data?.error ?? 'Could not save. Try again.';
        } else {
          await applyAction(result);
        }
        if (message) pushToast(message, failed ? 'error' : 'success');
      } finally {
        pending = false;
      }
    };
  };
</script>

<Layout>
  <PageHeader title="Announcements" />
  <ManagerSectionNav groupId="workspace" />

  <div class="announcements-page">
    {#if message || form?.error}
      <p class="feedback" role={failed || form?.error ? 'alert' : 'status'}>{message || form?.error}</p>
    {/if}

    <section class="current-announcement">
      <header class="section-heading">
        <h2>Current announcement</h2>
      </header>
      {#if !editing}
        <p class="announcement-content">{data.announcement.content || 'No announcement posted.'}</p>
      {/if}
      <details class="announcement-editor" bind:open={editing}>
        <summary>{data.announcement.content ? 'Edit' : 'Add Announcement'}</summary>
        <form method="POST" action="?/save_announcement" use:enhance={withFeedback}>
          <label>
            <span>Announcement</span>
            <textarea name="content" rows="6" maxlength="2000">{data.announcement.content}</textarea>
          </label>
          <div class="actions">
            <button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Publish Announcement'}</button>
            <button type="button" disabled={pending} on:click={() => (editing = false)}>Cancel</button>
          </div>
        </form>
      </details>
      {#if data.announcement.updatedAt}<small>Updated {formatDate(data.announcement.updatedAt)}</small>{/if}
    </section>

    <section class="announcement-history">
      <header class="section-heading"><h2>Recent history</h2></header>
      {#if data.history.length === 0}
        <p class="empty-state">No saved announcements yet.</p>
      {:else}
        {#each data.history as entry (entry.id)}
          <details class="history-entry">
            <summary><span>{preview(entry.content)}</span><time datetime={new Date(entry.createdAt * 1000).toISOString()}>{formatDate(entry.createdAt)}</time></summary>
            <div class="history-content">
              <p class="announcement-content">{entry.content}</p>
              <div class="history-meta">
                <small>{entry.createdByName ?? entry.createdByEmail ?? 'Manager'}</small>
                <form method="POST" action="?/delete_announcement_history" use:enhance={withFeedback}>
                  <input type="hidden" name="history_id" value={entry.id} />
                  <button type="submit" disabled={pending}>Delete</button>
                </form>
              </div>
            </div>
          </details>
        {/each}
      {/if}
    </section>
  </div>
</Layout>

<style>
  .announcements-page { display: grid; gap: 1.5rem; padding-top: 1rem; min-width: 0; }
  section { min-width: 0; padding: 1rem 0; border-image: linear-gradient(90deg, var(--color-divider), transparent) 1; border-block: 1px solid; }
  .section-heading, .actions, .history-meta { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .section-heading { margin-bottom: 1rem; }
  h2 { margin: 0; font-size: 1rem; }
  button { font-size: .8rem; }
  small, time { color: var(--color-text-muted); font-size: .75rem; }
  form, label { display: grid; gap: .65rem; min-width: 0; }
  label > span { font-size: .8rem; }
  textarea { box-sizing: border-box; width: 100%; resize: vertical; }
  .actions { justify-content: flex-start; margin-bottom: .5rem; }
  .announcement-content { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.6; margin: .25rem 0 1rem; }
  .history-entry { border-bottom: 1px solid var(--color-divider); }
  .history-entry:last-child { border-bottom: 0; }
  summary { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding: .85rem 0; cursor: pointer; }
  summary > span { min-width: 0; overflow-wrap: anywhere; font-size: .85rem; }
  summary time { flex-shrink: 0; }
  .history-entry[open] summary { font-weight: var(--weight-bold); }
  .announcement-editor > summary { width: fit-content; text-decoration: underline; text-underline-offset: .3em; }
  .history-content { padding-bottom: 1rem; }
  .feedback, .empty-state { margin: 0; font-size: .85rem; }
  @media (max-width: 600px) {
    summary { flex-direction: column; gap: .35rem; }
  }
</style>
