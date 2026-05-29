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
    background: transparent;
    border: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    padding: clamp(0.85rem, 1.6vw, 1.05rem) 0;
    overflow-wrap: anywhere;
    color: var(--color-text);
    box-shadow: none;
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
    margin-top: 0.5rem;
    color: var(--color-text);
  }

  @media (max-width: 760px) {
    .card {
      padding: 0.85rem 0;
      border-radius: 0;
    }

    .header h2 {
      font-size: 1rem;
      line-height: 1.2;
    }
  }
</style>

