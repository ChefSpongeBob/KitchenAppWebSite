<script lang="ts">
  export let label = 'Day Off';
  export let showLabel = true;
  export let compact = false;
</script>

<div class:compact class="fish-school" aria-hidden="true">
  <img src="/fishsvg.svg" alt="" class="fish fish-a" />
  <img src="/fishsvg.svg" alt="" class="fish fish-b" />
  <img src="/fishsvg.svg" alt="" class="fish fish-c" />
  <img src="/fishsvg.svg" alt="" class="fish fish-d" />
  <img src="/fishsvg.svg" alt="" class="fish fish-e" />
</div>
{#if showLabel}
  <p class="label">{label}</p>
{/if}

<style>
  .fish-school {
    position: relative;
    width: 7.5rem;
    height: 3.2rem;
    margin: 0.15rem 0 0.25rem;
  }

  .fish {
    position: absolute;
    width: 1.3rem;
    height: 1.3rem;
    object-fit: contain;
    filter:
      brightness(0) saturate(100%) invert(94%) sepia(8%) saturate(369%) hue-rotate(307deg) brightness(104%) contrast(92%);
    opacity: 0.88;
  }

  .fish-a { left: 0.15rem; top: 1.1rem; transform: scale(0.82); }
  .fish-b { left: 1.45rem; top: 0.35rem; transform: scale(0.92); }
  .fish-c { left: 2.95rem; top: 1.25rem; transform: scale(1); }
  .fish-d { left: 4.65rem; top: 0.2rem; transform: scale(0.9); }
  .fish-e { left: 5.85rem; top: 1.2rem; transform: scale(0.78); }

  .label {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.82rem;
    line-height: 1.4;
  }

  .fish-school.compact {
    width: 5.3rem;
    height: 2.2rem;
    margin: 0;
  }

  .fish-school.compact .fish {
    width: 1rem;
    height: 1rem;
  }

  .fish-school.compact .fish-a { left: 0.05rem; top: 0.72rem; }
  .fish-school.compact .fish-b { left: 1rem; top: 0.1rem; }
  .fish-school.compact .fish-c { left: 2.1rem; top: 0.82rem; }
  .fish-school.compact .fish-d { left: 3.32rem; top: 0.02rem; }
  .fish-school.compact .fish-e { left: 4.18rem; top: 0.82rem; }
</style>
