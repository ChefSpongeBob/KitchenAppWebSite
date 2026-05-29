<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  export let data: {
    announcement: { content: string; updatedAt: number };
    canEdit: boolean;
  };

  function formatUpdatedAt(value: number) {
    return value
      ? new Date(value * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : 'Not updated yet';
  }

  const withFeedback: SubmitFunction = () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast('Announcement saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That announcement could not be saved.', 'error');
      }
    };
  };
</script>

<svelte:head>
  <title>Announcements | Crimini</title>
</svelte:head>

<Layout>
  <PageHeader title="Announcements" />

  <section class="announcement-shell">
    <article class="announcement-preview">
      <span>Current Announcement</span>
      {#if data.announcement.content}
        {#each data.announcement.content.split('\n') as line}
          <p>{line}</p>
        {/each}
      {:else}
        <p class="muted">Nothing posted.</p>
      {/if}
      <small>{formatUpdatedAt(data.announcement.updatedAt)}</small>
    </article>

    {#if data.canEdit}
      <form method="POST" action="?/save_announcement" use:enhance={withFeedback} class="announcement-editor">
        <label>
          <span>Announcement</span>
          <textarea name="content" rows="8">{data.announcement.content}</textarea>
        </label>
        <button type="submit">Save Announcement</button>
      </form>
    {/if}
  </section>
</Layout>

<style>
  .announcement-shell {
    display: grid;
    gap: 1rem;
    max-width: 54rem;
  }

  .announcement-preview,
  .announcement-editor {
    display: grid;
    gap: 0.8rem;
    padding: clamp(0.9rem, 2vw, 1.2rem) 0;
    border: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
  }

  .announcement-preview span,
  label span {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .announcement-preview p {
    margin: 0;
    color: var(--color-text);
    line-height: 1.5;
  }

  .announcement-preview small,
  .muted {
    color: var(--color-text-muted);
  }

  label {
    display: grid;
    gap: 0.45rem;
  }

  textarea {
    width: 100%;
    min-height: 10rem;
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    padding: 0.8rem;
    font: inherit;
    resize: vertical;
  }

  button {
    justify-self: end;
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    padding: 0.68rem 1rem;
    font: inherit;
    cursor: pointer;
  }

  @media (max-width: 640px) {
    button {
      width: 100%;
      justify-self: stretch;
    }
  }
</style>
