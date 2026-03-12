<script lang="ts">
  export let title: string;
  export let subtitle: string | null = null;
</script>

<header class="page-header" aria-label={subtitle ? `${title} - ${subtitle}` : title}>
  <h1>{title}</h1>

  {#if subtitle}
    <p class="subtitle">{subtitle}</p>
  {/if}

  <img class="divider-blade" src="/sujihiki-divider.svg" alt="" aria-hidden="true" />
</header>

<style>
  .page-header {
    margin-bottom: var(--space-6);
    position: relative;
    padding-left: 1rem;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.65rem, 3.4vw, 2.35rem);
    font-weight: var(--weight-semibold);
    line-height: var(--line-tight);
  }

  header {
    padding-top: 3.25rem;
  }

  .subtitle {
    margin: var(--space-2) 0 0;
    font-size: 0.96rem;
    color: var(--color-text-muted);
    max-width: 42rem;
  }

  .divider-blade {
    display: block;
    width: 184px;
    height: auto;
    margin-top: 12px;
    filter: drop-shadow(0 2px 8px rgba(195, 32, 43, 0.18));
    opacity: 0.98;
  }

  .page-header::before {
    content: '';
    position: absolute;
    left: 0;
    top: 3.25rem;
    width: 4px;
    height: 44px;
    border-radius: 999px;
    background: linear-gradient(180deg, var(--color-primary), rgba(195, 32, 43, 0.12));
    box-shadow: 0 0 0 1px rgba(195, 32, 43, 0.08);
  }

  @media (max-width: 760px) {
    .page-header {
      margin-bottom: var(--space-4);
      padding-left: 0.85rem;
    }

    header {
      padding-top: 2.7rem;
    }

    .page-header::before {
      top: 2.7rem;
      height: 36px;
    }

    .divider-blade {
      width: 148px;
    }

    h1 {
      font-size: 1.48rem;
      line-height: 1.2;
    }
  }
</style>
