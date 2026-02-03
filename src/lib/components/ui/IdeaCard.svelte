<script lang="ts">
  export let title = '';
  export let description = '';
  export let status = 'pending';
</script>

<div class="idea-card">
  <div class="content">
    <h3>{title}</h3>
    <p>{description}</p>
  </div>

  <div class="footer">
    <span class="badge">{status}</span>
    <slot name="actions" />
  </div>
</div>

<style>
  .idea-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    padding: var(--space-4);
    border-radius: var(--radius-lg);

    background: linear-gradient(
      180deg,
      rgba(255,255,255,0.04),
      rgba(255,255,255,0.01)
    );

    border: 1px solid rgba(255,255,255,0.08);

    backdrop-filter: blur(10px);

    min-height: 120px;
  }

  h3 {
    margin: 0 0 var(--space-2) 0;
    font-size: 1rem;
  }

  p {
    margin: 0;
    opacity: 0.8;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .footer {
    margin-top: var(--space-3);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  .badge {
    font-size: 0.7rem;
    opacity: 0.6;
    text-transform: uppercase;
  }
</style>

