<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';

	type MeasureGroup = 'volume' | 'weight';
	type MeasureUnit = {
		key: string;
		label: string;
		shortLabel: string;
		factor: number;
	};

	const units: Record<MeasureGroup, MeasureUnit[]> = {
		volume: [
			{ key: 'tsp', label: 'Teaspoons', shortLabel: 'tsp', factor: 4.92892159375 },
			{ key: 'tbsp', label: 'Tablespoons', shortLabel: 'tbsp', factor: 14.78676478125 },
			{ key: 'floz', label: 'Fluid ounces', shortLabel: 'fl oz', factor: 29.5735295625 },
			{ key: 'cup', label: 'Cups', shortLabel: 'cup', factor: 236.5882365 },
			{ key: 'pint', label: 'Pints', shortLabel: 'pt', factor: 473.176473 },
			{ key: 'quart', label: 'Quarts', shortLabel: 'qt', factor: 946.352946 },
			{ key: 'gallon', label: 'Gallons', shortLabel: 'gal', factor: 3785.411784 },
			{ key: 'ml', label: 'Milliliters', shortLabel: 'mL', factor: 1 },
			{ key: 'liter', label: 'Liters', shortLabel: 'L', factor: 1000 }
		],
		weight: [
			{ key: 'gram', label: 'Grams', shortLabel: 'g', factor: 1 },
			{ key: 'kilogram', label: 'Kilograms', shortLabel: 'kg', factor: 1000 },
			{ key: 'ounce', label: 'Ounces', shortLabel: 'oz', factor: 28.349523125 },
			{ key: 'pound', label: 'Pounds', shortLabel: 'lb', factor: 453.59237 }
		]
	};

	const cupPresets = [
		{ label: '1/8 cup', value: 0.125 },
		{ label: '1/4 cup', value: 0.25 },
		{ label: '1/3 cup', value: 1 / 3 },
		{ label: '1/2 cup', value: 0.5 },
		{ label: '2/3 cup', value: 2 / 3 },
		{ label: '3/4 cup', value: 0.75 },
		{ label: '1 cup', value: 1 }
	];

	const cupChart = [
		{ measure: '1/8 cup', tablespoons: '2 tbsp', teaspoons: '6 tsp', liquid: '1 fl oz' },
		{ measure: '1/4 cup', tablespoons: '4 tbsp', teaspoons: '12 tsp', liquid: '2 fl oz' },
		{ measure: '1/3 cup', tablespoons: '5 tbsp + 1 tsp', teaspoons: '16 tsp', liquid: '2.67 fl oz' },
		{ measure: '1/2 cup', tablespoons: '8 tbsp', teaspoons: '24 tsp', liquid: '4 fl oz' },
		{ measure: '2/3 cup', tablespoons: '10 tbsp + 2 tsp', teaspoons: '32 tsp', liquid: '5.33 fl oz' },
		{ measure: '3/4 cup', tablespoons: '12 tbsp', teaspoons: '36 tsp', liquid: '6 fl oz' },
		{ measure: '1 cup', tablespoons: '16 tbsp', teaspoons: '48 tsp', liquid: '8 fl oz' }
	];

	const volumeChart = [
		{ measure: '1 tsp', kitchen: '1/3 tbsp', metric: '4.93 mL' },
		{ measure: '1 tbsp', kitchen: '3 tsp', metric: '14.79 mL' },
		{ measure: '1 fl oz', kitchen: '2 tbsp', metric: '29.57 mL' },
		{ measure: '1 cup', kitchen: '8 fl oz', metric: '236.59 mL' },
		{ measure: '1 pint', kitchen: '2 cups', metric: '473.18 mL' },
		{ measure: '1 quart', kitchen: '4 cups', metric: '0.946 L' },
		{ measure: '1 gallon', kitchen: '4 quarts', metric: '3.785 L' }
	];

	const weightChart = [
		{ measure: '1 oz', ounces: '1 oz', grams: '28.35 g' },
		{ measure: '4 oz', ounces: '1/4 lb', grams: '113.40 g' },
		{ measure: '8 oz', ounces: '1/2 lb', grams: '226.80 g' },
		{ measure: '1 lb', ounces: '16 oz', grams: '453.59 g' },
		{ measure: '1 kg', ounces: '2.205 lb', grams: '1000 g' }
	];

	let measureGroup: MeasureGroup = 'volume';
	let amount = 1;
	let fromUnit = 'cup';
	let toUnit = 'tbsp';

	$: activeUnits = units[measureGroup];
	$: fromMeasure = activeUnits.find((unit) => unit.key === fromUnit) ?? activeUnits[0];
	$: toMeasure = activeUnits.find((unit) => unit.key === toUnit) ?? activeUnits[1];
	$: safeAmount = Number.isFinite(amount) ? amount : 0;
	$: convertedAmount = (safeAmount * fromMeasure.factor) / toMeasure.factor;

	function setMeasureGroup(nextGroup: MeasureGroup) {
		measureGroup = nextGroup;
		fromUnit = nextGroup === 'volume' ? 'cup' : 'ounce';
		toUnit = nextGroup === 'volume' ? 'tbsp' : 'gram';
	}

	function useCupPreset(value: number) {
		measureGroup = 'volume';
		fromUnit = 'cup';
		if (!units.volume.some((unit) => unit.key === toUnit)) toUnit = 'tbsp';
		amount = value;
	}

	function formatAmount(value: number) {
		if (!Number.isFinite(value)) return '--';
		return new Intl.NumberFormat(undefined, {
			maximumFractionDigits: value >= 100 ? 2 : 4
		}).format(value);
	}
