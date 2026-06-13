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

	type TourTarget = {
		label: string;
		description: string;
		focus: { x: number; y: number; w: number; h: number };
	};

	type TourScene = {
		title: string;
		src: string;
		alt: string;
		targets: TourTarget[];
	};

	const quickStats = ['Business workspace', 'Employee onboarding', 'Daily operations'];

	const tourScenes: TourScene[] = [
		{
			title: 'Workspace launch',
			src: '/marketing/app/admin-dashboard.png',
			alt: 'Manager dashboard with workspace controls',
			targets: [
				{
					label: 'Owner workspace',
					description: 'After signup, the owner lands in a business-scoped workspace where admin setup begins.',
					focus: { x: 23, y: 42, w: 52, h: 12 }
				}
			]
		},
		{
			title: 'Manager controls',
			src: '/marketing/app/admin-dashboard.png',
			alt: 'Manager dashboard control center',
			targets: [
				{
					label: 'Feature setup',
					description: 'Managers enable the app areas the business will use, then configure departments, roles, documents, menus, and lists.',
					focus: { x: 25, y: 42, w: 50, h: 7 }
				}
			]
		},
		{
			title: 'Employee onboarding',
			src: '/marketing/app/admin-dashboard.png',
			alt: 'Manager dashboard representing employee onboarding controls',
			targets: [
				{
					label: 'Invite + packet',
					description: 'Employees join through branded invites and complete required onboarding packet items before full app use.',
					focus: { x: 22, y: 55, w: 38, h: 34 }
				}
			]
		},
		{
			title: 'Schedule builder',
			src: '/marketing/app/scheduling-builder.png',
			alt: 'Manager schedule builder page',
			targets: [
				{
					label: 'Weekly coverage',
					description: 'Managers build coverage by department, publish schedules, and review shift changes through approval flow.',
					focus: { x: 25, y: 42, w: 50, h: 7 }
				}
			]
		},
		{
			title: 'Daily homepage',
			src: '/marketing/app/homepage-main-block.png',
			alt: 'Homepage with daily brief and shift block',
			targets: [
				{
					label: 'Daily brief',
					description: 'Staff sees the current shift, restaurant updates, specials, menus, tasks, and active operational context.',
					focus: { x: 4, y: 29, w: 84, h: 40 }
				}
			]
		},
		{
			title: 'Lists + tasks',
			src: '/marketing/app/todo-assign.png',
			alt: 'ToDo page with active and completed tabs',
			targets: [
				{
					label: 'Execution queue',
					description: 'Tasks, prep work, checklists, inventory, and orders keep daily execution visible and accountable.',
					focus: { x: 24, y: 47, w: 52, h: 8 }
				}
			]
		},
		{
			title: 'Recipes + docs',
			src: '/marketing/app/recipe-categories.png',
			alt: 'Recipe categories page with search and category entry',
			targets: [
				{
					label: 'Knowledge access',
					description: 'Recipes, SOPs, menus, and documents are organized so employees can find references during prep or service.',
					focus: { x: 4, y: 44, w: 93, h: 26 }
				}
			]
		}
	];

	const workflowSteps: WorkflowStep[] = [
		{
			step: '01',
			title: 'Create The Business Workspace',
			summary: 'Register the restaurant and create its isolated app environment.',
			items: ['Enter owner and business information', 'Choose plan path', 'Create the first owner or manager account'],
			image: '/marketing/app/admin-dashboard.png',
			alt: 'Manager dashboard overview',
			position: 'top center'
		},
		{
			step: '02',
			title: 'Configure The Operation',
			summary: 'Turn on the app areas the business needs and set the operating structure.',
			items: ['Set business profile, logo, and enabled features', 'Build departments, roles, lists, menus, recipes, and docs', 'Install or customize the onboarding packet'],
			image: '/marketing/app/scheduling-builder.png',
			alt: 'Schedule builder interface',
			position: 'top center'
		},
		{
			step: '03',
			title: 'Invite Staff + Go Live',
			summary: 'Bring employees into the workspace and start running the restaurant through Crimini.',
			items: ['Send employee invites', 'Review completed onboarding packets', 'Publish schedules and run daily execution from the homepage'],
			image: '/marketing/app/employee-homepage.png',
			alt: 'Employee homepage with shift info',
			position: 'top center'
		}
	];

	const firstWeekSteps: WeekStep[] = [
		{
			dayRange: 'Day 1',
			title: 'Workspace setup',
			items: ['Register business details', 'Set branding and feature visibility', 'Create departments and roles']
		},
		{
			dayRange: 'Day 2-3',
			title: 'Employees + scheduling',
			items: ['Install onboarding packet', 'Invite staff', 'Build and publish first weekly schedule']
		},
		{
			dayRange: 'Day 4-7',
			title: 'Daily operation',
			items: ['Move lists, docs, recipes, and menus into the app', 'Use tasks and updates daily', 'Connect monitoring when hardware is ready']
		}
	];

	const appAreas = [
		{
			title: 'Workspace Setup',
			detail: 'Business profile, branding, feature visibility, departments, roles, and tenant-scoped records.'
		},
		{
			title: 'Employee Launch',
			detail: 'Invites, account setup, onboarding packet requirements, and admin review.'
		},
		{
			title: 'Scheduling + Labor',
			detail: 'Schedule builder, publishing, My Schedule, availability, time off, shift offers, swaps, and approval.'
		},
		{
			title: 'Daily Execution',
			detail: 'Homepage, tasks, prep, checklists, inventory, orders, docs, recipes, menus, specials, and announcements.'
		},
		{
			title: 'Monitoring + Reports',
			detail: 'Temperature readiness, vendors, history, exports, operational review, and future camera expansion.'
		}
	];

	const faqs = [
		{
			q: 'Does each restaurant get its own workspace?',
			a: 'Yes. Each business workspace keeps its users, schedules, documents, uploads, and app settings separate.'
		},
		{
			q: 'Can owners control which features show up?',
			a: 'Yes. Managers can enable or hide app areas so the workspace matches the business needs.'
		},
		{
			q: 'How do employees join?',
			a: 'Managers send an invite. The employee creates their account, completes the assigned onboarding packet, and then uses the app once approved.'
		},
		{
			q: 'What onboarding packet items are included?',
			a: 'The base packet includes personal information, emergency contact, payroll setup, I-9, W-4, state withholding when available, handbook acknowledgement, and policy acknowledgement.'
		},
		{
			q: 'Can we launch before sensors are connected?',
			a: 'Yes. Scheduling, onboarding, lists, docs, menus, recipes, tasks, and communication can launch first.'
		},
		{
			q: 'Can we start small and add more later?',
			a: 'Yes. Workspaces can begin with core operations and expand with temperature monitoring and deeper workflows over time.'
		}
	];

	const rolloutNotes = [
		'The owner account creates the business workspace first.',
		'Employee onboarding is controlled from admin after workspace setup.',
		'Temperature systems can be connected after the core app is running. Camera monitoring is planned as a later expansion.',
		'Store billing and mobile store release remain part of the final production launch path.'
	];

	let activeSceneIndex = 0;
	let activeTargetIndex = 0;

	$: activeScene = tourScenes[activeSceneIndex];
	$: activeTargets = activeScene.targets;
	$: if (activeTargetIndex >= activeTargets.length) {
		activeTargetIndex = 0;
	}
	$: activeTarget = activeTargets[activeTargetIndex];

	function setScene(index: number) {
		activeSceneIndex = (index + tourScenes.length) % tourScenes.length;
		activeTargetIndex = 0;
	}

	function previousScene() {
		setScene(activeSceneIndex - 1);
	}

	function nextScene() {
		setScene(activeSceneIndex + 1);
	}

	function setTarget(index: number) {
		activeTargetIndex = index;
	}
