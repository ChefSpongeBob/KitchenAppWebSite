<script lang="ts" context="module">
  export type ReportMetric = {
    label: string;
    value: string | number;
  };
</script>

<script lang="ts">
  export let metrics: ReportMetric[] = [];
</script>

<section class="summary-strip" aria-label="Report summary">
  {#each metrics as metric}
    <div>
      <strong>{metric.value}</strong>
      <span>{metric.label}</span>
    </div>
  {/each}
</section>

<style>
  .summary-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    border-bottom: 1px solid var(--color-divider);
  }

  .summary-strip div {
    display: grid;
    gap: 0.16rem;
    padding: 0.82rem 1rem 0.82rem 0;
  }

  .summary-strip div + div {
    padding-left: 1rem;
    border-left: 1px solid var(--color-divider);
  }

  strong {
    color: var(--color-text);
    font-size: 1.08rem;
    font-weight: var(--weight-semibold);
  }

  span {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  @media (max-width: 560px) {
    .summary-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .summary-strip div:nth-child(odd) {
      padding-left: 0;
      border-left: 0;
    }
  }
</style>
