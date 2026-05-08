<script>
  export let title = "";
  export let description = "";
</script>

<div class="card">
  {#if title}
    <div class="header">
      <h2>{title}</h2>
      {#if description}
        <p>{description}</p>
      {/if}
    </div>
  {/if}

  <div class="content">
    <slot />
  </div>
</div>

<style>
  :global(a) {
    color: inherit;
    text-decoration: none;
  }

  :global(a:hover),
  :global(a:focus) {
    color: inherit;
    text-decoration: none;
  }

  .card {
    position: relative;
    background: var(--surface-wash), var(--color-surface);
    border: 1px solid var(--surface-outline);
    border-radius: var(--radius-lg);
    padding: clamp(0.95rem, 1.8vw, 1.15rem);
    overflow-wrap: anywhere;
    color: var(--color-text);
    box-shadow: var(--shadow-xs);
  }

  .header h2 {
    margin: 0;
    font-size: clamp(1rem, 1.4vw, 1.12rem);
    line-height: 1.12;
    letter-spacing: -0.03em;
  }

  .header p {
    margin: 0.32rem 0 0.9rem;
    color: var(--color-text-muted);
    font-size: 0.84rem;
    letter-spacing: 0;
  }

  .content {
    margin-top: 8px;
    color: var(--color-text);
  }

  @media (max-width: 760px) {
    .card {
      padding: 14px;
      border-radius: var(--radius-md);
    }

    .header h2 {
      font-size: 1rem;
      line-height: 1.2;
    }
  }
</style>

