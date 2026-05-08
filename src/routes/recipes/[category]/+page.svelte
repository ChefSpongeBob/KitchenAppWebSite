<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
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

    if (blocks.length <= 1) return [{ heading: null, items: splitIngredients(normalized) }];

    return blocks.map((block) => {
      const [first, ...rest] = block;
      return rest.length === 0 ? { heading: null, items: block } : { heading: first, items: rest };
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
    await goto(next ? `/recipes/${category}?q=${encodeURIComponent(next)}` : `/recipes/${category}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true
    });
  }
</script>

<PageHeader title={category} />

<section class="recipe-category">
  <div class="top-row">
    <a href="/recipes">Back to recipes</a>
    <input
      type="search"
      placeholder="Search this category"
      bind:value={search}
      on:input={(event) => syncSearch((event.currentTarget as HTMLInputElement).value)}
      aria-label="Search this category"
    />
  </div>

  {#if visibleRecipes.length > 0}
    <div class="recipe-list">
      {#each visibleRecipes as recipe}
        <details class="recipe-details">
          <summary>
            <span>{recipe.title}</span>
            <small>Open</small>
          </summary>

          <div class="recipe-body">
            <section>
              <h3>Ingredients</h3>
              {#each parseIngredientSections(recipe.ingredients) as section}
                {#if section.heading}
                  <h4>{section.heading}</h4>
                {/if}
                <ul>
                  {#each section.items as item}
                    <li>{item}</li>
                  {/each}
                </ul>
              {/each}
            </section>

            <section>
              <h3>Materials</h3>
              <ul>
                {#if parseInstructionSections(recipe.instructions).materials.length > 0}
                  {#each parseInstructionSections(recipe.instructions).materials as item}
                    <li>{item}</li>
                  {/each}
                {:else}
                  <li>No materials listed.</li>
                {/if}
              </ul>
            </section>

            <section class="instructions">
              <h3>Instruction</h3>
              {#each parseInstructionSections(recipe.instructions).instruction as step}
                {#if classifyInstructionLine(step) === 'heading'}
                  <h4>{step}</h4>
                {:else}
                  <p>{step}</p>
                {/if}
              {/each}
            </section>
          </div>
        </details>
      {/each}
    </div>
  {:else}
    <p class="empty">
      {#if normalizedSearch.length >= 2}
        No recipes found for this search.
      {:else}
        No recipes found for this category.
      {/if}
    </p>
  {/if}
</section>

<style>
  .recipe-category {
    display: grid;
    gap: 1rem;
  }

  .top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
  }

  .top-row a {
    color: var(--color-text-muted);
    text-decoration: none;
  }

  .top-row a:hover {
    color: var(--color-primary);
  }

  .top-row input {
    width: min(100%, 420px);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0.62rem 0.85rem;
    background: var(--surface-wash), var(--color-surface-alt);
    color: var(--color-text);
  }

  .recipe-list {
    display: grid;
    border-top: 1px solid var(--color-divider);
  }

  .recipe-details {
    border-bottom: 1px solid var(--color-divider);
  }

  .recipe-details > summary {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    min-height: 3.3rem;
    list-style: none;
    cursor: pointer;
  }

  .recipe-details > summary::-webkit-details-marker {
    display: none;
  }

  .recipe-details summary span {
    font-weight: var(--weight-semibold);
  }

  .recipe-details summary small,
  .empty {
    color: var(--color-text-muted);
  }

  .recipe-body {
    display: grid;
    grid-template-columns: minmax(180px, 0.32fr) minmax(180px, 0.28fr) minmax(0, 1fr);
    gap: 1.2rem;
    padding: 0.35rem 0 1.1rem;
  }

  .recipe-body h3,
  .recipe-body h4,
  .recipe-body p {
    margin: 0;
  }

  .recipe-body h3 {
    margin-bottom: 0.45rem;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .recipe-body h4 {
    margin: 0.65rem 0 0.25rem;
    font-size: 0.9rem;
  }

  .recipe-body ul {
    margin: 0;
    padding-left: 1.05rem;
  }

  .recipe-body li {
    margin: 0.18rem 0;
  }

  .instructions {
    display: grid;
    gap: 0.55rem;
  }

  .instructions p {
    color: var(--color-text-muted);
    line-height: 1.6;
  }

  @media (max-width: 900px) {
    .top-row {
      align-items: stretch;
      flex-direction: column;
    }

    .top-row input {
      width: 100%;
    }

    .recipe-body {
      grid-template-columns: 1fr;
      gap: 0.9rem;
    }
  }
</style>
