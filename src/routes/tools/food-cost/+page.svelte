<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';

	type IngredientRow = {
		id: string;
		name: string;
		purchasePrice: number;
		purchaseAmount: number;
		unit: string;
		usedAmount: number;
	};

	const units = ['oz', 'lb', 'g', 'kg', 'fl oz', 'cup', 'qt', 'gal', 'each'];

	let nextIngredientId = 1;
	let dishName = '';
	let salePrice = 0;
	let ingredients: IngredientRow[] = [createIngredient()];

	function createIngredient(): IngredientRow {
		return {
			id: `ingredient-${nextIngredientId++}`,
			name: '',
			purchasePrice: 0,
			purchaseAmount: 1,
			unit: 'lb',
			usedAmount: 0
		};
	}

	function addIngredient() {
		ingredients = [...ingredients, createIngredient()];
	}

	function removeIngredient(id: string) {
		ingredients = ingredients.length <= 1 ? [createIngredient()] : ingredients.filter((row) => row.id !== id);
	}

	function rowCost(row: IngredientRow) {
		const price = Number(row.purchasePrice);
		const amount = Number(row.purchaseAmount);
		const used = Number(row.usedAmount);
		if (!Number.isFinite(price) || !Number.isFinite(amount) || !Number.isFinite(used) || amount <= 0 || used < 0) {
			return 0;
		}
		return (price / amount) * used;
	}

	function money(value: number) {
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 2
		}).format(Number.isFinite(value) ? value : 0);
	}

	function percent(value: number) {
		return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0)}%`;
	}

	$: totalFoodCost = ingredients.reduce((sum, row) => sum + rowCost(row), 0);
	$: safeSalePrice = Number.isFinite(Number(salePrice)) ? Number(salePrice) : 0;
	$: profit = safeSalePrice - totalFoodCost;
	$: foodCostPercent = safeSalePrice > 0 ? (totalFoodCost / safeSalePrice) * 100 : 0;
	$: marginPercent = safeSalePrice > 0 ? (profit / safeSalePrice) * 100 : 0;
</script>

<svelte:head>
	<title>Food Cost Calculator | Crimini</title>
</svelte:head>

<Layout>
	<PageHeader title="Food Cost Calculator" />

	<section class="calculator-shell">
		<div class="summary-strip">
			<label>
				<span>Dish</span>
				<input bind:value={dishName} placeholder="Salmon entree" />
			</label>
			<label>
				<span>Sale Price</span>
				<input type="number" min="0" step="0.01" bind:value={salePrice} />
			</label>
			<div class="metric">
				<span>Food Cost</span>
				<strong>{money(totalFoodCost)}</strong>
			</div>
			<div class="metric">
				<span>Profit</span>
				<strong>{money(profit)}</strong>
			</div>
			<div class="metric">
				<span>Food Cost %</span>
				<strong>{percent(foodCostPercent)}</strong>
			</div>
			<div class="metric">
				<span>Margin</span>
				<strong>{percent(marginPercent)}</strong>
			</div>
		</div>

		<section class="ingredient-editor" aria-label="Ingredient costing rows">
			<header>
				<h2>{dishName.trim() || 'Dish Cost'}</h2>
				<button type="button" on:click={addIngredient}>Add Ingredient</button>
			</header>

			<div class="ingredient-list">
				{#each ingredients as row, index (row.id)}
					<div class="ingredient-row">
						<label class="name-field">
							<span>Ingredient</span>
							<input bind:value={ingredients[index].name} placeholder="Salmon" />
						</label>
						<label>
							<span>Price</span>
							<input type="number" min="0" step="0.01" bind:value={ingredients[index].purchasePrice} />
						</label>
						<label>
							<span>Amount Bought</span>
							<input type="number" min="0" step="any" bind:value={ingredients[index].purchaseAmount} />
						</label>
						<label>
							<span>Unit</span>
							<select bind:value={ingredients[index].unit}>
								{#each units as unit}
									<option value={unit}>{unit}</option>
								{/each}
							</select>
						</label>
						<label>
							<span>Used</span>
							<input type="number" min="0" step="any" bind:value={ingredients[index].usedAmount} />
						</label>
						<div class="line-cost">
							<span>Cost</span>
							<strong>{money(rowCost(row))}</strong>
						</div>
						<button type="button" class="remove-btn" aria-label="Remove ingredient" on:click={() => removeIngredient(row.id)}>
							Remove
						</button>
					</div>
				{/each}
			</div>
			<p class="tool-note">Use the same unit for amount bought and amount used on each ingredient row.</p>
		</section>
	</section>
</Layout>

<style>
	.calculator-shell {
		display: grid;
		gap: 1rem;
	}

	.summary-strip,
	.ingredient-editor {
		border-top: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
		background: transparent;
	}

	.summary-strip {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 0;
	}

	label,
	.metric,
	.line-cost {
		display: grid;
		gap: 0.35rem;
		padding: 0.85rem;
		border-right: 1px solid var(--color-divider);
	}

	label span,
	.metric span,
	.line-cost span {
		color: var(--color-text-muted);
		font-size: 0.74rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	input,
	select {
		width: 100%;
		border: 0;
		border-bottom: 1px solid var(--color-divider);
		border-radius: 0;
		background: transparent;
		color: var(--color-text);
	}

	.metric strong,
	.line-cost strong {
		color: var(--color-text);
		font-size: 1.1rem;
	}

	.ingredient-editor {
		padding: 0.85rem 0;
	}

	.ingredient-editor header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0 0 0.85rem;
		border-bottom: 1px solid var(--color-divider);
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	button {
		border: 0;
		border-bottom: 1px solid var(--color-divider);
		border-radius: 0;
		background: transparent;
		color: var(--color-text);
		font-weight: var(--weight-semibold);
	}

	.ingredient-list {
		display: grid;
	}

	.ingredient-row {
		display: grid;
		grid-template-columns: minmax(10rem, 1.5fr) repeat(4, minmax(6rem, 0.8fr)) minmax(5rem, 0.7fr) auto;
		align-items: end;
		border-bottom: 1px solid var(--color-divider);
	}

	.ingredient-row:last-child {
		border-bottom: 0;
	}

	.remove-btn {
		margin: 0.85rem;
		color: var(--color-text-muted);
	}

	.tool-note {
		margin: 0.75rem 0 0;
		color: var(--color-text-muted);
		font-size: 0.84rem;
	}

	@media (max-width: 900px) {
		.summary-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.ingredient-row {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 560px) {
		.summary-strip,
		.ingredient-row {
			grid-template-columns: 1fr;
		}

		label,
		.metric,
		.line-cost {
			border-right: 0;
			border-bottom: 1px solid var(--color-divider);
		}
	}
</style>
