<script lang="ts">
  export let title: string;
  export let subtitle: string | null = null;
</script>

<header class="page-header">
  <h1>{title}</h1>

  {#if subtitle}
    <p class="subtitle">{subtitle}</p>
  {/if}
</header>


  <style>
  .link-card a {
    color: var(--color-text) !important;
    text-decoration: none;
  }

  .link-card a:hover,
  .link-card a:focus {
    color: var(--color-primary) !important;
  }

  .page-header {
    margin-bottom: var(--space-6);
  }

  h1 {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--weight-semibold);
    line-height: var(--line-tight);
  }

  header {
  padding-top: 3.5rem;
}


  .subtitle {
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
</style>
