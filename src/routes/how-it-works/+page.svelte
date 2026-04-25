<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';

	type WorkflowStep = {
		step: string;
		title: string;
		summary: string;
		items: string[];
		image: string;
		alt: string;
		position?: string;
	};

	type WeekStep = {
		dayRange: string;
		title: string;
		items: string[];
	};

	const quickStats = ['1 workspace', 'Live view', 'Desktop + mobile'];

	const workflowSteps: WorkflowStep[] = [
		{
			step: '01',
			title: 'Set Up Your Workspace',
			summary: 'Create the structure that matches your real operation.',
			items: ['Set departments and roles', 'Approve users and access levels', 'Set your business profile'],
			image: '/marketing/app/admin-dashboard.png',
			alt: 'Admin dashboard overview',
			position: 'top center'
		},
		{
			step: '02',
			title: 'Build Your Week',
			summary: 'Create schedules and assignments in one pass.',
			items: ['Build and adjust shifts', 'Assign tasks and prep expectations', 'Publish updates to staff instantly'],
			image: '/marketing/app/scheduling-builder.png',
			alt: 'Schedule builder interface',
			position: 'top center'
		},
		{
			step: '03',
			title: 'Run Service With Clarity',
			summary: 'Everyone sees priorities, updates, and live status in one place.',
			items: ['Check today schedule and tasks', 'Share announcements and shift context', 'Monitor active operational signals'],
			image: '/marketing/app/employee-homepage.png',
			alt: 'Employee homepage with shift info',
			position: 'top center'
		}
	];

	const firstWeekSteps: WeekStep[] = [
		{
			dayRange: 'Day 1',
			title: 'Core setup',
			items: ['Create departments', 'Set up access roles', 'Add your first team members']
		},
		{
			dayRange: 'Day 2-3',
			title: 'Go live with schedules',
			items: ['Build first weekly schedule', 'Review coverage and updates', 'Publish to employee view']
		},
		{
			dayRange: 'Day 4-7',
			title: 'Move daily flow into app',
			items: ['Use todo and prep lists daily', 'Share docs and updates in shift', 'Track service with live awareness']
		}
	];

	const appAreas = [
		{
			title: 'Scheduling + Coverage',
			detail: 'Build, adjust, and publish shift coverage by team and role.'
		},
		{
			title: 'Daily Execution',
			detail: 'Run todo, prep, checklists, inventory, and order flow in one place.'
		},
		{
			title: 'Knowledge + Updates',
			detail: 'Keep recipes, docs, announcements, and context visible during service.'
		},
		{
			title: 'Monitoring + Admin',
			detail: 'Track operational signal and manage workspace controls with less friction.'
		}
	];

	const faqs = [
		{
			q: 'Can we start with one location and scale later?',
			a: 'Yes. Teams usually start on Small or Medium, then move to Large as staffing and complexity increase.'
		},
		{
			q: 'Do we need to migrate all workflows on day one?',
			a: 'No. Most kitchens launch scheduling and prep first, then move docs and recipe workflows over in phases.'
		},
		{
			q: 'Is onboarding help included?',
			a: 'Yes. Every tier includes launch guidance for manager and admin setup.'
		}
	];

	const rolloutNotes = [
		'Temperature monitoring available as an optional add-on (+$30/mo).',
		'Camera monitoring available as an optional add-on (+$30/mo).',
		'All tiers include guided rollout for managers and admins.'
	];
</script>

