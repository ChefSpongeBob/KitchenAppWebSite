<script lang="ts">
	import { fade, fly } from 'svelte/transition';

	export let data: {
		businessName: string;
	};

	export let form:
		| {
				error?: string;
		  }
		| null;

	type Slide = {
		id: string;
		nav: string;
		title: string;
		subtitle: string;
		description: string;
		bullets: string[];
		background: {
			kind: 'image' | 'video';
			src: string;
			position?: string;
			alt: string;
		};
		shot?: {
			src: string;
			alt: string;
			fit?: 'contain' | 'cover';
			position?: string;
			align?: 'left' | 'right' | 'center';
			frame?: 'portrait' | 'landscape' | 'wide';
		};
	};

	const slides: Slide[] = [
		{
			id: 'admin-start',
			nav: 'Start',
			title: `Welcome, ${data.businessName}`,
			subtitle: 'Admin Flow',
			description: 'You control launch settings from here.',
			bullets: ['Review dashboard', 'Open app editor', 'Confirm team setup'],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_7461876514951404517.jpg',
				position: 'center 36%',
				alt: 'Kitchen team in service'
			},
			shot: {
				src: '/marketing/app/admin-dashboard.png',
				alt: 'Admin dashboard',
				fit: 'contain',
				align: 'right',
				frame: 'landscape'
			}
		},
		{
			id: 'admin-editor',
			nav: 'Editor',
			title: 'Configure features',
			subtitle: 'Enable only what you need',
			description: 'Turn features on/off for this business.',
			bullets: ['Set active modules', 'Set restrictions', 'Save profile details'],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_4126678697134084261.jpg',
				position: 'center center',
				alt: 'Large kitchen production'
			},
			shot: {
				src: '/marketing/app/scheduling-builder.png',
				alt: 'Admin editor area',
				fit: 'contain',
				align: 'left',
				frame: 'landscape'
			}
		},
		{
			id: 'admin-finish',
			nav: 'Launch',
			title: 'Enter Admin',
			subtitle: 'Guided mode will open',
			description: 'Finish to open your admin workspace.',
			bullets: ['Dashboard guide', 'Editor guide', 'Quick start'],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_2922002948285858149.jpg',
				position: 'center center',
				alt: 'Plated food production'
			},
			shot: {
				src: '/marketing/app/employee-homepage.png',
				alt: 'Employee workspace mobile view',
				fit: 'contain',
				align: 'center',
				frame: 'portrait'
			}
		}
	];

	let activeIndex = 0;
	let touchStartX = 0;
	let touchStartY = 0;
	$: activeSlide = slides[activeIndex];
	$: progressPercent = Math.round(((activeIndex + 1) / slides.length) * 100);

	function nextSlide() {
		activeIndex = Math.min(activeIndex + 1, slides.length - 1);
	}

	function previousSlide() {
		activeIndex = Math.max(activeIndex - 1, 0);
	}

	function jumpTo(index: number) {
		activeIndex = Math.max(0, Math.min(index, slides.length - 1));
	}

	function isDone(index: number) {
		return index < activeIndex;
	}

	function handleKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		const tagName = target?.tagName;
		if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;
		if (event.key === 'ArrowRight') nextSlide();
		if (event.key === 'ArrowLeft') previousSlide();
	}

	function handleTouchStart(event: TouchEvent) {
		const touch = event.changedTouches[0];
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
	}

	function handleTouchEnd(event: TouchEvent) {
		const touch = event.changedTouches[0];
		const deltaX = touch.clientX - touchStartX;
		const deltaY = touch.clientY - touchStartY;
		if (Math.abs(deltaX) < 70 || Math.abs(deltaX) < Math.abs(deltaY) * 1.1) return;
		if (deltaX < 0) nextSlide();
		if (deltaX > 0) previousSlide();
	}
</script>

<svelte:window
	on:keydown={handleKeydown}
	on:touchstart={handleTouchStart}
	on:touchend={handleTouchEnd}
/>