</script>

<Layout>
	<section class="head" data-reveal style="--reveal-delay: 40ms;">
		<p class="eyebrow">How It Works</p>
		<h1>From business signup to live restaurant operations.</h1>
		<p>
			Crimini starts with the owner creating a business workspace, then moves through setup, onboarding, scheduling, and daily service.
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
			<h2>Built as a launch path, not just a dashboard</h2>
			<p>
				The owner sets the business foundation, managers configure operations, employees join through onboarding, and the team runs service from one workspace.
			</p>
			<p class="pipe-line">
				{#each quickStats as stat}
					<span>| {stat} |</span>
				{/each}
			</p>
		</div>
	</section>

	<section class="tour-preview-band" data-reveal>
		<header class="section-head">
			<p class="eyebrow">Guided Walkthrough</p>
			<h2>Preview the path from setup to daily use</h2>
		</header>
		<div class="tour-preview-shell">
			<div class="tour-stage" role="region" aria-label={`Guided preview for ${activeScene.title}`}>
				<img src={activeScene.src} alt={activeScene.alt} loading="lazy" />
				<div
					class="focus-ring"
					aria-hidden="true"
					style={`left:${activeTarget.focus.x}%;top:${activeTarget.focus.y}%;width:${activeTarget.focus.w}%;height:${activeTarget.focus.h}%;`}
				></div>
			</div>

			<div class="scene-nav" aria-label="Tour scene navigation">
				<button type="button" on:click={previousScene} aria-label="Previous screen">&#8249;</button>
				<p>{activeScene.title} ({activeSceneIndex + 1}/{tourScenes.length})</p>
				<button type="button" on:click={nextScene} aria-label="Next screen">&#8250;</button>
			</div>

			<div class="target-tabs" role="tablist" aria-label="Highlighted features">
				{#each activeTargets as target, index}
					<button
						type="button"
						role="tab"
						aria-selected={index === activeTargetIndex}
						class:active={index === activeTargetIndex}
						on:click={() => setTarget(index)}
					>
						{target.label}
					</button>
				{/each}
			</div>

			<article class="target-copy" aria-live="polite">
				<h3>{activeTarget.label}</h3>
				<p>{activeTarget.description}</p>
			</article>

			<div class="scene-progress" aria-hidden="true">
				{#each tourScenes as _, index}
					<button
						type="button"
						aria-label={`Go to screen ${index + 1}`}
						title={`Screen ${index + 1}`}
						class:active={index === activeSceneIndex}
						on:click={() => setScene(index)}
					></button>
				{/each}
			</div>
		</div>
	</section>

	<section class="workflow" data-reveal>
		<header class="section-head">
			<p class="eyebrow">Workflow</p>
			<h2>Three practical launch phases</h2>
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
			<h2>A clean first-week rollout</h2>
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
			<h2>What the business controls and uses</h2>
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
			<h2>Ready to launch the workspace?</h2>
			<p>Create the business, configure the app, onboard staff, and move daily execution into one clean flow.</p>
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
		border: 0;
		border-bottom: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text);
		border-radius: 0;
		padding: 0.28rem 0.12rem;
		font-weight: var(--weight-semibold);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		font-size: 0.78rem;
		transition: border-color 140ms ease, color 140ms ease;
	}

	.btn:hover {
		border-bottom-color: var(--color-text);
		color: var(--color-text);
	}

	.btn-primary {
		border-bottom-color: var(--color-text);
		color: var(--color-text);
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

	.tour-preview-band {
		margin-top: 1rem;
		display: grid;
		gap: 0.55rem;
	}

	.tour-preview-shell {
		display: grid;
		gap: 0.45rem;
		justify-items: center;
	}

	.tour-stage {
		position: relative;
		width: min(100%, 32rem);
		aspect-ratio: 16 / 10;
		border-radius: 14px;
		overflow: hidden;
		border: 1px solid var(--color-border);
		background: #ffffff;
	}

	.tour-stage img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #ffffff;
	}

	.focus-ring {
		position: absolute;
		border-radius: 12px;
		border: 2px solid rgba(232, 243, 255, 0.94);
		box-shadow: 0 0 0 9999px rgba(7, 10, 16, 0.53);
		pointer-events: none;
		transition: all 220ms ease;
	}

	.scene-nav {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.45rem;
		width: min(100%, 32rem);
	}

	.scene-nav p {
		margin: 0;
		text-align: center;
		color: var(--color-text);
		font-size: 0.84rem;
		letter-spacing: 0.02em;
	}

	.scene-nav button {
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--color-border) 75%, transparent);
		background: color-mix(in srgb, var(--color-surface) 82%, black 18%);
		color: var(--color-text);
		cursor: pointer;
		font-size: 1.3rem;
		line-height: 1;
	}

	.target-tabs {
		display: grid;
		gap: 0.35rem;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		width: min(100%, 32rem);
	}

	.target-tabs button {
		text-align: left;
		border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
		background: color-mix(in srgb, var(--color-surface) 92%, black 8%);
		color: var(--color-text-muted);
		border-radius: 10px;
		padding: 0.48rem 0.56rem;
		cursor: pointer;
		font-size: 0.78rem;
		line-height: 1.35;
	}

	.target-tabs button.active {
		border-color: color-mix(in srgb, var(--color-primary) 56%, transparent);
		color: var(--color-text);
		background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));
	}

	.target-copy {
		width: min(100%, 32rem);
		padding-block: 0.62rem;
		border-block: 1px solid var(--color-divider);
	}

	.target-copy h3 {
		margin: 0;
		font-size: 0.95rem;
	}

	.target-copy p {
		margin: 0.22rem 0 0;
		color: var(--color-text-muted);
		line-height: 1.45;
		font-size: 0.82rem;
	}

	.scene-progress {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(1.4rem, 1fr));
		gap: 0.3rem;
		width: min(100%, 32rem);
	}

	.scene-progress button {
		height: 0.24rem;
		border-radius: 999px;
		border: 0;
		background: color-mix(in srgb, var(--color-border) 82%, transparent);
		padding: 0;
		cursor: pointer;
	}

	.scene-progress button.active {
		background: color-mix(in srgb, var(--color-primary) 78%, white 22%);
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
		padding-block: 1rem;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.8rem;
		border-top: 1px solid var(--color-divider);
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