<Layout>
	<section class="head" data-reveal style="--reveal-delay: 40ms;">
		<p class="eyebrow">How It Works</p>
		<h1>One clear operations flow for your whole team.</h1>
		<p>
			SoftwareKitchenNNS keeps setup, scheduling, daily execution, and service visibility connected.
		</p>
		<div class="head-actions">
			<a href="/register#onboarding-slideshow" class="btn btn-primary">Start Free Trial</a>
			<a href="/features" class="btn">See Features</a>
		</div>
	</section>

	<section class="intro-band" data-reveal>
		<figure class="intro-media">
			<img src="/marketing/FB_IMG_7461876514951404517.jpg" alt="Kitchen team coordinating service" loading="lazy" />
		</figure>
		<div class="intro-copy">
			<h2>Built for quick understanding during real shifts</h2>
			<p>
				The app is organized so managers and staff can find what matters in seconds without jumping across tools.
			</p>
			<p class="pipe-line">
				{#each quickStats as stat}
					<span>| {stat} |</span>
				{/each}
			</p>
		</div>
	</section>

	<section class="workflow" data-reveal>
		<header class="section-head">
			<p class="eyebrow">Workflow</p>
			<h2>Three practical phases</h2>
		</header>
		<div class="workflow-stack">
			{#each workflowSteps as step, index}
				<article class="workflow-row" class:reverse={index % 2 === 1}>
					<figure class="workflow-media">
						<img src={step.image} alt={step.alt} loading="lazy" style={`--workflow-position:${step.position ?? 'center'};`} />
					</figure>
					<div class="workflow-copy">
						<p class="step-number">Step {step.step}</p>
						<h3>{step.title}</h3>
						<p>{step.summary}</p>
						<ul>
							{#each step.items as item}
								<li>{item}</li>
							{/each}
						</ul>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<section class="week-plan" data-reveal>
		<header class="section-head">
			<p class="eyebrow">First Week</p>
			<h2>A clean rollout sequence</h2>
		</header>
		<div class="week-grid">
			{#each firstWeekSteps as step}
				<article class="week-stage">
					<p class="week-day">{step.dayRange}</p>
					<h3>{step.title}</h3>
					<ul>
						{#each step.items as item}
							<li>{item}</li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>
	</section>

	<section class="areas-only" data-reveal>
		<header class="section-head">
			<p class="eyebrow">App Areas</p>
			<h2>What teams use day to day</h2>
		</header>
		<ul class="area-list">
			{#each appAreas as area}
				<li>
					<strong>{area.title}</strong>
					<span>{area.detail}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="support" data-reveal>
		<div class="support-col">
			<header class="section-head">
				<p class="eyebrow">FAQ</p>
				<h2>Common questions</h2>
			</header>
			<ul>
				{#each faqs as item}
					<li>
						<strong>{item.q}</strong>
						<span>{item.a}</span>
					</li>
				{/each}
			</ul>
		</div>
		<div class="support-col">
			<header class="section-head">
				<p class="eyebrow">Rollout Notes</p>
				<h2>Launch scope</h2>
			</header>
			<ul>
				{#each rolloutNotes as note}
					<li>{note}</li>
				{/each}
			</ul>
		</div>
	</section>

	<section class="bottom-cta" data-reveal>
		<div>
			<h2>Ready to run operations from one workspace?</h2>
			<p>Launch with your team and move daily execution into one clean flow.</p>
		</div>
		<div class="head-actions">
			<a href="/register#onboarding-slideshow" class="btn btn-primary">Create Workspace</a>
			<a href="/pricing" class="btn">View Pricing</a>
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

	.head p {
		margin: 0;
		color: var(--color-text-muted);
		line-height: 1.5;
		max-width: 68ch;
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

	.intro-band {
		margin-top: 0.95rem;
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
		gap: 0.76rem;
		align-items: stretch;
	}

	.intro-media,
	.workflow-media {
		margin: 0;
		border-radius: 16px;
		overflow: hidden;
		border: 1px solid var(--color-border);
		background: color-mix(in srgb, var(--color-surface-alt) 92%, transparent);
		max-height: 280px;
	}

	.intro-media img,
	.workflow-media img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(0.95) contrast(1.08) brightness(1.04);
	}

	.intro-copy {
		display: grid;
		gap: 0.42rem;
		align-content: center;
	}

	.pipe-line {
		margin: 0.1rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: 0.8rem;
		letter-spacing: 0.03em;
	}

	.section-head {
		display: grid;
		gap: 0.3rem;
	}

	.section-head h2 {
		margin: 0;
		font-size: clamp(1.08rem, 2.8vw, 1.6rem);
	}

	.workflow,
	.week-plan,
	.areas-only,
	.support {
		margin-top: 1rem;
	}

	.workflow-stack {
		margin-top: 0.62rem;
		display: grid;
		gap: 0.75rem;
	}

	.workflow-row {
		display: grid;
		grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
		gap: 0.76rem;
		align-items: stretch;
	}

	.workflow-row.reverse .workflow-media {
		order: 2;
	}

	.workflow-row.reverse .workflow-copy {
		order: 1;
	}

	.workflow-copy {
		display: grid;
		gap: 0.36rem;
		align-content: center;
	}

	.step-number {
		margin: 0;
		font-size: 0.74rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	h3 {
		margin: 0;
		font-size: 1.02rem;
	}

	.workflow-copy p {
		margin: 0;
		color: var(--color-text-muted);
		line-height: 1.48;
	}

	ul {
		margin: 0.26rem 0 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.26rem;
		color: var(--color-text-muted);
	}

	.week-grid {
		margin-top: 0.62rem;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.72rem;
	}

	.week-stage {
		display: grid;
		gap: 0.34rem;
		padding-left: 0.72rem;
		border-left: 2px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
	}

	.week-day {
		margin: 0;
		font-size: 0.74rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.area-list {
		margin-top: 0.28rem;
		padding-left: 0;
		list-style: none;
	}

	.area-list li {
		display: grid;
		gap: 0.12rem;
		padding-bottom: 0.42rem;
		margin-bottom: 0.42rem;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 84%, transparent);
	}

	.area-list li:last-child {
		margin-bottom: 0;
		padding-bottom: 0;
		border-bottom: none;
	}

	.area-list strong {
		font-size: 0.92rem;
	}

	.area-list span {
		font-size: 0.84rem;
		color: var(--color-text-muted);
		line-height: 1.42;
	}

	.support {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.support-col ul {
		padding-left: 0;
		list-style: none;
	}

	.support-col li {
		display: grid;
		gap: 0.16rem;
		padding-bottom: 0.48rem;
		margin-bottom: 0.48rem;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 84%, transparent);
		font-size: 0.84rem;
		line-height: 1.45;
		color: var(--color-text-muted);
	}

	.support-col li:last-child {
		margin-bottom: 0;
		padding-bottom: 0;
		border-bottom: none;
	}

	.support-col strong {
		font-size: 0.92rem;
		color: var(--color-text);
	}

	.bottom-cta {
		margin-top: 1rem;
		padding: 0.9rem;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.8rem;
		background:
			linear-gradient(145deg, color-mix(in srgb, var(--color-primary) 16%, transparent), transparent 58%),
			var(--color-surface);
		border: 1px solid color-mix(in srgb, var(--color-border) 86%, transparent);
		border-radius: 16px;
	}

	.bottom-cta h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.bottom-cta p {
		margin: 0.35rem 0 0;
		color: var(--color-text-muted);
	}

	@media (max-width: 980px) {
		.intro-band,
		.workflow-row,
		.support {
			grid-template-columns: 1fr;
		}

		.workflow-row.reverse .workflow-media,
		.workflow-row.reverse .workflow-copy {
			order: unset;
		}

		.intro-media,
		.workflow-media {
			max-height: 240px;
		}
	}

	@media (max-width: 900px) {
		.week-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 760px) {
		.bottom-cta {
			flex-direction: column;
			align-items: flex-start;
		}

		.intro-media,
		.workflow-media {
			max-height: 210px;
		}
	}
</style>
