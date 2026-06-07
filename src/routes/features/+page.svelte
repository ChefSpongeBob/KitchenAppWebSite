<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';

	type CapabilityRow = {
		module: string;
		starter: string;
		growth: string;
		enterprise: string;
	};

	type FeatureBand = {
		title: string;
		summary: string;
		items: string[];
		image: string;
		alt: string;
		position?: string;
	};

	const serviceModes = ['Owner setup', 'Managers', 'Employees', 'Departments', 'Daily service'];
	const missionPoints = [
		'Each business gets its own workspace, staff, records, schedules, and app configuration.',
		'Owners can launch with the core setup first, then add modules and hardware as the operation grows.',
		'Managers run scheduling, onboarding, execution, and communication from one connected admin flow.'
	];

	const featureBands: FeatureBand[] = [
		{
			title: 'Workspace Setup',
			summary:
				'Create the restaurant workspace, register the business, set branding, choose visible modules, and keep every business data pool separate.',
			items: [
				'Business registry and restaurant display details',
				'Business logo and app branding area',
				'Feature controls for modules the team should see',
				'Tenant-scoped users, records, schedules, docs, and uploads'
			],
			image: '/marketing/app/admin-dashboard.png',
			alt: 'Manager dashboard showing workspace control area',
			position: 'top center'
		},
		{
			title: 'Employee Onboarding',
			summary:
				'Invite staff into the correct business, collect account setup information, send onboarding packet requirements, and review completion from admin.',
			items: [
				'Branded employee invite email',
				'Employee account setup from invite',
				'Base packet for profile, emergency contact, payroll setup, I-9, W-4, and acknowledgements',
				'State withholding slot when business state is registered',
				'Manager review and employee file history'
			],
			image: '/marketing/app/employee-homepage.png',
			alt: 'Employee workspace homepage',
			position: 'top center'
		},
		{
			title: 'Scheduling + Labor',
			summary:
				'Build weekly coverage across departments, track labor, publish schedules, and keep employee changes controlled through manager approval.',
			items: [
				'Multi-department schedule builder',
				'Department and role based scheduling',
				'My Schedule for employees',
				'Availability and time-off requests',
				'Shift offers, swaps, and manager approval',
				'Labor and coverage visibility'
			],
			image: '/marketing/app/scheduling-builder.png',
			alt: 'Schedule builder interface with shift controls',
			position: 'top center'
		},
		{
			title: 'Daily Execution',
			summary:
				'Move prep, checklists, inventory, orders, tasks, recipes, SOPs, and menus into one daily operations workspace.',
			items: [
				'Todo assignments and completion tracking',
				'Prep lists, checklists, inventory, and order lists',
				'Item attachments to recipes or documents',
				'Menu uploads and employee menu access',
				'Recipe categories and SOP/document access'
			],
			image: '/marketing/app/employee-homepage.png',
			alt: 'Employee homepage showing shift context and operation tiles',
			position: 'top center'
		},
		{
			title: 'Communication + Monitoring',
			summary:
				'Keep managers and staff aligned with live homepage context, announcements, specials, whiteboard ideas, vendors, and tier-based monitoring.',
			items: [
				'Announcements and specials',
				'Whiteboard ideas and voting',
				'Employee spotlight',
				'Vendor directory for admin users',
				'Temperature node monitoring and future camera expansion readiness',
				'History exports for schedules, prep, inventory, and orders'
			],
			image: '/marketing/app/admin-dashboard.png',
			alt: 'Manager dashboard with operations visibility',
			position: 'top center'
		}
	];

	const capabilityRows: CapabilityRow[] = [
		{
			module: 'Business workspace + tenant isolation',
			starter: 'Included',
			growth: 'Included',
			enterprise: 'Included'
		},
		{
			module: 'Business registry + app branding',
			starter: 'Included',
			growth: 'Included',
			enterprise: 'Included'
		},
		{
			module: 'Feature controls',
			starter: 'Included',
			growth: 'Included',
			enterprise: 'Included'
		},
		{
			module: 'Employee invites + onboarding packet',
			starter: 'Included',
			growth: 'Included',
			enterprise: 'Included'
		},
		{
			module: 'Schedule builder + publish',
			starter: 'Included',
			growth: 'Included',
			enterprise: 'Included'
		},
		{
			module: 'Multi-department scheduling',
			starter: 'Included',
			growth: 'Included',
			enterprise: 'Included'
		},
		{
			module: 'Labor tracking + coverage visibility',
			starter: 'Included',
			growth: 'Included',
			enterprise: 'Included'
		},
		{
			module: 'My Schedule, availability, time off',
			starter: 'Included',
			growth: 'Included',
			enterprise: 'Included'
		},
		{
			module: 'Shift offers, swaps, manager approval',
			starter: 'Included',
			growth: 'Included',
			enterprise: 'Included'
		},
		{
			module: 'Prep, checklist, inventory, order lists',
			starter: 'Included',
			growth: 'Included',
			enterprise: 'Included'
		},
		{
			module: 'Recipes, documents, SOPs, menus',
			starter: 'Included',
			growth: 'Included',
			enterprise: 'Included'
		},
		{
			module: 'Announcements, specials, whiteboard',
			starter: 'Included',
			growth: 'Included',
			enterprise: 'Included'
		},
		{
			module: 'Vendors + history exports',
			starter: 'Included',
			growth: 'Included',
			enterprise: 'Included'
		},
		{
			module: 'Temperature monitoring',
			starter: 'Medium+',
			growth: 'Included',
			enterprise: 'Included'
		},
		{
			module: 'Camera monitoring',
			starter: 'Planned',
			growth: 'Planned',
			enterprise: 'Planned'
		}
	];

