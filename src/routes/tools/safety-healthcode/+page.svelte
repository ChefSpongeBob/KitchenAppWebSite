<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';

	const cookTemps = [
		{ food: 'Poultry, stuffing, reheated leftovers', temp: '165 F', note: 'Chicken, turkey, stuffed items, casseroles, reheats.' },
		{ food: 'Ground meats', temp: '160 F', note: 'Ground beef, pork, veal, lamb.' },
		{ food: 'Whole cuts: beef, pork, veal, lamb', temp: '145 F + rest', note: 'Use a thermometer and rest before service.' },
		{ food: 'Fish and shellfish', temp: '145 F', note: 'Or opaque and separating easily where allowed.' },
		{ food: 'Egg dishes', temp: '160 F', note: 'Cook until set and verified.' }
	];

	const sanitizerBasics = [
		'Use test strips at setup and throughout service.',
		'Quat concentration commonly lives around 150-400 ppm depending on product and local rule.',
		'Follow the chemical label for exact ppm, contact time, and water temperature.',
		'Replace sanitizer when it is dirty, below range, or after the required interval.'
	];

	const quickRules = [
		{ title: 'Handwashing', detail: 'Wash hands and exposed arms for at least 20 seconds. Dry with a single-use towel or approved dryer.' },
		{ title: 'Cooling', detail: 'Cool hot food quickly in shallow pans, uncovered while cooling, and label before storage.' },
		{ title: 'Reheating', detail: 'Reheat previously cooked TCS food rapidly to 165 F before hot holding.' },
		{ title: 'Cold holding', detail: 'Keep cold TCS food at 41 F or below unless local code says otherwise.' },
		{ title: 'Hot holding', detail: 'Keep hot TCS food at 135 F or above unless local code says otherwise.' },
		{ title: 'Cross-contact', detail: 'Keep raw proteins, ready-to-eat food, allergens, and chemicals separated.' }
	];

	const boardColors = [
		{ color: 'Red', use: 'Raw meat' },
		{ color: 'Yellow', use: 'Raw poultry' },
		{ color: 'Blue', use: 'Seafood' },
		{ color: 'Green', use: 'Produce' },
		{ color: 'White', use: 'Bakery / dairy / ready-to-eat' },
		{ color: 'Brown', use: 'Cooked meats' }
	];
</script>

<svelte:head>
	<title>Safety & HealthCode | Crimini</title>
</svelte:head>

<Layout>
	<PageHeader title="Safety & HealthCode" />

	<section class="section-block">
		<header>
			<h2>Cooking Temperatures</h2>
			<small>Verify with a food thermometer.</small>
		</header>
		<div class="temp-list">
			{#each cookTemps as row}
				<article>
					<strong>{row.temp}</strong>
					<span>{row.food}</span>
					<small>{row.note}</small>
				</article>
			{/each}
		</div>
	</section>

	<section class="split-grid">
		<article class="section-block compact">
			<header>
				<h2>Sanitizer</h2>
				<small>Quat, chlorine, and other chemicals vary by label.</small>
			</header>
			<ul>
				{#each sanitizerBasics as item}
					<li>{item}</li>
				{/each}
			</ul>
		</article>

		<article class="section-block compact">
			<header>
				<h2>Fast Rules</h2>
				<small>Daily line reminders.</small>
			</header>
			<div class="rule-list">
				{#each quickRules as rule}
					<div>
						<strong>{rule.title}</strong>
						<span>{rule.detail}</span>
					</div>
				{/each}
			</div>
		</article>
	</section>

	<section class="section-block">
		<header>
			<h2>Cutting Board Colors</h2>
			<small>Use the house system if your kitchen labels boards differently.</small>
		</header>
		<div class="board-grid">
			{#each boardColors as board}
				<div>
					<strong>{board.color}</strong>
					<span>{board.use}</span>
				</div>
			{/each}
		</div>
	</section>

	<section class="source-strip" aria-label="Food safety source links">
		<a href="https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures" target="_blank" rel="noreferrer">FoodSafety.gov temperatures</a>
		<a href="https://www.fda.gov/food/retail-food-protection/fda-food-code" target="_blank" rel="noreferrer">FDA Food Code</a>
		<a href="https://www.fda.gov/food/buy-store-serve-safe-food/safe-food-handling" target="_blank" rel="noreferrer">FDA safe handling</a>
	</section>
</Layout>

<style>
	.section-block,
	.source-strip {
		border-top: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
		background: transparent;
	}

	.section-block {
		display: grid;
		gap: 0.9rem;
		margin-top: 1rem;
		padding: 1rem 0;
	}

	.section-block header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: end;
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	small,
	li,
	.rule-list span,
	.board-grid span {
		color: var(--color-text-muted);
	}

	.temp-list {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		border-top: 1px solid var(--color-divider);
	}

	.temp-list article,
	.board-grid div,
	.rule-list div {
		display: grid;
		gap: 0.25rem;
		padding: 0.8rem;
		border-right: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
	}

	.temp-list strong {
		font-size: 1.2rem;
	}

	.split-grid {
		display: grid;
		grid-template-columns: 0.9fr 1.1fr;
		gap: 1rem;
	}

	.compact {
		margin-top: 0;
	}

	ul {
		margin: 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.5rem;
	}

	.rule-list {
		display: grid;
		border-top: 1px solid var(--color-divider);
	}

	.board-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		border-top: 1px solid var(--color-divider);
	}

	.source-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem 1rem;
		margin-top: 1rem;
		padding: 0.85rem 0;
	}

	.source-strip a {
		color: var(--color-text);
		border-bottom: 1px solid var(--color-divider);
		text-decoration: none;
		font-weight: var(--weight-semibold);
	}

	@media (max-width: 900px) {
		.temp-list,
		.board-grid,
		.split-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
