<script lang="ts" context="module">
  export type ReportToolbarLink = {
    href: string;
    label: string;
    icon: string;
    active?: boolean;
  };
</script>

<script lang="ts">
  export let exportHref = '';
  export let links: ReportToolbarLink[] = [];
</script>

<nav class="report-toolbar" aria-label="Report navigation">
  <a href="/reports">
    <span class="material-icons" aria-hidden="true">arrow_back</span>
    Reports
  </a>

  {#each links as link}
    <a href={link.href} class:active={link.active} aria-current={link.active ? 'page' : undefined}>
      <span class="material-icons" aria-hidden="true">{link.icon}</span>
      {link.label}
    </a>
  {/each}

  {#if exportHref}
    <a class="export-link" href={exportHref}>
      <span class="material-icons" aria-hidden="true">download</span>
      Full CSV
    </a>
  {/if}
</nav>

<style>
  .report-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem 0.9rem;
    padding: 0.68rem 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .report-toolbar a {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text);
    font-size: 0.76rem;
    font-weight: var(--weight-medium);
    text-decoration: none;
    white-space: nowrap;
  }

  .report-toolbar a.active {
    border-bottom-color: var(--color-text);
    font-weight: var(--weight-bold);
  }

  .report-toolbar .material-icons {
    color: var(--color-text-muted);
    font-size: 1rem;
    line-height: 1;
  }

  .report-toolbar .export-link {
    margin-left: auto;
    font-weight: var(--weight-semibold);
  }

  @media (max-width: 640px) {
    .report-toolbar .export-link {
      margin-left: 0;
    }
  }
</style>
