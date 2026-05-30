<script lang="ts">
  type ItemAttachment = {
    id: string;
    targetType: 'recipe' | 'document';
    title: string;
    category: string;
    content?: string;
    fileUrl?: string;
    ingredients?: string;
    instructions?: string;
  };

  export let attachments: ItemAttachment[] = [];
  export let expanded = true;

  function normalizeBreaks(text: string) {
    return (text ?? '').replace(/\\n/g, '\n');
  }

  function splitLines(text: string) {
    return normalizeBreaks(text)
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function splitIngredients(text: string) {
    const lines = splitLines(text);
    if (lines.length > 1) return lines;
    return (text ?? '')
      .split(',')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function instructionLines(text: string) {
    const normalized = normalizeBreaks(text ?? '');
    const match = normalized.match(/Instruction:\s*([\s\S]*)$/i);
    return splitLines(match?.[1] ?? normalized);
  }
</script>

{#if attachments.length > 0}
  <div class="attachment-preview">
    {#each attachments as attachment}
      <details class="attachment-panel" open={expanded}>
        <summary>
          <span>{attachment.title}</span>
          <small>{attachment.targetType === 'recipe' ? 'Recipe' : 'Doc'}</small>
        </summary>

        {#if attachment.targetType === 'recipe'}
          <div class="recipe-preview">
            <section>
              <strong>Ingredients</strong>
              <ul>
                {#each splitIngredients(attachment.ingredients ?? '') as line}
                  <li>{line}</li>
                {/each}
              </ul>
            </section>
            <section>
              <strong>Steps</strong>
              {#each instructionLines(attachment.instructions ?? '') as line}
                <p>{line}</p>
              {/each}
            </section>
          </div>
        {:else}
          <div class="doc-preview">
            {#if attachment.content}
              <p>{attachment.content}</p>
            {/if}
            {#if attachment.fileUrl}
              <a href={attachment.fileUrl} target="_blank" rel="noreferrer">Open document</a>
            {/if}
          </div>
        {/if}
      </details>
    {/each}
  </div>
{/if}

<style>
  .attachment-preview {
    grid-column: 2 / -1;
    display: grid;
    gap: 0.45rem;
    padding-top: 0.1rem;
  }

  .attachment-panel {
    border-top: 1px solid var(--color-divider);
    padding-top: 0.45rem;
  }

  .attachment-panel > summary {
    display: flex;
    justify-content: space-between;
    gap: 0.7rem;
    align-items: center;
    cursor: pointer;
    list-style: none;
    color: var(--color-text);
  }

  .attachment-panel > summary::-webkit-details-marker {
    display: none;
  }

  .attachment-panel summary span {
    font-size: 0.86rem;
    font-weight: var(--weight-semibold);
  }

  .attachment-panel summary small {
    color: var(--color-text-muted);
    font-size: 0.72rem;
  }

  .recipe-preview {
    display: grid;
    grid-template-columns: minmax(160px, 0.4fr) minmax(0, 1fr);
    gap: 0.8rem;
    padding-top: 0.55rem;
  }

  .recipe-preview strong {
    display: block;
    margin-bottom: 0.3rem;
    color: var(--color-text-muted);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .recipe-preview ul,
  .recipe-preview p,
  .doc-preview p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.82rem;
    line-height: 1.5;
  }

  .recipe-preview ul {
    padding-left: 1rem;
  }

  .recipe-preview p + p {
    margin-top: 0.35rem;
  }

  .doc-preview {
    display: grid;
    gap: 0.45rem;
    padding-top: 0.55rem;
  }

  .doc-preview a {
    width: fit-content;
    color: var(--color-text);
    text-decoration: none;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.82rem;
  }

  @media (max-width: 760px) {
    .attachment-preview {
      grid-column: 1 / -1;
    }

    .recipe-preview {
      grid-template-columns: 1fr;
    }
  }
</style>
