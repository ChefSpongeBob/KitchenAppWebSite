<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';

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
  export let form:
    | {
        createError?: string;
        updateError?: string;
        deleteError?: string;
        createSuccess?: boolean;
        updateSuccess?: boolean;
        deleteSuccess?: boolean;
      }
    | undefined;

  const notes = data.notes ?? [];

  function formatStamp(unix: number) {
    return new Date(unix * 1000).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
</script>

<Layout>
  <PageHeader
    title="Meeting Notes"
    subtitle="Internal admin notes with shared visibility and individual ownership."
  />

  <section class="stack">
    <DashboardCard title="Add Note" description="Write a note, save it, and edit or remove it later.">
      <form method="POST" action="?/create_note" class="composer">
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
      {#if form?.createError}
        <p class="status error">{form.createError}</p>
      {:else if form?.createSuccess}
        <p class="status success">Meeting note saved.</p>
      {/if}
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
              <form method="POST" action="?/update_note" class="note-form">
                <input type="hidden" name="id" value={note.id} />
                <textarea name="content" rows="8" required>{note.content}</textarea>
                <div class="actions split">
                  <button type="submit">Save Changes</button>
                </div>
              </form>
              <form method="POST" action="?/delete_note" class="delete-form">
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

    {#if form?.updateError}
      <p class="status error">{form.updateError}</p>
    {:else if form?.updateSuccess}
      <p class="status success">Meeting note updated.</p>
    {/if}

    {#if form?.deleteError}
      <p class="status error">{form.deleteError}</p>
    {:else if form?.deleteSuccess}
      <p class="status success">Meeting note deleted.</p>
    {/if}
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

  .status {
    margin: 0;
    font-size: 0.92rem;
  }

  .success {
    color: #9fd7af;
  }

  .error {
    color: #fca5a5;
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
