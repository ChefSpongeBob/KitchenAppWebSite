<script lang="ts">
  export let title: string;
</script>

<div class="section">
  <h2>{title}</h2>
  <slot />
</div>

<style>
  .link-card a {
    color: var(--color-text) !important;
    text-decoration: none;
  }

  .link-card a:hover,
  .link-card a:focus {
    color: var(--color-primary) !important;
  }
  .section {
    margin-bottom: var(--space-6);
  }

  h2 {
    margin: 0 0 var(--space-3);
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
  }
</style>
