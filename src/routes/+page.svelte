<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
	import { onMount } from 'svelte';

	type CarouselSlide = {
		tag: string;
		title: string;
		subtitle: string;
		image: string;
		fit?: 'cover' | 'contain';
		position?: string;
		filter?: string;
	};

	type CapabilityItem = {
		title: string;
		detail: string;
	};

	type GalleryShot = {
		image: string;
		alt: string;
	};

	type WorkflowStep = {
		step: string;
		title: string;
		description: string;
		link: string;
		linkLabel: string;
	};

	const carouselSlides: CarouselSlide[] = [
		{
			tag: '',
			title: '',
			subtitle: '',
			image: '/crimini-full-logo.jpg',
			fit: 'contain',
			position: 'center',
			filter: 'none'
		},
		{
			tag: 'Unified Shift View',
			title: 'One live homepage for schedules, tasks, and shift updates.',
			subtitle: 'Staff sees priorities quickly while admins keep service aligned in real time.',
			image: '/marketing/FB_IMG_7461876514951404517.jpg',
			fit: 'cover',
			position: 'center 40%',
			filter: 'saturate(1.24) contrast(1.18) brightness(1.04)'
		},
		{
			tag: 'Scheduling Control',
			title: 'Build schedules across departments with labor visibility built in.',
			subtitle: 'Track coverage, manage shift offers and swaps, and route changes through manager approval.',
			image: '/marketing/IMG_20230606_210739074_HDR.jpg',
			fit: 'cover',
			position: 'center 52%'
		},
		{
			tag: 'Execution Tools',
			title: 'Run prep, checklists, inventory, and orders in one workflow.',
			subtitle: 'Keep stations synced with assignments, recipes, and SOP references.',
			image: '/marketing/FB_IMG_4126678697134084261.jpg',
			fit: 'cover',
			position: 'center 38%'
		},
		{
			tag: 'Monitoring + Admin',
			title: 'Track operational signal with temperature and optional camera monitoring.',
			subtitle: 'Manage announcements, spotlight, and workspace controls from admin.',
			image: '/marketing/FB_IMG_3952972665318110830.jpg',
			fit: 'cover',
			position: 'center 42%'
		}
	];

	const keyStats = ['Scheduling', 'Prep + lists', 'Docs + recipes', 'Team communication', 'Monitoring'];

	const coreCapabilities: CapabilityItem[] = [
		{
			title: 'Scheduling + Coverage',
			detail: 'Build multi-department schedules with coverage, labor visibility, shift offers, swaps, and manager approval.'
		},
		{
			title: 'Daily Execution',
			detail: 'Run todo, prep, checklists, inventory, and orders from one shared workspace.'
		},
		{
			title: 'Recipes + Docs',
			detail: 'Keep SOPs, documents, and recipes accessible while service is active.'
		},
		{
			title: 'Admin + Monitoring',
			detail: 'Manage users, feature visibility, and live operational signals from one control area.'
		},
		{
			title: 'Homepage Command View',
			detail: 'Give every shift one place for announcements, spotlight, assignments, and current context.'
		},
		{
			title: 'Labor + Shift Flow',
			detail: 'Keep staffing changes organized with employee requests, offered shifts, swap routing, and approval control.'
		},
		{
			title: 'Business-Ready Onboarding',
			detail: 'Guide new workspaces through setup, business details, role flow, and launch steps.'
		}
	];

	const overviewScreens: GalleryShot[] = [
		{
			image: '/marketing/app/employee-homepage.png',
			alt: 'Live employee homepage with shift and announcements'
		},
		{
			image: '/marketing/app/scheduling-builder.png',
			alt: 'Scheduling builder interface with role and shift controls'
		}
	];

	const workflowTimeline: WorkflowStep[] = [
		{
			step: '01',
			title: 'Configure Your Operation',
			description: 'Set departments, roles, user access, labor expectations, and approval paths to match your operation.',
			link: '/register#onboarding-slideshow',
			linkLabel: 'View onboarding slideshow'
		},
		{
			step: '02',
			title: 'Build Weekly Coverage',
			description: 'Create schedules, manage shift changes, assign tasks, and run lists, recipes, and docs from one workspace.',
			link: '/features',
			linkLabel: 'See feature map'
		},
		{
			step: '03',
			title: 'Run Service With Live Visibility',
			description:
				'Keep teams aligned with homepage updates, announcements, and live operational monitoring.',
			link: '/how-it-works',
			linkLabel: 'See how it works'
		}
	];

	const operatorQuote = {
		quote:
			'The biggest win was having schedules, tasks, docs, and updates in one place so shifts run cleaner.',
		role: 'General Manager',
		focus: 'Operations and communication'
	};

	const visitorHold = true;
	let activeSlide = 0;
	let slideTimer: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		if (visitorHold) return;

		slideTimer = setInterval(() => {
			activeSlide = (activeSlide + 1) % carouselSlides.length;
		}, 5200);

		return () => {
			if (slideTimer) clearInterval(slideTimer);
		};
	});
