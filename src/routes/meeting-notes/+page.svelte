<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  type MeetingNote = {
    id: string;
    content: string;
    authorId: string;
    createdAt: number;
    updatedAt: number;
    authorName: string | null;
    authorEmail: string | null;
    canEdit: boolean;
  };

  export let data: { notes?: MeetingNote[] };

  const notes = data.notes ?? [];

  function formatStamp(unix: number) {
    return new Date(unix * 1000).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  const withMeetingNoteFeedback: SubmitFunction = () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        if (result.data?.createSuccess) pushToast('Meeting note saved.', 'success');
        else if (result.data?.updateSuccess) pushToast('Meeting note updated.', 'success');
        else if (result.data?.deleteSuccess) pushToast('Meeting note deleted.', 'success');
      } else if (result.type === 'failure') {
        pushToast(
          result.data?.createError ??
            result.data?.updateError ??
            result.data?.deleteError ??
            'That meeting note change could not be saved.',
          'error'
        );
      }
    };
  };
</script>

<Layout>
  <PageHeader
    title="Meeting Notes"
    subtitle="Internal admin notes with shared visibility and individual ownership."
  />

  <section class="stack">
    <DashboardCard title="Add Note" description="Write a note, save it, and edit or remove it later.">
      <form method="POST" action="?/create_note" use:enhance={withMeetingNoteFeedback} class="composer">
        <textarea
          name="content"
          rows="7"
          placeholder="Type meeting notes, follow-ups, or reminders here..."
          required
        ></textarea>
        <div class="actions">
          <button type="submit">Save Note</button>
        </div>
      </form>
    </DashboardCard>

    <section class="notes-grid">
      {#if notes.length === 0}
        <DashboardCard title="No Notes Yet" description="Saved meeting notes will show up here." />
      {:else}
        {#each notes as note}
          <DashboardCard
            title={note.authorName ?? note.authorEmail ?? 'Admin note'}
            description={`Updated ${formatStamp(note.updatedAt)}`}
          >
            {#if note.canEdit}
              <form method="POST" action="?/update_note" use:enhance={withMeetingNoteFeedback} class="note-form">
                <input type="hidden" name="id" value={note.id} />
                <textarea name="content" rows="8" required>{note.content}</textarea>
                <div class="actions split">
                  <button type="submit">Save Changes</button>
                </div>
              </form>
              <form method="POST" action="?/delete_note" use:enhance={withMeetingNoteFeedback} class="delete-form">
                <input type="hidden" name="id" value={note.id} />
                <button type="submit" class="danger">Delete</button>
              </form>
            {:else}
              <article class="note-body">
                {#each note.content.split('\n') as paragraph}
                  <p>{paragraph}</p>
                {/each}
              </article>
            {/if}
          </DashboardCard>
        {/each}
      {/if}
    </section>
  </section>
</Layout>

<style>
  .stack {
    display: grid;
    gap: 1rem;
  }

  .composer,
  .note-form {
    display: grid;
    gap: 0.8rem;
  }

  .notes-grid {
    display: grid;
    gap: 1rem;
  }

  textarea {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 14px;
    background: color-mix(in srgb, var(--color-surface) 92%, black 8%);
    color: var(--color-text);
    padding: 0.9rem 1rem;
    font: inherit;
    resize: vertical;
    min-height: 10rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .split {
    justify-content: space-between;
  }

  button {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    padding: 0.65rem 1rem;
    border-radius: 999px;
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  }

  .delete-form {
    margin-top: 0.75rem;
    display: flex;
    justify-content: flex-end;
  }

  .danger {
    color: #fca5a5;
  }

  .note-body {
    display: grid;
    gap: 0.65rem;
    color: var(--color-text-muted);
    white-space: pre-wrap;
  }

  .note-body p {
    margin: 0;
  }

  @media (max-width: 760px) {
    textarea {
      min-height: 8.5rem;
      padding: 0.8rem 0.9rem;
    }

    .actions,
    .delete-form {
      justify-content: stretch;
    }

    button {
      width: 100%;
    }
  }
</style>
