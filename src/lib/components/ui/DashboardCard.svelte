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
  .card {
    background: var(--color-surface, #1e1e1e);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: 16px;
  }

  .header h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .header p {
    margin: 4px 0 12px;
    opacity: 0.7;
    font-size: 0.9rem;
  }

  .content {
    margin-top: 8px;
  }
</style>