</script>

{#if visitorHold}
	<main class="coming-soon-page" aria-label="Crimini coming soon">
		<div class="coming-soon-lockup">
			<img src="/crimini-full-logo.jpg" alt="Crimini by NexusNorthSystems, LLC" />
			<p>Coming soon.</p>
		</div>
	</main>
{:else}
<Layout>
	<section class="hero" aria-label="Top Banner">
		<div class="hero-carousel">
			{#each carouselSlides as slide, index}
				<article
					class="carousel-slide"
					class:active={index === activeSlide}
					style={`--slide-image: url('${slide.image}'); --slide-fit: ${slide.fit ?? 'contain'}; --slide-position: ${slide.position ?? 'center'}; --slide-filter: ${slide.filter ?? 'saturate(1.22) contrast(1.13) brightness(1.04)'};`}
					aria-hidden={index !== activeSlide}
				>
					{#if slide.title}
						<div class="slide-content">
							<p class="slide-tag">{slide.tag}</p>
							<h1>{slide.title}</h1>
							<p>{slide.subtitle}</p>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	</section>

	<section class="quick-proof" data-reveal style="--reveal-delay: 60ms;">
		<div class="body-logo-lockup" aria-label="Crimini by NNS, LLC">
			<img src="/crimini-full-logo.jpg" alt="Crimini by NexusNorthSystems, LLC" />
		</div>
		<p class="proof-line">
			<strong>Schedule + Coverage Control</strong>
			<span>Department-aware builder, publish flow, and employee my-schedule visibility.</span>
		</p>
		<p class="proof-line">
			<strong>Execution + Knowledge Workspace</strong>
			<span>Prep, checklists, inventory, orders, recipes, docs, and task assignments in one app.</span>
		</p>
		<p class="proof-line">
			<strong>Live Manager Signal</strong>
			<span>Announcements, whiteboard context, temperature visibility, and optional camera monitoring.</span>
		</p>
	</section>

	<section class="landing-summary" data-reveal>
		<div class="summary-layout">
			<figure class="summary-photo">
				<img
					src="/marketing/IMG_20230606_163319714.jpg"
					alt="Chef finishing burger pass in active service"
					loading="lazy"
				/>
			</figure>
			<div class="summary-copy">
				<header class="section-head">
					<p class="eyebrow">Why Teams Switch</p>
					<h2>A cleaner way to run daily kitchen operations.</h2>
					<p class="section-copy">
						Crimini replaces fragmented tools with one workspace for scheduling, execution,
						communication, and operational visibility.
					</p>
				</header>
				<p class="stat-line">
					{#each keyStats as stat}
						<span>| {stat} |</span>
					{/each}
				</p>
			</div>
		</div>
	</section>

	<section class="core-features" data-reveal>
		<div class="core-layout">
			<div class="core-copy">
				<header class="section-head">
					<p class="eyebrow">Core Features</p>
					<h2>Built around real shift workflows.</h2>
				</header>
				<ul class="capability-list">
					{#each coreCapabilities as feature}
						<li>
							<h3>{feature.title}</h3>
							<p>{feature.detail}</p>
						</li>
					{/each}
				</ul>
			</div>
			<figure class="core-photo">
				<img
					src="/marketing/FB_IMG_7461876514951404517.jpg"
					alt="Chef team coordinating at service pace"
					loading="lazy"
				/>
			</figure>
		</div>
	</section>

	<section class="overview-preview" data-reveal>
		<header class="section-head">
			<p class="eyebrow">App Preview</p>
			<h2>Homepage, scheduling, and assignment views used in real service.</h2>
		</header>
		<div class="preview-grid">
			{#each overviewScreens as shot}
				<figure class="preview-shot">
					<img src={shot.image} alt={shot.alt} loading="lazy" />
				</figure>
			{/each}
		</div>
	</section>

	<section class="execution-path" data-reveal>
		<header class="section-head">
			<p class="eyebrow">How Teams Adopt</p>
			<h2>Launch in three clear steps.</h2>
		</header>
		<div class="step-list">
			{#each workflowTimeline as item}
				<article class="step-row">
					<p class="timeline-step">{item.step}</p>
					<div>
						<h3>{item.title}</h3>
						<p>{item.description}</p>
						<a href={item.link} class="inline-link">{item.linkLabel}</a>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<section class="operator-quote" data-reveal>
		<blockquote>"{operatorQuote.quote}"</blockquote>
		<p>{operatorQuote.role} - {operatorQuote.focus}</p>
	</section>

	<section class="bottom-cta" data-reveal>
		<div>
			<h2>One workspace for scheduling, execution, and monitoring.</h2>
			<p>Launch the app, onboard your team, and run cleaner shifts with live visibility.</p>
		</div>
		<div class="hero-actions">
			<a href="/register#onboarding-slideshow" class="btn btn-primary">Create Workspace</a>
			<a href="/login" class="btn">Sign In</a>
		</div>
	</section>

	<div class="store-badge-row" aria-label="Supported store billing platforms">
		<img src="/store-badges/google-play-badge.svg" alt="Get it on Google Play" class="store-badge" loading="lazy" />
		<img src="/store-badges/app-store-badge.svg" alt="Download on the App Store" class="store-badge" loading="lazy" />
	</div>

	<p class="nns-line nns-credits" aria-label="Crimini credentials">
		<img src="/spider-mark.svg" alt="NNS, LLC spider mark" class="nns-line-logo" />
		<span>Crimini by NNS, LLC</span>
		<span aria-hidden="true">|</span>
		<span class="cert-inline">
			<img
				src="/cert-badges/google-cybersecurity.jpg"
				alt="Google Cybersecurity Certificate badge"
				class="cert-inline-logo"
				loading="lazy"
			/>
			<span>Google Cybersecurity Certified</span>
		</span>
		<span aria-hidden="true">|</span>
		<span class="cert-inline">
			<img
				src="/cert-badges/microsoft-fullstack.png"
				alt="Microsoft certificate badge"
				class="cert-inline-logo"
				loading="lazy"
			/>
			<span>Microsoft Full Stack Developer Certified</span>
		</span>
	</p>
</Layout>
{/if}

<style>
	:global(body) {
		background: #ffffff;
		background-image: none;
	}

	:global(body::before) {
		display: none;
	}

	:global(.app-content.marketing-content) {
		color: #111214;
		background: #ffffff;
	}

	.coming-soon-page {
		min-height: calc(100dvh - 8rem);
		display: grid;
		place-items: center;
		padding: clamp(3rem, 8vw, 7rem) 1.25rem;
		background: #ffffff;
		color: #111214;
	}

	.coming-soon-lockup {
		width: min(100%, 42rem);
		display: grid;
		justify-items: center;
		gap: clamp(1rem, 2.5vw, 1.6rem);
		text-align: center;
	}

	.coming-soon-lockup img {
		width: min(100%, 34rem);
		height: auto;
		display: block;
	}

	.coming-soon-lockup p {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(1.4rem, 3.4vw, 2.6rem);
		font-weight: 400;
		letter-spacing: -0.045em;
		color: #111214;
	}

	.hero {
		position: relative;
		width: 100vw;
		margin-left: calc(50% - 50vw);
		margin-right: calc(50% - 50vw);
		margin-top: calc(clamp(0.75rem, 2.6vw, var(--space-4)) * -1);
		background: #ffffff;
		overflow: clip;
	}

	.hero::after {
		display: none;
	}

	.hero-carousel {
		position: relative;
		min-height: clamp(360px, 58vw, 620px);
		overflow: hidden;
		background: #ffffff;
	}

	.carousel-slide {
		position: absolute;
		inset: 0;
		background-image:
			var(--slide-image);
		background-position: var(--slide-position);
		background-size: var(--slide-fit);
		background-repeat: no-repeat;
		background-color: #ffffff;
		opacity: 0;
		transform: scale(1.04);
		transition: opacity 500ms ease, transform 900ms ease;
		pointer-events: none;
		filter: var(--slide-filter);
		-webkit-mask-image: linear-gradient(
			180deg,
			transparent 0%,
			rgba(0, 0, 0, 0.42) 8%,
			#000000 20%,
			#000000 82%,
			rgba(0, 0, 0, 0.52) 92%,
			transparent 100%
		);
		mask-image: linear-gradient(
			180deg,
			transparent 0%,
			rgba(0, 0, 0, 0.42) 8%,
			#000000 20%,
			#000000 82%,
			rgba(0, 0, 0, 0.52) 92%,
			transparent 100%
		);
	}

	.carousel-slide.active {
		opacity: 1;
		transform: scale(1);
		pointer-events: auto;
	}

	.slide-content {
		position: absolute;
		left: 50%;
		z-index: 3;
		transform: translateX(-50%);
		bottom: clamp(5.9rem, 11vw, 7.9rem);
		width: min(1040px, 100%);
		padding-inline: clamp(0.95rem, 3.5vw, 1.8rem);
		max-width: min(1040px, 100%);
		text-shadow:
			0 2px 10px rgba(0, 0, 0, 0.72),
			0 14px 34px rgba(0, 0, 0, 0.42);
	}

	.slide-tag {
		margin: 0;
		font-size: 0.74rem;
		color: rgba(255, 255, 255, 0.82);
		text-transform: uppercase;
		letter-spacing: 0.16em;
	}

	h1 {
		margin: 0.32rem 0 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(1.65rem, 4.8vw, 3.15rem);
		font-weight: 400;
		line-height: 1.06;
		letter-spacing: -0.045em;
		text-wrap: balance;
	}

	.slide-content h1 {
		color: #f7f2ea;
	}

	.slide-content p {
		margin: 0.4rem 0 0;
		font-size: 0.95rem;
		color: rgba(247, 242, 234, 0.92);
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		border: 1px solid rgba(19, 20, 22, 0.18);
		background: rgba(255, 255, 255, 0.9);
		color: #111214;
		border-radius: 0;
		padding: 0.58rem 0.84rem;
		font-weight: var(--weight-semibold);
		transition: transform 140ms ease, border-color 140ms ease;
	}

	.btn:hover {
		transform: translateY(-1px);
		border-color: rgba(19, 20, 22, 0.5);
	}

	.btn-primary {
		background: #111214;
		border-color: #111214;
		color: #f8f4ec;
	}

	.section-head {
		display: grid;
		gap: 0.34rem;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.76rem;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		color: color-mix(in srgb, #111214 58%, transparent);
	}

	.section-head h2 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(1.28rem, 3vw, 2.1rem);
		font-weight: 400;
		letter-spacing: -0.045em;
		text-wrap: balance;
		color: #111214;
	}

	.section-copy {
		margin: 0;
		color: rgba(17, 18, 20, 0.68);
		max-width: 72ch;
		line-height: 1.5;
	}

	.quick-proof {
		margin-top: 0.9rem;
		display: grid;
		gap: 0;
		padding: 0.35rem 0;
		border-top: 1px solid rgba(17, 18, 20, 0.16);
		border-bottom: 1px solid rgba(17, 18, 20, 0.16);
		color: #111214;
	}

	.body-logo-lockup {
		display: flex;
		justify-content: center;
		padding: clamp(0.6rem, 2vw, 1rem) 0 clamp(0.9rem, 2.8vw, 1.35rem);
		border-bottom: 1px solid rgba(17, 18, 20, 0.12);
	}

	.body-logo-lockup img {
		display: block;
		width: min(72vw, 22rem);
		height: auto;
	}

	.proof-line {
		margin: 0;
		padding: 0.76rem 0.18rem;
		display: grid;
		gap: 0.24rem;
		border-bottom: 1px solid rgba(17, 18, 20, 0.12);
	}

	.proof-line:last-child {
		border-bottom: 0;
	}

	.proof-line strong {
		display: block;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.02rem;
		font-weight: 400;
	}

	.proof-line span {
		display: block;
		font-size: 0.8rem;
		color: rgba(17, 18, 20, 0.64);
		line-height: 1.45;
	}

	.landing-summary {
		margin-top: 1rem;
	}

	.summary-layout {
		display: grid;
		grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
		gap: clamp(1rem, 3vw, 2rem);
		align-items: center;
		padding: clamp(0.75rem, 2.4vw, 1.35rem);
		background: #f8f4ec;
		border: 1px solid rgba(17, 18, 20, 0.12);
	}

	.summary-photo {
		margin: 0;
		overflow: hidden;
		border-radius: 0;
	}

	.summary-photo img {
		display: block;
		width: 100%;
		height: 100%;
		aspect-ratio: 3 / 4;
		object-fit: cover;
		object-position: center;
		filter: grayscale(0.08) saturate(0.78) contrast(1.08) brightness(1.02);
	}

	.summary-copy {
		display: grid;
		gap: 0.74rem;
	}

	.stat-line {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.65rem;
		align-items: center;
	}

	.stat-line span {
		display: inline;
		font-size: 0.8rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-weight: var(--weight-semibold);
		color: #111214;
	}

	.core-features {
		margin-top: clamp(1rem, 2.4vw, 1.45rem);
	}

	.core-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
		gap: clamp(1rem, 3vw, 2rem);
		align-items: center;
		padding: clamp(0.75rem, 2.4vw, 1.35rem) 0;
		border-top: 1px solid rgba(17, 18, 20, 0.12);
		border-bottom: 1px solid rgba(17, 18, 20, 0.12);
	}

	.core-copy {
		display: grid;
		gap: 0.72rem;
	}

	.core-photo {
		margin: 0;
		overflow: hidden;
		border-radius: 0;
	}

	.core-photo img {
		display: block;
		width: 100%;
		height: 100%;
		aspect-ratio: 3 / 4;
		object-fit: cover;
		object-position: center;
		filter: grayscale(0.08) saturate(0.78) contrast(1.08) brightness(1.02);
	}

	.capability-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.62rem 0.84rem;
	}

	.capability-list li {
		padding: 0.25rem 0 0.62rem;
		border-bottom: 1px solid rgba(17, 18, 20, 0.14);
	}

	.capability-list h3 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.02rem;
		font-weight: 400;
		color: #111214;
	}

	.capability-list p {
		margin: 0.3rem 0 0;
		font-size: 0.83rem;
		line-height: 1.44;
		color: rgba(17, 18, 20, 0.64);
	}

	.overview-preview {
		margin-top: clamp(1rem, 2.5vw, 1.45rem);
	}

	.preview-grid {
		margin-top: 0.72rem;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.56rem;
	}

	.preview-shot {
		margin: 0;
		overflow: hidden;
		background: #f8f4ec;
		padding: 0.28rem;
		border: 1px solid rgba(17, 18, 20, 0.12);
		border-radius: 0;
	}

	.preview-shot img {
		display: block;
		width: 100%;
		height: 100%;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		object-position: top center;
		border-radius: 0;
		filter: grayscale(0.12) saturate(0.72) contrast(1.1) brightness(1.03);
	}

	.execution-path {
		margin-top: clamp(1rem, 2.5vw, 1.45rem);
		padding: clamp(0.85rem, 2.4vw, 1.35rem) 0;
		border-top: 1px solid rgba(17, 18, 20, 0.12);
		border-bottom: 1px solid rgba(17, 18, 20, 0.12);
	}

	.step-list {
		margin-top: 0.5rem;
		display: grid;
		gap: 0;
	}

	.step-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.72rem;
		padding: 0.72rem 0.2rem;
		border-bottom: 1px solid rgba(17, 18, 20, 0.12);
	}

	.step-row:last-child {
		border-bottom: 0;
	}

	.timeline-step {
		margin: 0;
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 999px;
		border: 1px solid rgba(17, 18, 20, 0.24);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #111214;
		background: #f8f4ec;
	}

	.step-row h3 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.05rem;
		font-weight: 400;
		color: #111214;
	}

	.step-row p {
		margin: 0.28rem 0 0;
		color: rgba(17, 18, 20, 0.64);
		font-size: 0.84rem;
		line-height: 1.44;
	}

	.inline-link {
		margin-top: 0.5rem;
		display: inline-flex;
		align-items: center;
		text-decoration: none;
		color: #111214;
		border-bottom: 1px solid rgba(17, 18, 20, 0.4);
		padding-bottom: 0.12rem;
		font-weight: var(--weight-semibold);
		font-size: 0.85rem;
	}

	.operator-quote {
		margin-top: 1rem;
		padding: clamp(1rem, 3vw, 1.45rem);
		border-left: 3px solid #111214;
		background: #f8f4ec;
		border-radius: 0;
		color: #111214;
	}

	.operator-quote blockquote {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(1.05rem, 2.4vw, 1.4rem);
		line-height: 1.5;
	}

	.operator-quote p {
		margin: 0.5rem 0 0;
		color: rgba(17, 18, 20, 0.58);
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.bottom-cta {
		margin-top: 1.1rem;
		padding: clamp(1rem, 3vw, 1.45rem);
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.8rem;
		background: #111214;
		border: 1px solid #111214;
		border-radius: 0;
		color: #f8f4ec;
	}

	.bottom-cta h2 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(1.2rem, 3vw, 1.8rem);
		font-weight: 400;
	}

	.bottom-cta p {
		margin: 0.35rem 0 0;
		color: rgba(248, 244, 236, 0.72);
	}

	.bottom-cta .btn {
		border-color: rgba(248, 244, 236, 0.32);
		background: transparent;
		color: #f8f4ec;
	}

	.bottom-cta .btn-primary {
		background: #f8f4ec;
		color: #111214;
		border-color: #f8f4ec;
	}

	.store-badge-row {
		margin-top: 0.55rem;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.52rem;
		width: min(100%, 24rem);
		margin-inline: auto;
	}

	.store-badge {
		width: 100%;
		height: auto;
		display: block;
		border-radius: 0;
		border: 1px solid rgba(17, 18, 20, 0.12);
		background: #f8f4ec;
	}

	.nns-line {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.28rem 0.38rem;
		font-size: 0.64rem;
		color: rgba(17, 18, 20, 0.62);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.nns-credits {
		margin-top: 0.55rem;
	}

	.nns-line-logo {
		width: 0.9rem;
		height: 0.9rem;
		display: block;
		opacity: 0.9;
	}

	.cert-inline {
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
	}

	.cert-inline-logo {
		width: auto;
		height: 0.9rem;
		display: block;
		opacity: 0.92;
		object-fit: contain;
	}

	.nns-line [aria-hidden='true'] {
		opacity: 0.6;
	}

	@media (max-width: 900px) {
		.summary-layout {
			grid-template-columns: minmax(140px, 38vw) minmax(0, 1fr);
			gap: 0.65rem;
		}

		.core-layout {
			grid-template-columns: minmax(0, 1fr) minmax(140px, 38vw);
			gap: 0.65rem;
		}

		.capability-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.56rem 0.62rem;
		}

		.preview-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.section-head h2 {
			font-size: clamp(1.05rem, 3.5vw, 1.45rem);
		}

		.capability-list h3 {
			font-size: 0.88rem;
		}

		.capability-list p {
			font-size: 0.76rem;
		}

		.summary-photo img,
		.core-photo img {
			aspect-ratio: 4 / 5;
		}

		.stat-line span {
			font-size: 0.73rem;
			letter-spacing: 0.06em;
		}
	}

	@media (max-width: 760px) {
		.hero {
			margin-top: calc(clamp(0.75rem, 2.6vw, var(--space-4)) * -1 - 0.1rem);
		}

		.hero-carousel {
			min-height: clamp(430px, 108vw, 560px);
		}

		.slide-content {
			bottom: clamp(7.3rem, 16vw, 8.8rem);
			padding-inline: 0.9rem;
		}

		.bottom-cta {
			flex-direction: column;
			align-items: flex-start;
			border-radius: 0;
		}

		.nns-line {
			font-size: 0.58rem;
		}

		.store-badge {
			border-radius: 0;
		}
	}
</style>




