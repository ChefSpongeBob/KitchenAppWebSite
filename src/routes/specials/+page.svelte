<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';

  type Special = {
    category: 'roll' | 'nigiri' | 'sashimi' | 'kitchen';
    label: string;
    content: string;
    updatedAt: number;
  };

  export let data: { specials?: Special[]; canEdit?: boolean };
  export let form: { success?: boolean; error?: string } | undefined;

  const specials = data.specials ?? [];
  const canEdit = data.canEdit ?? false;

  function formatUpdatedAt(unix: number) {
    if (!unix) return 'Not updated yet';
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
    title="Daily Specials"
    subtitle="Roll, nigiri, sashimi, and kitchen features for the day."
  />

  <section class="grid">
    {#each specials as special}
      <details class="special-panel" open={Boolean(special.content)}>
        <summary>
          <div class="summary-copy">
            <strong>{special.label}</strong>
            <small>{formatUpdatedAt(special.updatedAt)}</small>
          </div>
          <span class="summary-preview">
            {special.content ? special.content : 'No special posted.'}
          </span>
        </summary>
        <DashboardCard title={special.label} description={`Updated ${formatUpdatedAt(special.updatedAt)}`}>
          <div class="special-copy">
            {#if special.content}
              {#each special.content.split('\n') as line}
                <p>{line}</p>
              {/each}
            {:else}
              <p class="muted">No special posted.</p>
            {/if}
          </div>
        </DashboardCard>
      </details>
    {/each}
  </section>

  {#if canEdit}
    <PageHeader
      title="Edit Specials"
      subtitle="Update the published specials for the service day."
    />
    <form method="POST" action="?/save_specials" class="editor">
      <section class="grid">
        {#each specials as special}
          <DashboardCard title={special.label} description={`Updated ${formatUpdatedAt(special.updatedAt)}`}>
            <textarea
              name={special.category}
              rows="6"
              placeholder={`Add today's ${special.label.toLowerCase()} special...`}
            >{special.content}</textarea>
          </DashboardCard>
        {/each}
      </section>
      <div class="actions">
        <button type="submit">Save Daily Specials</button>
      </div>
    </form>
  {/if}

  {#if form?.error}
    <p class="status error">{form.error}</p>
  {:else if form?.success}
    <p class="status success">Daily specials saved.</p>
  {/if}
</Layout>

<style>
  .editor {
    display: grid;
    gap: 1rem;
    margin-top: 1.25rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }

  .special-panel {
    border: 1px solid var(--color-border);
    border-radius: 16px;
    background: color-mix(in srgb, var(--color-surface) 94%, black 6%);
    overflow: hidden;
  }

  .special-panel summary {
    list-style: none;
    cursor: pointer;
    padding: 1rem;
    display: grid;
    gap: 0.45rem;
  }

  .special-panel summary::-webkit-details-marker {
    display: none;
  }

  .summary-copy {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: center;
  }

  .summary-copy strong {
    font-size: 0.95rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .summary-copy small {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    text-align: right;
  }

  .summary-preview {
    color: var(--color-text-muted);
    display: -webkit-box;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.4;
    font-size: 0.88rem;
  }

  textarea {
    width: 100%;
    min-height: 9rem;
    border: 1px solid var(--color-border);
    border-radius: 14px;
    background: color-mix(in srgb, var(--color-surface) 92%, black 8%);
    color: var(--color-text);
    padding: 0.9rem 1rem;
    font: inherit;
    resize: vertical;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  button {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    padding: 0.7rem 1rem;
    border-radius: 999px;
    font: inherit;
    cursor: pointer;
  }

  .special-copy {
    display: grid;
    gap: 0.45rem;
  }

  .special-copy p,
  .status {
    margin: 0;
  }

  .muted {
    color: var(--color-text-muted);
  }

  .success {
    color: #9fd7af;
  }

  .error {
    color: #fca5a5;
  }

  @media (max-width: 760px) {
    .summary-copy {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.3rem;
    }

    .actions {
      justify-content: stretch;
    }

    button {
      width: 100%;
    }
  }
</style>
