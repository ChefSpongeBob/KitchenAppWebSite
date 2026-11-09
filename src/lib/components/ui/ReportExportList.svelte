<script lang="ts" context="module">
  export type ReportExportEntry = {
    title: string;
    meta: string;
    detail?: string;
    href: string;
    icon?: string;
  };
</script>

<script lang="ts">
  import { nativeServerUrl } from '#lib/client/nativeServerUrl.ts';

  export let entries: ReportExportEntry[] = [];
  export let empty = 'No report exports yet.';
  export let icon = 'description';
  export let collapsed = false;
  export let label = 'Downloads';
  export let partial = false;
</script>

<svelte:element this={collapsed ? 'details' : 'div'} class:download-history={collapsed}>
  {#if collapsed}
    <summary>{label}</summary>
  {/if}

  <section class="export-list">
    {#if entries.length}
      {#each entries as entry}
        <article class="export-row">
          <div class="export-main">
            <span class="material-icons" aria-hidden="true">{entry.icon ?? icon}</span>
            <div>
              <h2>{entry.title}</h2>
              <p>{partial ? 'Preview: ' : ''}{entry.meta}</p>
              {#if entry.detail}
                <small>{entry.detail}</small>
              {/if}
            </div>
          </div>
          <a href={nativeServerUrl(entry.href)}><span class="material-icons" aria-hidden="true">download</span>Download</a>
        </article>
      {/each}
    {:else}
      <p class="empty-state">{empty}</p>
    {/if}
  </section>
</svelte:element>

<style>
  :global(.main-content:has(.export-list)) {
    max-width: 1040px;
  }

  .export-list {
    display: grid;
    gap: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .download-history {
    border-bottom: 1px solid var(--color-divider);
  }

  .download-history summary {
    width: fit-content;
    padding: 0.8rem 0;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text);
    font-size: 0.76rem;
    font-weight: var(--weight-semibold);
    cursor: pointer;
  }

  .download-history .export-list {
    border-bottom: 0;
  }

  .export-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 1rem;
    align-items: center;
    min-height: 3.8rem;
    padding: 0.72rem 0;
    border-bottom: 1px solid var(--color-divider);
  }

  .export-row:last-child {
    border-bottom: 0;
  }

  .export-main {
    display: flex;
    align-items: center;
    gap: 0.72rem;
    min-width: 0;
  }

  .export-main > .material-icons {
    color: var(--color-text-muted);
    font-size: 1.15rem;
  }

  .export-main h2 {
    margin: 0;
    color: var(--color-text);
    font-size: 0.86rem;
    font-weight: var(--weight-semibold);
  }

  .export-main p,
  .export-main small {
    display: block;
    margin: 0.18rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  .export-row > a {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text);
    font-size: 0.76rem;
    font-weight: var(--weight-semibold);
    text-decoration: none;
    white-space: nowrap;
  }

  .export-row > a .material-icons {
    color: var(--color-text-muted);
    font-size: 1rem;
  }

  .empty-state {
    margin: 0;
    padding: 1rem 0;
    color: var(--color-text-muted);
  }

  @media (max-width: 720px) {
    .export-row {
      grid-template-columns: 1fr;
    }

    .export-row > a {
      justify-self: start;
    }
  }
</style>