</script>

<svelte:head>
	<title>Conversions | Crimini</title>
</svelte:head>

<Layout>
	<PageHeader title="Conversions" />

	<section class="conversion-workbench" aria-label="Measurement converter">
		<div class="workbench-head">
			<div class="mode-switch" role="group" aria-label="Conversion type">
				<button type="button" class:active={measureGroup === 'volume'} on:click={() => setMeasureGroup('volume')}>
					Volume
				</button>
				<button type="button" class:active={measureGroup === 'weight'} on:click={() => setMeasureGroup('weight')}>
					Weight
				</button>
			</div>
			{#if measureGroup === 'weight'}
				<small>Ingredient volume-to-weight changes by ingredient.</small>
			{:else}
				<small>US kitchen volume measures.</small>
			{/if}
		</div>

		<div class="converter-grid">
			<label>
				<span>Amount</span>
				<input type="number" min="0" step="any" bind:value={amount} />
			</label>

			<label>
				<span>From</span>
				<select bind:value={fromUnit}>
					{#each activeUnits as unit}
						<option value={unit.key}>{unit.label}</option>
					{/each}
				</select>
			</label>

			<label>
				<span>To</span>
				<select bind:value={toUnit}>
					{#each activeUnits as unit}
						<option value={unit.key}>{unit.label}</option>
					{/each}
				</select>
			</label>

			<div class="result" aria-live="polite">
				<span>Result</span>
				<strong>{formatAmount(convertedAmount)} {toMeasure.shortLabel}</strong>
				<small>{formatAmount(safeAmount)} {fromMeasure.shortLabel}</small>
			</div>
		</div>

		<div class="preset-row" aria-label="Cup presets">
			{#each cupPresets as preset}
				<button type="button" on:click={() => useCupPreset(preset.value)}>{preset.label}</button>
			{/each}
		</div>
	</section>

	<section class="chart-grid" aria-label="Cooking measurement charts">
		<article class="chart-block">
			<h2>Cup breakdown</h2>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col">Cup</th>
							<th scope="col">Tablespoons</th>
							<th scope="col">Teaspoons</th>
							<th scope="col">Liquid</th>
						</tr>
					</thead>
					<tbody>
						{#each cupChart as row}
							<tr>
								<th scope="row">{row.measure}</th>
								<td>{row.tablespoons}</td>
								<td>{row.teaspoons}</td>
								<td>{row.liquid}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</article>

		<article class="chart-block">
			<h2>Volume</h2>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col">Measure</th>
							<th scope="col">Kitchen</th>
							<th scope="col">Metric</th>
						</tr>
					</thead>
					<tbody>
						{#each volumeChart as row}
							<tr>
								<th scope="row">{row.measure}</th>
								<td>{row.kitchen}</td>
								<td>{row.metric}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</article>

		<article class="chart-block">
			<h2>Weight</h2>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col">Measure</th>
							<th scope="col">Ounces / pounds</th>
							<th scope="col">Grams</th>
						</tr>
					</thead>
					<tbody>
						{#each weightChart as row}
							<tr>
								<th scope="row">{row.measure}</th>
								<td>{row.ounces}</td>
								<td>{row.grams}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</article>
	</section>
</Layout>

<style>
	.conversion-workbench {
		display: grid;
		gap: 0.95rem;
		margin-bottom: 1rem;
		padding: clamp(0.9rem, 2vw, 1.25rem);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: none;
	}

	.workbench-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		flex-wrap: wrap;
	}

	.workbench-head small,
	.result small {
		color: var(--color-text-muted);
	}

	.mode-switch,
	.preset-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.42rem;
	}

	button {
		min-height: 2.35rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-surface) 90%, var(--color-surface-alt) 10%);
		color: var(--color-text);
		padding: 0.42rem 0.78rem;
		font: inherit;
		font-size: 0.86rem;
		font-weight: var(--weight-semibold);
		cursor: pointer;
	}

	button:hover,
	button.active {
		border-color: var(--color-text);
	}

	button.active {
		background: var(--color-text);
		color: var(--color-bg);
	}

	.converter-grid {
		display: grid;
		grid-template-columns: minmax(120px, 0.8fr) repeat(2, minmax(160px, 1fr)) minmax(190px, 1fr);
		gap: 0.7rem;
		align-items: end;
	}

	label,
	.result {
		display: grid;
		gap: 0.36rem;
	}

	label span,
	.result span {
		color: var(--color-text-muted);
		font-size: 0.76rem;
		font-weight: var(--weight-semibold);
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	input,
	select {
		width: 100%;
		min-height: 3rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface-alt);
		color: var(--color-text);
		padding: 0.68rem 0.75rem;
		font: inherit;
	}

	.result {
		min-height: 4.85rem;
		align-content: center;
		padding: 0.72rem 0.85rem;
		border-left: 1px solid var(--color-border);
	}

	.result strong {
		font-size: clamp(1.2rem, 2vw, 1.75rem);
		line-height: 1.05;
	}

	.chart-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.chart-block {
		min-width: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		overflow: hidden;
	}

	.chart-block h2 {
		margin: 0;
		padding: 0.82rem 0.9rem;
		border-bottom: 1px solid var(--color-border);
		font-size: 1rem;
		font-weight: var(--weight-semibold);
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 320px;
	}

	th,
	td {
		padding: 0.62rem 0.7rem;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 72%, transparent);
		text-align: left;
		font-size: 0.88rem;
	}

	thead th {
		color: var(--color-text-muted);
		background: color-mix(in srgb, var(--color-surface-alt) 72%, transparent);
		font-size: 0.72rem;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	tbody th {
		font-weight: var(--weight-semibold);
	}

	tbody tr:last-child th,
	tbody tr:last-child td {
		border-bottom: 0;
	}

	@media (max-width: 980px) {
		.converter-grid,
		.chart-grid {
			grid-template-columns: 1fr;
		}

		.result {
			border-left: 0;
			border-top: 1px solid var(--color-border);
			padding-left: 0;
			padding-right: 0;
		}
	}

	@media (max-width: 560px) {
		button {
			flex: 1 1 auto;
		}

		table {
			min-width: 0;
		}

		th,
		td {
			padding: 0.54rem 0.48rem;
			font-size: 0.8rem;
		}
	}
</style>
