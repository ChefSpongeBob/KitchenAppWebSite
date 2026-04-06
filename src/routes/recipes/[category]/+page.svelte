<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import { fade } from 'svelte/transition';
  import { goto } from '$app/navigation';

  type Recipe = {
    id: string;
    title: string;
    ingredients: string;
    instructions: string;
  };

  export let data: { recipes?: Recipe[]; category?: string; query?: string };
  let recipes: Recipe[] = data.recipes ?? [];
  let category = data.category ?? '';
  let search = data.query ?? '';

  function normalizeBreaks(text: string): string {
    return (text ?? '').replace(/\\n/g, '\n');
  }

  function splitToLines(text: string): string[] {
    return normalizeBreaks(text)
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function splitIngredients(text: string): string[] {
    const lines = splitToLines(text);
    if (lines.length > 1) return lines;

    return (text ?? '')
      .split(',')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function parseInstructionSections(raw: string): { materials: string[]; instruction: string[] } {
    const normalized = normalizeBreaks(raw ?? '');
    const materialsMatch = normalized.match(
      /(?:Materials needed|Procedure):\s*([\s\S]*?)(?:\n\s*Instruction:\s*|$)/i
    );
    const instructionMatch = normalized.match(/Instruction:\s*([\s\S]*)$/i);

    const materialsRaw = materialsMatch?.[1]?.trim() ?? '';
    const instructionRaw = instructionMatch?.[1]?.trim() ?? normalized.trim();

    return {
      materials: splitToLines(materialsRaw),
      instruction: splitToLines(instructionRaw)
    };
  }

  function parseIngredients(raw: string): string[] {
    return splitIngredients(raw ?? '');
  }

  function parseIngredientSections(raw: string): Array<{ heading: string | null; items: string[] }> {
    const normalized = normalizeBreaks(raw ?? '').trim();
    if (!normalized) return [];

    const blocks = normalized
      .split(/\r?\n\s*\r?\n+/)
      .map((block) =>
        block
          .split(/\r?\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
      )
      .filter((block) => block.length > 0);

    if (blocks.length <= 1) {
      return [{ heading: null, items: splitIngredients(normalized) }];
    }

    return blocks.map((block) => {
      const [first, ...rest] = block;
      if (rest.length === 0) {
        return { heading: null, items: block };
      }

      return { heading: first, items: rest };
    });
  }

  function classifyInstructionLine(line: string): 'heading' | 'paragraph' {
    if (/^(quick tip|veg stock procedure|chicken stock procedure|final cook procedure)$/i.test(line)) {
      return 'heading';
    }

    return 'paragraph';
  }

  $: normalizedSearch = search.trim().toLowerCase();
  $: visibleRecipes =
    normalizedSearch.length < 2
      ? recipes
      : recipes.filter((recipe) => recipe.title.toLowerCase().includes(normalizedSearch));

  async function syncSearch(value: string) {
    const next = value.trim();
    await goto(
      next
        ? `/recipes/${category}?q=${encodeURIComponent(next)}`
        : `/recipes/${category}`,
      {
        replaceState: true,
        noScroll: true,
        keepFocus: true
      }
    );
  }
</script>

<PageHeader title={`Recipes: ${category}`} subtitle="Browse recipes in this category" />

<section class="search">
  <input
    type="search"
    placeholder="Search recipe by title..."
    bind:value={search}
    on:input={(event) => syncSearch((event.currentTarget as HTMLInputElement).value)}
    aria-label="Search recipe by title"
  />
</section>

{#if visibleRecipes.length > 0}
  <section class="grid">
    {#each visibleRecipes as r, index}
      <div in:fade={{ delay: index * 80, duration: 180 }}>
        <details class="recipe-details">
          <summary>{r.title}</summary>
          <DashboardCard title={r.title}>
            <div class="recipe-body">
              <h4>Ingredients</h4>
              {#each parseIngredientSections(r.ingredients) as section}
                {#if section.heading}
                  <h5>{section.heading}</h5>
                {/if}
                <ul>
                  {#each section.items as item}
                    <li>{item}</li>
                  {/each}
                </ul>
              {/each}

              <h4>Materials needed</h4>
              <ul>
                {#if parseInstructionSections(r.instructions).materials.length > 0}
                  {#each parseInstructionSections(r.instructions).materials as item}
                    <li>{item}</li>
                  {/each}
                {:else}
                  <li>No materials listed.</li>
                {/if}
              </ul>

              <hr class="section-divider" />

              <h4>Instruction</h4>
              <div class="instruction-flow">
                {#each parseInstructionSections(r.instructions).instruction as step}
                  {#if classifyInstructionLine(step) === 'heading'}
                    <h5>{step}</h5>
                  {:else}
                    <p>{step}</p>
                  {/if}
                {/each}
              </div>
            </div>
          </DashboardCard>
        </details>
      </div>
    {/each}
  </section>
{:else}
  <p class="search-empty">
    {#if normalizedSearch.length >= 2}
      No recipes found for this search.
    {:else}
      No recipes found for this category.
    {/if}
  </p>
{/if}

<style>
  .search {
    margin: 0.35rem 0 0.8rem;
  }

  .search input {
    width: 100%;
    max-width: 560px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.5rem 0.65rem;
    background: var(--color-surface-alt);
    color: var(--color-text);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .recipe-details {
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-surface);
    padding: 0.35rem 0.45rem;
  }

  .recipe-details > summary {
    list-style: none;
    cursor: pointer;
    font-weight: 600;
    color: var(--color-text);
    padding: 0.25rem 0.2rem;
  }

  .recipe-details > summary::-webkit-details-marker {
    display: none;
  }

  .recipe-body h4 {
    margin: 0.5rem 0 0.25rem;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  .recipe-body ul {
    margin: 0;
    padding-left: 1.05rem;
  }

  .recipe-body li {
    margin: 0.15rem 0;
  }

  .instruction-flow {
    display: grid;
    gap: 0.55rem;
  }

  .instruction-flow h5 {
    margin: 0.45rem 0 0;
    font-size: 0.84rem;
    color: var(--color-text);
    font-weight: var(--weight-semibold);
    letter-spacing: 0.02em;
  }

  .instruction-flow p {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.55;
  }

  .section-divider {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: 0.7rem 0;
  }

  .search-empty {
    margin: 0.45rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.86rem;
  }

  @media (max-width: 760px) {
    .search {
      margin-top: 0.2rem;
    }

    .grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .recipe-details {
      padding: 0.25rem 0.35rem;
    }
  }
</style>
