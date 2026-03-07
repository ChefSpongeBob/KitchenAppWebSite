<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import { fade } from 'svelte/transition';

  type Recipe = {
    id: string;
    title: string;
    ingredients: string;
    instructions: string;
  };

  export let data: { recipes?: Recipe[]; category?: string };
  let recipes: Recipe[] = data.recipes ?? [];
  let category = data.category ?? '';

  function splitToBullets(text: string): string[] {
    return text
      .split(/\n|,/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function parseInstructionSections(raw: string): { materials: string[]; instruction: string[] } {
    const normalized = raw ?? '';
    const materialsMatch = normalized.match(
      /(?:Materials needed|Procedure):\s*([\s\S]*?)(?:\n\s*Instruction:\s*|$)/i
    );
    const instructionMatch = normalized.match(/Instruction:\s*([\s\S]*)$/i);

    const materialsRaw = materialsMatch?.[1]?.trim() ?? '';
    const instructionRaw = instructionMatch?.[1]?.trim() ?? normalized.trim();

    return {
      materials: splitToBullets(materialsRaw),
      instruction: splitToBullets(instructionRaw)
    };
  }

  function parseIngredients(raw: string): string[] {
    return splitToBullets(raw ?? '');
  }
</script>

<PageHeader title={`Recipes: ${category}`} subtitle="Browse recipes in this category" />

{#if recipes.length > 0}
  <section class="grid">
    {#each recipes as r, index}
      <div in:fade={{ delay: index * 80, duration: 180 }}>
        <details class="recipe-details">
          <summary>{r.title}</summary>
          <DashboardCard title={r.title} description={r.ingredients}>
            <div class="recipe-body">
              <h4>Ingredients</h4>
              <ul>
                {#each parseIngredients(r.ingredients) as item}
                  <li>{item}</li>
                {/each}
              </ul>

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
              <ul>
                {#each parseInstructionSections(r.instructions).instruction as step}
                  <li>{step}</li>
                {/each}
              </ul>
            </div>
          </DashboardCard>
        </details>
      </div>
    {/each}
  </section>
{:else}
  <p>No recipes found for this category.</p>
{/if}

<style>
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

  .section-divider {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: 0.7rem 0;
  }

  @media (max-width: 760px) {
    .grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .recipe-details {
      padding: 0.25rem 0.35rem;
    }
  }
</style>
