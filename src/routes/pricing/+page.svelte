<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';

	const plans = [
		{
			name: 'Small',
			price: '$50/mo',
			target: 'Lean team launch',
			description: 'Built for focused teams getting live quickly.',
			items: [
				'Up to 20 employees',
				'Core scheduling, todo, and lists',
				'Temperature monitoring add-on available (+$30/mo)',
				'Camera monitoring add-on available (+$30/mo)'
			]
		},
		{
			name: 'Medium',
			price: '$120/mo',
			target: 'Growing operations',
			description: 'For active teams needing stronger control tooling.',
			recommended: true,
			items: [
				'Up to 75 users',
				'Advanced admin and editor controls',
				'Temperature monitoring add-on available (+$30/mo)',
				'Camera monitoring add-on available (+$30/mo)'
			]
		},
		{
			name: 'Large',
			price: '$275/mo',
			target: 'Scaled service teams',
			description: 'For high-capacity teams running full platform coverage.',
			items: [
				'Up to 250 employees',
				'Full platform + multi-team scale',
				'Temperature monitoring included',
				'Camera monitoring included'
			]
		}
	];

	const comparisons = [
		{
			label: 'Users',
			starter: 'Up to 20',
			growth: 'Up to 75',
			enterprise: 'Up to 250'
		},
		{
			label: 'Schedule Builder',
			starter: 'Yes',
			growth: 'Yes',
			enterprise: 'Yes'
		},
		{
			label: 'Role + Department Controls',
			starter: 'Core',
			growth: 'Advanced',
			enterprise: 'Full'
		},
		{
			label: 'Temperature Sensors',
			starter: 'Optional +$30/mo',
			growth: 'Optional +$30/mo',
			enterprise: 'Included'
		},
		{
			label: 'Camera Monitoring',
			starter: 'Optional +$30/mo',
			growth: 'Optional +$30/mo',
			enterprise: 'Included'
		}
	];

	const includedModules = [
		'Schedule builder and employee my-schedule views',
		'Prep lists, checklists, inventory, and orders',
		'Recipes, document library, and SOP pages',
		'Todo assignments, whiteboard, and announcements',
		'Monitoring dashboards (active when add-ons are enabled)'
	];

	const launchNotes = [
		'No long setup cycles: launch core workflows quickly.',
		'Pricing is aligned to frontline usage, not office-only seats.',
		'Start small and scale up as teams and locations grow.'
	];
</script>