</script>

<Layout>
	<section class="head" data-reveal style="--reveal-delay: 40ms;">
		<p class="eyebrow">Features</p>
		<h1>Everything needed to launch and run a restaurant workspace.</h1>
		<p class="head-copy">
			Crimini connects business setup, employee onboarding, scheduling, daily execution, knowledge, communication, and monitoring in one operating flow.
		</p>
		<div class="head-actions">
			<a href="/register#onboarding-slideshow" class="btn btn-primary">Start Trial</a>
			<a href="/pricing" class="btn">View Pricing</a>
		</div>
	</section>

	<section class="hero-band" data-reveal>
		<figure class="hero-media">
			<img
				src="/marketing/IMG_20230606_163319714.jpg"
				alt="Chef running active pass during service"
				loading="lazy"
			/>
		</figure>
		<div class="hero-copy">
			<h2>Designed for real shift speed</h2>
			<p>
				Owners configure the workspace once, managers control the operation, and employees see only the tools and information they need.
			</p>
			<p class="pipe-line">
				{#each serviceModes as mode}
					<span>| {mode} |</span>
				{/each}
			</p>
		</div>
	</section>

	<section class="principles-band" data-reveal>
		<header class="section-head">
			<p class="eyebrow">What We Build For</p>
			<h2>Launch structure first. Daily speed after.</h2>
		</header>
		<ul>
			{#each missionPoints as point}
				<li>{point}</li>
			{/each}
		</ul>
	</section>

	{#each featureBands as band, index}
		<section class="feature-band" class:reverse={index % 2 === 1} data-reveal>
			<figure class="band-media">
				<img src={band.image} alt={band.alt} loading="lazy" style={`--band-position:${band.position ?? 'center'};`} />
			</figure>
			<div class="band-copy">
				<h2>{band.title}</h2>
				<p>{band.summary}</p>
				<ul>
					{#each band.items as item}
						<li>{item}</li>
					{/each}
				</ul>
			</div>
		</section>
	{/each}

	<section class="capability-map" data-reveal>
		<header class="section-head">
			<p class="eyebrow">Capability Map</p>
			<h2>What is available across plans</h2>
		</header>
		<div class="table-shell">
			<table>
				<thead>
					<tr>
						<th>Module</th>
						<th>Small</th>
						<th>Medium</th>
						<th>Large</th>
					</tr>
				</thead>
				<tbody>
					{#each capabilityRows as row}
						<tr>
							<td>{row.module}</td>
							<td>{row.starter}</td>
							<td>{row.growth}</td>
							<td>{row.enterprise}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="bottom-cta" data-reveal>
		<div>
			<h2>Ready to replace disconnected tools?</h2>
			<p>Launch one workspace for onboarding, schedules, prep, documents, communication, and daily execution.</p>
		</div>
		<div class="head-actions">
			<a href="/register#onboarding-slideshow" class="btn btn-primary">Create Workspace</a>
			<a href="/how-it-works" class="btn">How It Works</a>
		</div>
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
		font-size: clamp(1.5rem, 3.8vw, 2.2rem);
		line-height: 1.12;
	}

	.head-copy {
		margin: 0;
		color: var(--color-text-muted);
		max-width: 66ch;
		font-size: 0.92rem;
		line-height: 1.5;
	}

	.head-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
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

	.hero-band,
	.feature-band {
		margin-top: 0.95rem;
		display: grid;
		grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
		gap: 0.76rem;
		align-items: stretch;
	}

	.feature-band.reverse .band-media {
		order: 2;
	}

	.feature-band.reverse .band-copy {
		order: 1;
	}

	.hero-media,
	.band-media {
		margin: 0;
		border-radius: 16px;
		overflow: hidden;
		border: 1px solid var(--color-border);
		background: color-mix(in srgb, var(--color-surface-alt) 92%, transparent);
		min-height: 200px;
		max-height: 290px;
		min-width: 0;
	}

	.hero-media img,
	.band-media img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: var(--band-position, top center);
		filter: saturate(0.94) contrast(1.08) brightness(1.04);
	}

	.hero-copy,
	.band-copy {
		display: grid;
		gap: 0.42rem;
		align-content: center;
		min-width: 0;
	}

	h2 {
		margin: 0;
		font-size: clamp(1.08rem, 2.8vw, 1.65rem);
	}

	.hero-copy p,
	.band-copy p {
		margin: 0;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	ul {
		margin: 0.3rem 0 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.28rem;
		color: var(--color-text-muted);
	}

	.pipe-line {
		margin-top: 0.25rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: 0.8rem;
		letter-spacing: 0.03em;
	}

	.principles-band {
		margin-top: 0.95rem;
		display: grid;
		gap: 0.5rem;
		padding-block: 0.95rem;
		border-block: 1px solid var(--color-divider);
	}

	.capability-map {
		margin-top: 1rem;
	}

	.section-head {
		display: grid;
		gap: 0.34rem;
	}

	.table-shell {
		margin-top: 0.62rem;
		overflow-x: auto;
		border-top: 1px solid var(--color-divider);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 640px;
	}

	th,
	td {
		text-align: left;
		padding: 0.62rem 0.7rem;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 86%, transparent);
		font-size: 0.82rem;
	}

	th {
		font-size: 0.74rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	tr:last-child td {
		border-bottom: none;
	}

	.bottom-cta {
		margin-top: 1rem;
		padding-block: 1rem;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.8rem;
		border-top: 1px solid var(--color-divider);
	}

	.bottom-cta h2 {
		margin: 0;
		font-size: 1.16rem;
	}

	.bottom-cta p {
		margin: 0.35rem 0 0;
		color: var(--color-text-muted);
	}

	@media (max-width: 980px) {
		.hero-band,
		.feature-band {
			grid-template-columns: 1fr;
		}

		.feature-band.reverse .band-media,
		.feature-band.reverse .band-copy {
			order: unset;
		}

		.hero-media,
		.band-media {
			max-height: 250px;
		}
	}

	@media (max-width: 760px) {
		.bottom-cta {
			flex-direction: column;
			align-items: flex-start;
		}

		.hero-media,
		.band-media {
			min-height: 170px;
			max-height: 210px;
		}
	}
</style>