<section class="tour-shell" aria-label="Admin welcome slideshow">
	<div class="tour-bg" aria-hidden="true">
		{#if activeSlide.background.kind === 'video'}
			<video autoplay muted loop playsinline>
				<source src={activeSlide.background.src} type="video/mp4" />
			</video>
		{:else}
			<img
				src={activeSlide.background.src}
				alt={activeSlide.background.alt}
				style={`object-position:${activeSlide.background.position ?? 'center center'};`}
			/>
		{/if}
		<div class="tour-shade"></div>
	</div>

	<header class="tour-header">
		<div class="tour-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progressPercent}>
			<div class="tour-progress-copy">
				<span>Slide {activeIndex + 1} / {slides.length}</span>
				<span>{progressPercent}%</span>
			</div>
			<div class="tour-progress-track">
				<span style={`width:${progressPercent}%`}></span>
			</div>
		</div>
	</header>

	{#key activeSlide.id}
		<main
			class="tour-main"
			class:shot-left={activeSlide.shot?.align === 'left'}
			class:shot-center={activeSlide.shot?.align === 'center'}
			in:fade={{ duration: 220 }}
			out:fade={{ duration: 160 }}
		>
			<div class="tour-copy" in:fly={{ y: 18, duration: 260 }}>
				<p class="tour-subtitle">{activeSlide.subtitle}</p>
				<h1>{activeSlide.title}</h1>
				<p class="tour-description">{activeSlide.description}</p>

				<ul class="tour-bullets">
					{#each activeSlide.bullets as bullet}
						<li>{bullet}</li>
					{/each}
				</ul>

				{#if form?.error}
					<p class="tour-feedback error">{form.error}</p>
				{/if}
			</div>

			{#if activeSlide.shot}
				<figure
					class="tour-shot"
					class:portrait={activeSlide.shot.frame === 'portrait'}
					class:landscape={activeSlide.shot.frame === 'landscape'}
					class:wide={activeSlide.shot.frame === 'wide'}
					in:fly={{ x: activeSlide.shot.align === 'left' ? -24 : activeSlide.shot.align === 'center' ? 0 : 24, duration: 280 }}
				>
					<img
						src={activeSlide.shot.src}
						alt={activeSlide.shot.alt}
						class:contain={activeSlide.shot.fit === 'contain'}
						style={`object-position:${activeSlide.shot.position ?? 'center center'};`}
					/>
				</figure>
			{/if}
		</main>
	{/key}

	{#if activeIndex === slides.length - 1}
		<div class="setup-zone finish-zone">
			<form method="POST" action="?/complete">
				<button type="submit" class="primary">Enter Admin</button>
			</form>
		</div>
	{/if}

	<footer class="tour-footer">
		<button type="button" class="nav-btn" on:click={previousSlide} disabled={activeIndex === 0}>Back</button>

		<div class="dot-rail" aria-label="Tour steps">
			{#each slides as slide, index}
				<button
					type="button"
					class="dot"
					class:active={index === activeIndex}
					class:done={isDone(index)}
					on:click={() => jumpTo(index)}
					aria-label={`Go to ${slide.nav}`}
				></button>
			{/each}
		</div>

		{#if activeIndex !== slides.length - 1}
			<button type="button" class="nav-btn primary" on:click={nextSlide}>Next</button>
		{/if}
	</footer>
</section>

<style>
	.tour-shell {
		position: relative;
		min-height: 100dvh;
		overflow: clip;
		color: #111214;
	}

	.tour-bg {
		position: absolute;
		inset: 0;
		z-index: 0;
	}

	.tour-bg img,
	.tour-bg video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: grayscale(0.06) saturate(0.72) contrast(1.06) brightness(1.08);
		animation: slow-pan 28s ease-in-out infinite alternate;
	}

	.tour-shade {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(105deg, rgba(255, 255, 255, 0.74) 0%, rgba(255, 255, 255, 0.48) 34%, rgba(255, 255, 255, 0.22) 58%, rgba(255, 255, 255, 0.62) 100%),
			radial-gradient(circle at 72% 48%, rgba(143, 130, 110, 0.16), transparent 42%);
	}

	.tour-header,
	.tour-main,
	.setup-zone,
	.tour-footer {
		position: relative;
		z-index: 2;
	}

	.tour-header {
		display: flex;
		justify-content: flex-end;
		align-items: end;
		gap: 1rem;
		padding: max(1rem, var(--safe-top)) clamp(1rem, 3vw, 2.2rem) 0;
	}

	.tour-progress {
		display: grid;
		gap: 0.32rem;
		min-width: min(40vw, 340px);
	}

	.tour-progress-copy {
		display: flex;
		justify-content: space-between;
		gap: 0.7rem;
		font-size: 0.76rem;
		color: rgba(17, 18, 20, 0.62);
	}

	.tour-progress-track {
		height: 0.42rem;
		border-radius: 0;
		overflow: hidden;
		background: rgba(17, 18, 20, 0.12);
	}

	.tour-progress-track span {
		display: block;
		height: 100%;
		background: #111214;
	}

	.tour-main {
		display: grid;
		grid-template-columns: minmax(0, 1.02fr) minmax(0, 1fr);
		gap: clamp(1rem, 3vw, 2.5rem);
		align-items: center;
		padding: clamp(0.55rem, 1.6vw, 1rem) clamp(1rem, 3vw, 2.2rem) 0;
		min-height: calc(100dvh - 15.5rem);
	}

	.tour-main.shot-left {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.02fr);
	}

	.tour-main.shot-left .tour-shot {
		order: 1;
		justify-self: start;
	}

	.tour-main.shot-left .tour-copy {
		order: 2;
	}

	.tour-main.shot-center {
		grid-template-columns: 1fr;
	}

	.tour-main.shot-center .tour-copy {
		justify-self: center;
		width: min(100%, 50rem);
	}

	.tour-main.shot-center .tour-shot {
		justify-self: center;
	}

	.tour-copy {
		display: grid;
		gap: 0.62rem;
	}

	.tour-subtitle {
		margin: 0;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: rgba(17, 18, 20, 0.58);
	}

	h1 {
		margin: 0;
		font-size: clamp(1.5rem, 4.6vw, 3.2rem);
		line-height: 1.05;
		max-width: 18ch;
	}

	.tour-description {
		margin: 0;
		font-size: clamp(0.93rem, 1.15vw, 1.08rem);
		line-height: 1.48;
		max-width: 56ch;
		color: rgba(17, 18, 20, 0.72);
	}

	.tour-bullets {
		margin: 0.1rem 0 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.3rem;
	}

	.tour-bullets li {
		font-size: 0.88rem;
		line-height: 1.35;
		color: rgba(17, 18, 20, 0.72);
	}

	.tour-feedback {
		margin: 0;
		font-size: 0.84rem;
		font-weight: 600;
	}

	.tour-feedback.error {
		color: #8e4036;
	}

	.tour-shot {
		margin: 0;
		width: min(46vw, 40rem);
		aspect-ratio: 16 / 10;
		border-radius: 0;
		overflow: hidden;
		box-shadow: none;
		border: 0;
		background: transparent;
		padding: 0;
		position: relative;
		transition: transform 220ms ease, box-shadow 220ms ease;
	}

	.tour-shot::before {
		content: none;
	}

	.tour-shot:hover {
		transform: translateY(-2px);
		box-shadow: none;
	}

	.tour-shot.portrait {
		width: min(27vw, 18rem);
		aspect-ratio: 10 / 16;
	}

	.tour-shot.landscape {
		width: min(47vw, 42rem);
		aspect-ratio: 16 / 10;
	}

	.tour-shot.wide {
		width: min(56vw, 52rem);
		aspect-ratio: 16 / 8.2;
	}

	.tour-shot img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 0;
	}

	.tour-shot img.contain {
		object-fit: contain;
		background: transparent;
	}

	.setup-zone {
		margin: 0 clamp(1rem, 3vw, 2.2rem) 0.7rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.9rem;
		font-size: 0.9rem;
		color: rgba(17, 18, 20, 0.72);
	}

	button.primary {
		padding: 0.56rem 0.88rem;
		border-radius: 0;
		border: 1px solid #111214;
		color: #ffffff;
		font-weight: 700;
		background: #111214;
	}

	.tour-footer {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.8rem;
		padding: 0.85rem clamp(1rem, 3vw, 2.2rem) max(0.85rem, var(--safe-bottom));
		background: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.92));
	}

	.nav-btn {
		padding: 0.58rem 0.9rem;
		border-radius: 0;
		border: 1px solid rgba(17, 18, 20, 0.18);
		background: rgba(255, 255, 255, 0.82);
		color: #111214;
		font-weight: 600;
	}

	.nav-btn.primary {
		background: #111214;
		color: #ffffff;
	}

	.nav-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.dot-rail {
		display: flex;
		justify-content: center;
		gap: 0.34rem;
		flex-wrap: wrap;
	}

	.dot {
		width: 0.64rem;
		height: 0.64rem;
		border-radius: 0;
		border: 1px solid rgba(17, 18, 20, 0.22);
		background: rgba(255, 255, 255, 0.16);
	}

	.dot.active {
		background: #111214;
		border-color: #111214;
		transform: scale(1.07);
	}

	.dot.done {
		background: #8f826e;
		border-color: #8f826e;
	}

	@keyframes slow-pan {
		0% {
			transform: scale(1.03) translate3d(0, 0, 0);
		}
		100% {
			transform: scale(1.08) translate3d(1%, -1%, 0);
		}
	}

	@media (max-width: 1040px) {
		.tour-main {
			grid-template-columns: 1fr;
			align-items: start;
			min-height: calc(100dvh - 22rem);
		}

		.tour-shot {
			width: min(100%, 35rem);
			aspect-ratio: 16 / 10;
		}

		.tour-shot.portrait {
			width: min(100%, 18rem);
			aspect-ratio: 10 / 16;
		}

		.tour-shot.wide {
			width: min(100%, 35rem);
			aspect-ratio: 16 / 9.2;
		}
	}

	@media (max-width: 720px) {
		.tour-header {
			flex-direction: column;
			align-items: start;
		}

		.tour-progress {
			min-width: 0;
			width: 100%;
		}

		h1 {
			font-size: clamp(1.35rem, 8.4vw, 2.18rem);
		}

		.tour-main {
			padding-bottom: 0.5rem;
			min-height: calc(100dvh - 25.5rem);
		}

		.tour-footer {
			grid-template-columns: 1fr;
		}

		.nav-btn {
			width: 100%;
		}

		.dot-rail {
			order: -1;
		}

		.tour-shot,
		.tour-shot.landscape,
		.tour-shot.wide {
			width: min(100%, 27rem);
		}

		.tour-shot.portrait {
			width: min(100%, 15rem);
		}
	}
</style>