<Layout>
	<section class="head" data-reveal style="--reveal-delay: 40ms;">
		<p class="eyebrow">Pricing</p>
		<h1>Straightforward pricing for active kitchen teams.</h1>
		<p>
			Choose a plan by team size and operational complexity. Add-ons stay optional on every tier.
		</p>
		<div class="head-actions">
			<a href="/register#onboarding-slideshow" class="btn btn-primary">Start Trial</a>
			<a href="/features" class="btn">See Features</a>
		</div>
		<div class="store-badge-row" aria-label="Supported store billing platforms">
			<img src="/store-badges/google-play-badge.svg" alt="Get it on Google Play" class="store-badge" loading="lazy" />
			<img src="/store-badges/app-store-badge.svg" alt="Download on the App Store" class="store-badge" loading="lazy" />
		</div>
	</section>

	<section class="pricing-band" data-reveal>
		<figure class="pricing-media">
			<img src="/marketing/app/scheduling-builder.png" alt="Schedule builder interface in active use" loading="lazy" />
		</figure>
		<div class="pricing-copy">
			<h2>From first launch to scaled operations</h2>
			<p>
				Plans cover the same core product, then expand with user capacity and management depth.
			</p>
			<ul>
				{#each launchNotes as note}
					<li>{note}</li>
				{/each}
			</ul>
		</div>
	</section>

	<section class="plans" data-reveal>
		{#each plans as plan}
			<article class="plan" class:recommended={plan.recommended}>
				{#if plan.recommended}
					<p class="recommended-tag">Most Popular</p>
				{/if}
				<h2>{plan.name}</h2>
				<p class="price">{plan.price}</p>
				<p class="target">{plan.target}</p>
				<p class="description">{plan.description}</p>
				<ul>
					{#each plan.items as item}
						<li>{item}</li>
					{/each}
				</ul>
				<a href="/register#onboarding-slideshow" class="plan-btn">
					{plan.name === 'Large' ? 'Contact Sales' : 'Start Trial'}
				</a>
			</article>
		{/each}
	</section>

	<section class="module-strip" data-reveal>
		<header class="section-head">
			<p class="eyebrow">Included In Every Plan</p>
			<h2>Core modules included in every workspace</h2>
		</header>
		<ul class="module-list">
			{#each includedModules as module}
				<li>{module}</li>
			{/each}
		</ul>
	</section>

	<section class="compare" data-reveal>
		<header class="section-head">
			<p class="eyebrow">Compare Plans</p>
			<h2>Quick plan breakdown</h2>
		</header>
		<div class="table-shell">
			<table>
				<thead>
					<tr>
						<th>Feature</th>
						<th>Small</th>
						<th>Medium</th>
						<th>Large</th>
					</tr>
				</thead>
				<tbody>
					{#each comparisons as row}
						<tr>
							<td>{row.label}</td>
							<td>{row.starter}</td>
							<td>{row.growth}</td>
							<td>{row.enterprise}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="cta" data-reveal>
		<a href="/register#onboarding-slideshow" class="btn btn-primary">Register Business</a>
		<a href="/login" class="btn btn-ghost">Sign In</a>
		<a href="/how-it-works" class="btn btn-ghost">How It Works</a>
	</section>
</Layout>

<style>
	.head {
		display: grid;
		gap: 0.45rem;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.76rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	h1 {
		margin: 0;
		font-size: clamp(1.45rem, 3.6vw, 2.05rem);
		line-height: 1.1;
	}

	.head p {
		margin: 0;
		color: var(--color-text-muted);
		max-width: 66ch;
		line-height: 1.5;
	}

	.head-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.store-badge-row {
		margin-top: 0.55rem;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.52rem;
		width: min(100%, 24rem);
	}

	.store-badge {
		width: 100%;
		height: auto;
		display: block;
		border-radius: 0.5rem;
		border: 1px solid color-mix(in srgb, var(--color-border) 82%, transparent);
		background: color-mix(in srgb, var(--color-surface-alt) 88%, transparent);
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		border: 1px solid var(--color-border);
		background: var(--color-surface-alt);
		color: var(--color-text);
		border-radius: 10px;
		padding: 0.58rem 0.84rem;
		font-weight: var(--weight-semibold);
	}

	.btn-primary {
		background: linear-gradient(180deg, rgba(122, 132, 148, 0.26), rgba(122, 132, 148, 0.14));
		border-color: rgba(122, 132, 148, 0.36);
	}

	.btn-ghost {
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.pricing-band {
		margin-top: 0.95rem;
		display: grid;
		grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
		gap: 0.76rem;
		align-items: stretch;
	}

	.pricing-media {
		margin: 0;
		border-radius: 16px;
		overflow: hidden;
		border: 1px solid var(--color-border);
		background: color-mix(in srgb, var(--color-surface-alt) 92%, transparent);
		max-height: 270px;
	}

	.pricing-media img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		filter: saturate(0.94) contrast(1.08) brightness(1.04);
	}

	.pricing-copy {
		display: grid;
		gap: 0.42rem;
		align-content: center;
	}

	h2 {
		margin: 0;
		font-size: clamp(1.08rem, 2.8vw, 1.6rem);
	}

	.pricing-copy p {
		margin: 0;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	ul {
		margin: 0.26rem 0 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.28rem;
		color: var(--color-text-muted);
	}

	.plans,
	.module-strip,
	.compare,
	.cta {
		margin-top: 1rem;
	}

	.plans {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1px;
		border: 1px solid var(--color-divider);
		border-radius: 16px;
		overflow: hidden;
		background: var(--color-divider);
	}

	.plan {
		padding: 0.9rem;
		background: var(--surface-wash), var(--color-surface);
		display: grid;
		gap: 0.1rem;
	}

	.plan.recommended {
		border-color: color-mix(in srgb, var(--color-primary) 46%, var(--color-border));
		box-shadow: 0 14px 34px rgba(6, 10, 16, 0.28);
	}

	.recommended-tag {
		margin: 0;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: color-mix(in srgb, var(--color-primary) 72%, var(--color-text));
		font-weight: var(--weight-semibold);
	}

	.price {
		margin: 0.24rem 0 0;
		font-size: 1.06rem;
		font-weight: var(--weight-semibold);
	}

	.target {
		margin: 0.2rem 0 0;
		font-size: 0.84rem;
		color: var(--color-text-muted);
	}

	.description {
		margin: 0.26rem 0 0;
		font-size: 0.79rem;
		line-height: 1.45;
		color: var(--color-text-muted);
	}

	.plan-btn {
		margin-top: 0.7rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		border: 1px solid color-mix(in srgb, var(--color-border) 84%, transparent);
		border-radius: 10px;
		padding: 0.5rem 0.76rem;
		background: color-mix(in srgb, var(--color-surface-alt) 90%, transparent);
		color: var(--color-text);
		font-weight: var(--weight-semibold);
		font-size: 0.86rem;
	}

	.section-head {
		display: grid;
		gap: 0.3rem;
	}

	.module-list {
		margin-top: 0.62rem;
		columns: 2;
		column-gap: 1.4rem;
	}

	.module-list li {
		break-inside: avoid;
		margin-bottom: 0.42rem;
	}

	.table-shell {
		margin-top: 0.62rem;
		overflow-x: auto;
		border-top: 1px solid var(--color-divider);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 620px;
	}

	th,
	td {
		text-align: left;
		padding: 0.62rem 0.7rem;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 86%, transparent);
		font-size: 0.82rem;
	}

	th {
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	tr:last-child td {
		border-bottom: none;
	}

	.cta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	@media (max-width: 980px) {
		.pricing-band {
			grid-template-columns: 1fr;
		}

		.pricing-media {
			max-height: 230px;
		}
	}

	@media (max-width: 900px) {
		.plans,
		.module-list {
			columns: 1;
		}

		.plans {
			grid-template-columns: 1fr;
		}

		.store-badge-row {
			width: min(100%, 22rem);
		}

		.pricing-media {
			max-height: 210px;
		}
	}
</style>
