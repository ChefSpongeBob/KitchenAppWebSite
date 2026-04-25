<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { fade, fly } from 'svelte/transition';
	import { scheduleDepartments } from '$lib/assets/schedule';

	export let data: {
		business: {
			id: string;
			name: string;
			slug: string;
			planTier: string;
			template: string | null;
			legalName: string;
			registryId: string;
			contactEmail: string;
			contactPhone: string;
			websiteUrl: string;
			addressLine1: string;
			addressLine2: string;
			addressCity: string;
			addressState: string;
			addressPostalCode: string;
			addressCountry: string;
		};
		invites: Array<{
			id: string;
			email: string;
			role: string;
			code: string;
			createdAt: number;
			expiresAt: number | null;
		}>;
		teamCount: number;
		steps: {
			profileComplete: boolean;
			inviteComplete: boolean;
			templateComplete: boolean;
			completeReady: boolean;
		};
	};

	export let form:
		| {
				error?: string;
				success?: boolean;
				section?: 'profile' | 'invite' | 'template' | 'complete';
				message?: string;
				inviteCode?: string;
		  }
		| null;

	type SlideKind = 'feature' | 'security' | 'profile' | 'template' | 'invite' | 'finish';

	type Slide = {
		id: string;
		nav: string;
		kind: SlideKind;
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
		};
	};

	const slides: Slide[] = [
		{
			id: 'welcome',
			nav: 'Welcome',
			kind: 'feature',
			title: 'Welcome to your full guided app tour',
			subtitle: 'KitchenOS setup, explained like a first-boot experience',
			description:
				'You will move through one full-screen page at a time. Each page explains a real feature with actual app screenshots, then setup appears as guided steps you can complete or skip.',
			bullets: [
				'One immersive flow from tour to launch',
				'Real app visuals, not placeholder demos',
				'Back, Next, and Skip controls all the way through'
			],
			background: {
				kind: 'video',
				src: '/marketing/20240730_154643.mp4',
				alt: 'Kitchen team preparing and plating during service'
			},
			shot: {
				src: '/marketing/homepage.png',
				alt: 'App homepage overview',
				fit: 'contain'
			}
		},
		{
			id: 'dashboard',
			nav: 'Dashboard',
			kind: 'feature',
			title: 'Homepage command center',
			subtitle: 'Announcements, specials, temperatures, and shift awareness',
			description:
				'The home screen gives your team one quick operating view for the day, with live cards that reduce status confusion before service starts.',
			bullets: [
				'Announcements and operational alerts in one place',
				'Today shift snapshot for every logged-in user',
				'Specials, menu references, and live temp cards'
			],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_7461876514951404517.jpg',
				position: 'center 22%',
				alt: 'Kitchen team collaborating during service prep'
			},
			shot: {
				src: '/marketing/homepage.png',
				alt: 'Homepage screenshot',
				fit: 'contain'
			}
		},
		{
			id: 'todo',
			nav: 'Todo',
			kind: 'feature',
			title: 'Task assignment with accountability',
			subtitle: 'Who owns what, and what is still active',
			description:
				'Todo keeps shift execution clear. Managers can assign work to specific users and staff can see completion status without needing side messages.',
			bullets: [
				'Assign tasks to a person or leave as open team task',
				'Status-aware task list with active visibility',
				'Fast entry and deletion from one panel'
			],
			background: {
				kind: 'image',
				src: '/marketing/20260216_192313.jpg',
				position: 'center center',
				alt: 'Service ticket rail representing workflow'
			},
			shot: {
				src: '/marketing/todo-assign.png',
				alt: 'Todo assignment screenshot',
				fit: 'contain'
			}
		},
		{
			id: 'lists',
			nav: 'Prep Lists',
			kind: 'feature',
			title: 'Prep lists and checklist execution',
			subtitle: 'Structured openings, service prep, and close routines',
			description:
				'Prep list sections and checklist categories let the team execute repeatable tasks with less verbal dependency and cleaner handoffs.',
			bullets: [
				'Category-first list architecture',
				'Prep counts and references in one view',
				'Fast editing for operational changes'
			],
			background: {
				kind: 'image',
				src: '/marketing/IMG_20240114_105902_01.jpg',
				position: 'center center',
				alt: 'Kitchen line setup and prep area'
			},
			shot: {
				src: '/marketing/preplists.png',
				alt: 'Prep list section screenshot',
				fit: 'contain'
			}
		},
		{
			id: 'recipes',
			nav: 'Recipes',
			kind: 'feature',
			title: 'Recipe and procedure standardization',
			subtitle: 'Searchable references that keep quality consistent',
			description:
				'Recipe pages hold production standards in one searchable place so teams can execute consistently across days, stations, and staff changes.',
			bullets: [
				'Category browsing plus direct search',
				'Recipe format designed for kitchen readability',
				'Admin updates propagate instantly'
			],
			background: {
				kind: 'image',
				src: '/marketing/20241129_155451.jpg',
				position: 'center center',
				alt: 'Dish closeup representing recipe quality'
			},
			shot: {
				src: '/marketing/Screenshot-2026-04-19-021053.png',
				alt: 'Recipe and prep detail screenshot',
				fit: 'contain'
			}
		},
		{
			id: 'schedule',
			nav: 'Schedule',
			kind: 'feature',
			title: 'Scheduling for managers and staff',
			subtitle: 'Builder controls for admin, clear view for team',
			description:
				'The scheduling system supports admin week building and employee day visibility, with department-aware structure and straightforward shift controls.',
			bullets: [
				'Team-wide builder for weekly planning',
				'Mobile-ready staff schedule visibility',
				'Department and role structure baked in'
			],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_5753045492765058409.jpg',
				position: 'center center',
				alt: 'Large production food spread'
			},
			shot: {
				src: '/marketing/app/scheduling-builder.png',
				alt: 'Schedule builder screenshot',
				fit: 'contain'
			}
		},
		{
			id: 'admin',
			nav: 'Admin',
			kind: 'feature',
			title: 'Admin control over operations',
			subtitle: 'Editors, users, content, and schedule controls',
			description:
				'Admin pages centralize control so managers can adjust app behavior without engineering changes, from list content to user access to schedule configuration.',
			bullets: [
				'User and access management',
				'Content editors for docs, lists, and recipes',
				'Scheduling and operational controls'
			],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_4126678697134084261.jpg',
				position: 'center center',
				alt: 'Large kitchen production plating'
			},
			shot: {
				src: '/marketing/admin.png',
				alt: 'Admin dashboard screenshot',
				fit: 'contain'
			}
		},
		{
			id: 'security',
			nav: 'Security',
			kind: 'security',
			title: 'Set startup security preferences',
			subtitle: 'These defaults can be changed later in profile settings',
			description:
				'Choose how aggressively the workspace should notify and validate sessions on first launch.',
			bullets: [],
			background: {
				kind: 'image',
				src: '/marketing/20260101_201259.jpg',
				position: 'center center',
				alt: 'Plated dish for cinematic background'
			}
		},
		{
			id: 'profile',
			nav: 'Workspace',
			kind: 'profile',
			title: 'Business identity registry',
			subtitle: 'Workspace name + ownership details',
			description:
				'Set your business profile and registry details now. Everything can be edited later in App Editor.',
			bullets: [],
			background: {
				kind: 'image',
				src: '/marketing/20240321_110459.jpg',
				position: 'center center',
				alt: 'Kitchen scene with prep in view'
			}
		},
		{
			id: 'template',
			nav: 'Schedule Setup',
			kind: 'template',
			title: 'Choose your schedule structure',
			subtitle: 'Standard Setup or Custom Setup',
			description:
				'Select a standard launch model or customize departments now. You can edit this later anytime in admin.',
			bullets: [],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_3336762680387538905.jpg',
				position: 'center center',
				alt: 'Food and prep station scene'
			},
			shot: {
				src: '/marketing/scheduling.png',
				alt: 'Schedule builder screenshot',
				fit: 'contain'
			}
		},
		{
			id: 'invite',
			nav: 'Invite Team',
			kind: 'invite',
			title: 'Invite your first manager',
			subtitle: 'You can skip and invite later from Admin',
			description:
				'Send an invite code now to bring your leadership team in before launch.',
			bullets: [],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_2544492397669735085.jpg',
				position: 'center center',
				alt: 'Dish assembly closeup'
			}
		},
		{
			id: 'finish',
			nav: 'Finish',
			kind: 'finish',
			title: 'Launch your workspace',
			subtitle: 'Finalize onboarding and open the app',
			description:
				'When you finish, the app opens with your saved settings. Any skipped items can be completed in Admin at any time.',
			bullets: [],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_2922002948285858149.jpg',
				position: 'center center',
				alt: 'Large batch of plated dishes'
			}
		}
	];

	const profileIndex = slides.findIndex((slide) => slide.kind === 'profile');
	const templateIndex = slides.findIndex((slide) => slide.kind === 'template');
	const inviteIndex = slides.findIndex((slide) => slide.kind === 'invite');
	const finishIndex = slides.findIndex((slide) => slide.kind === 'finish');

	const sectionToIndex: Record<'profile' | 'template' | 'invite' | 'complete', number> = {
		profile: profileIndex,
		template: templateIndex,
		invite: inviteIndex,
		complete: finishIndex
	};

	const templateOptions: Array<{ key: string; title: string; description: string }> = [
		{
			key: 'full-operations',
			title: 'Standard Setup',
			description: 'FOH, BOH, and Management with recommended starter roles.'
		},
		{
			key: 'custom',
			title: 'Custom Setup',
			description: 'Select only the departments your operation needs.'
		}
	];

	let activeIndex = 0;
	let businessName = data.business.name;
	let planTier = data.business.planTier;
	let legalName = data.business.legalName;
	let registryId = data.business.registryId;
	let contactEmail = data.business.contactEmail;
	let contactPhone = data.business.contactPhone;
	let websiteUrl = data.business.websiteUrl;
	let addressLine1 = data.business.addressLine1;
	let addressLine2 = data.business.addressLine2;
	let addressCity = data.business.addressCity;
	let addressState = data.business.addressState;
	let addressPostalCode = data.business.addressPostalCode;
	let addressCountry = data.business.addressCountry;
	let selectedTemplate = data.business.template === 'custom' ? 'custom' : 'full-operations';
	let lastFormState = '';

	let profileComplete = data.steps.profileComplete;
	let templateComplete = data.steps.templateComplete;
	let inviteComplete = data.steps.inviteComplete;

	let sessionAlerts = true;
	let managerAlerts = true;
	let trustedDevices = true;

	let touchStartX = 0;
	let touchStartY = 0;

	const formActionEnhance = () => {
		return async ({ result }: { result: Parameters<typeof applyAction>[0] }) => {
			await applyAction(result);
		};
	};

	$: activeSlide = slides[activeIndex];
	$: setupPercent = Math.round(([profileComplete, templateComplete, inviteComplete].filter(Boolean).length / 3) * 100);
	$: progressPercent = Math.round(((activeIndex + 1) / slides.length) * 100);
	$: showSkip = activeSlide.kind === 'security' || activeSlide.kind === 'profile' || activeSlide.kind === 'template' || activeSlide.kind === 'invite';

	$: if (form?.success && form.section === 'profile') profileComplete = true;
	$: if (form?.success && form.section === 'template') templateComplete = true;
	$: if (form?.success && form.section === 'invite') inviteComplete = true;

	$: if (form) {
		const token = `${form.section ?? ''}|${form.success ? '1' : '0'}|${form.message ?? ''}|${form.error ?? ''}`;
		if (token !== lastFormState) {
			lastFormState = token;
			if (form.section) {
				const targetIndex = sectionToIndex[form.section];
				activeIndex = form.success ? Math.min(targetIndex + 1, slides.length - 1) : targetIndex;
			}
		}
	}

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
		if (index < activeIndex) return true;
		const slide = slides[index];
		if (slide.kind === 'profile') return profileComplete;
		if (slide.kind === 'template') return templateComplete;
		if (slide.kind === 'invite') return inviteComplete;
		if (slide.kind === 'finish') return profileComplete && templateComplete;
		return false;
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

	function formatInviteDate(unix: number | null) {
		if (!unix) return 'No expiration';
		return new Date(unix * 1000).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:window
	on:keydown={handleKeydown}
	on:touchstart={handleTouchStart}
	on:touchend={handleTouchEnd}
/>

<section class="tour-shell" aria-label="Guided onboarding tour">
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
		<div class="tour-brand">
			<span>SoftwareKitchenNNS</span>
			<strong>Guided App Tour</strong>
		</div>
		<div class="tour-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progressPercent}>
			<div class="tour-progress-copy">
				<span>Slide {activeIndex + 1} / {slides.length}</span>
				<span>Setup {setupPercent}%</span>
			</div>
			<div class="tour-progress-track">
				<span style={`width:${progressPercent}%`}></span>
			</div>
		</div>
	</header>

	{#key activeSlide.id}
		<main class="tour-main" in:fade={{ duration: 220 }} out:fade={{ duration: 160 }}>
			<div class="tour-copy" in:fly={{ y: 18, duration: 260 }}>
				<p class="tour-subtitle">{activeSlide.subtitle}</p>
				<h1>{activeSlide.title}</h1>
				<p class="tour-description">{activeSlide.description}</p>

				{#if activeSlide.bullets.length > 0}
					<ul class="tour-bullets">
						{#each activeSlide.bullets as bullet}
							<li>{bullet}</li>
						{/each}
					</ul>
				{/if}

				{#if form?.error}
					<p class="tour-feedback error">{form.error}</p>
				{:else if form?.message}
					<p class="tour-feedback success">{form.message}</p>
				{/if}
			</div>

			{#if activeSlide.shot}
				<figure class="tour-shot" in:fly={{ x: 24, duration: 280 }}>
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

	{#if activeSlide.kind === 'security'}
		<div class="setup-zone">
			<label class="toggle-line"><input type="checkbox" bind:checked={sessionAlerts} /> Session Alerts</label>
			<label class="toggle-line"><input type="checkbox" bind:checked={managerAlerts} /> Manager Notifications</label>
			<label class="toggle-line"><input type="checkbox" bind:checked={trustedDevices} /> Trusted Devices</label>
		</div>
	{/if}

	{#if activeSlide.kind === 'profile'}
		<form class="setup-zone form-zone" method="POST" action="?/save_profile" use:enhance={formActionEnhance}>
			<label for="business_name">Business Name</label>
			<input id="business_name" name="business_name" bind:value={businessName} required placeholder="Northside Kitchen" />

			<label for="plan_tier">Plan Tier</label>
			<select id="plan_tier" name="plan_tier" bind:value={planTier}>
				<option value="starter">Starter</option>
				<option value="growth">Growth</option>
				<option value="enterprise">Enterprise</option>
			</select>

			<label for="legal_name">Legal Business Name</label>
			<input id="legal_name" name="legal_name" bind:value={legalName} placeholder="Northside Kitchen LLC" />

			<label for="registry_id">Registry ID</label>
			<input id="registry_id" name="registry_id" bind:value={registryId} placeholder="State Filing Number" />

			<label for="contact_email">Business Contact Email</label>
			<input id="contact_email" name="contact_email" type="email" bind:value={contactEmail} placeholder="admin@northsidekitchen.com" />

			<label for="contact_phone">Business Contact Phone</label>
			<input id="contact_phone" name="contact_phone" bind:value={contactPhone} placeholder="(555) 555-0143" />

			<label for="website_url">Website</label>
			<input id="website_url" name="website_url" bind:value={websiteUrl} placeholder="northsidekitchen.com" />

			<label for="address_line_1">Address Line 1</label>
			<input id="address_line_1" name="address_line_1" bind:value={addressLine1} placeholder="123 Main Street" />

			<label for="address_line_2">Address Line 2</label>
			<input id="address_line_2" name="address_line_2" bind:value={addressLine2} placeholder="Suite / Unit (optional)" />

			<label for="address_city">City</label>
			<input id="address_city" name="address_city" bind:value={addressCity} />

			<label for="address_state">State / Region</label>
			<input id="address_state" name="address_state" bind:value={addressState} />

			<label for="address_postal_code">Postal Code</label>
			<input id="address_postal_code" name="address_postal_code" bind:value={addressPostalCode} />

			<label for="address_country">Country</label>
			<input id="address_country" name="address_country" bind:value={addressCountry} placeholder="United States" />

			<button type="submit" class="primary">Save and Continue</button>
		</form>
	{/if}

	{#if activeSlide.kind === 'template'}
		<form class="setup-zone form-zone" method="POST" action="?/apply_template" use:enhance={formActionEnhance}>
			<div class="template-choices">
				{#each templateOptions as option}
					<label class="template-choice" class:selected={selectedTemplate === option.key}>
						<input type="radio" name="template" value={option.key} bind:group={selectedTemplate} />
						<div>
							<strong>{option.title}</strong>
							<span>{option.description}</span>
						</div>
					</label>
				{/each}
			</div>

			{#if selectedTemplate === 'custom'}
				<div class="department-grid">
					{#each scheduleDepartments as department}
						<label><input type="checkbox" name="departments" value={department} checked /> {department}</label>
					{/each}
				</div>
			{/if}

			<button type="submit" class="primary">Apply and Continue</button>
		</form>
	{/if}

	{#if activeSlide.kind === 'invite'}
		<form class="setup-zone form-zone" method="POST" action="?/invite_manager" use:enhance={formActionEnhance}>
			<label for="invite_email">Manager Email</label>
			<input id="invite_email" type="email" name="email" placeholder="manager@yourbusiness.com" required />

			<label for="invite_role">Role</label>
			<select id="invite_role" name="role" value="manager">
				<option value="manager">Manager</option>
				<option value="admin">Admin</option>
				<option value="staff">Staff</option>
			</select>

			<button type="submit" class="primary">Send Invite</button>

			{#if data.invites.length > 0}
				<div class="invite-log">
					{#each data.invites as invite}
						<p>{invite.email} · {invite.role} · expires {formatInviteDate(invite.expiresAt)}</p>
					{/each}
				</div>
			{/if}
		</form>
	{/if}

	{#if activeSlide.kind === 'finish'}
		<div class="setup-zone finish-zone">
			<p class:ok={profileComplete}>Workspace profile: {profileComplete ? 'saved' : 'defaults will apply'}</p>
			<p class:ok={templateComplete}>Schedule setup: {templateComplete ? 'saved' : 'standard setup will apply'}</p>
			<p class:ok={inviteComplete}>Team invite: {inviteComplete ? 'completed' : 'skipped'}</p>
			<form method="POST" action="?/complete_onboarding" use:enhance={formActionEnhance}>
				<button type="submit" class="primary">Finish Setup and Open App</button>
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

		{#if activeSlide.kind !== 'finish'}
			<button type="button" class="nav-btn primary" on:click={nextSlide}>{showSkip ? 'Skip' : 'Next'}</button>
		{/if}
	</footer>
</section>

<style>
	.tour-shell {
		position: relative;
		min-height: 100dvh;
		overflow: clip;
		color: #eff4fb;
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
		filter: saturate(1.08) contrast(1.04);
		animation: slow-pan 28s ease-in-out infinite alternate;
	}

	.tour-shade {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(105deg, rgba(8, 12, 18, 0.9) 0%, rgba(10, 14, 21, 0.82) 34%, rgba(10, 14, 21, 0.54) 58%, rgba(8, 12, 18, 0.88) 100%),
			radial-gradient(circle at 72% 48%, rgba(134, 168, 206, 0.22), transparent 42%);
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
		justify-content: space-between;
		align-items: end;
		gap: 1rem;
		padding: max(1rem, var(--safe-top)) clamp(1rem, 3vw, 2.2rem) 0;
	}

	.tour-brand {
		display: grid;
		gap: 0.2rem;
	}

	.tour-brand span {
		font-size: 0.72rem;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: rgba(234, 244, 255, 0.72);
	}

	.tour-brand strong {
		font-size: 1.08rem;
		font-weight: 700;
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
		color: rgba(235, 244, 255, 0.78);
	}

	.tour-progress-track {
		height: 0.42rem;
		border-radius: 999px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.18);
	}

	.tour-progress-track span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, #d0e2f7, #aac8e5);
	}

	.tour-main {
		display: grid;
		grid-template-columns: 1.05fr minmax(0, 1fr);
		gap: clamp(1rem, 3vw, 2.5rem);
		align-items: center;
		padding: clamp(0.55rem, 1.6vw, 1rem) clamp(1rem, 3vw, 2.2rem) 0;
		min-height: calc(100dvh - 15.5rem);
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
		color: rgba(235, 244, 255, 0.76);
	}

	h1 {
		margin: 0;
		font-size: clamp(1.5rem, 4.6vw, 3.2rem);
		line-height: 1.05;
		max-width: 18ch;
		text-wrap: balance;
	}

	.tour-description {
		margin: 0;
		font-size: clamp(0.93rem, 1.15vw, 1.08rem);
		line-height: 1.58;
		max-width: 62ch;
		color: rgba(237, 245, 255, 0.9);
	}

	.tour-bullets {
		margin: 0.1rem 0 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.3rem;
	}

	.tour-bullets li {
		font-size: 0.9rem;
		line-height: 1.45;
		color: rgba(236, 245, 255, 0.9);
	}

	.tour-feedback {
		margin: 0;
		font-size: 0.84rem;
		font-weight: 600;
	}

	.tour-feedback.error {
		color: #ffc9cf;
	}

	.tour-feedback.success {
		color: #bcefd1;
	}

	.tour-shot {
		margin: 0;
		height: min(58vh, 36rem);
		border-radius: 1rem;
		overflow: hidden;
		box-shadow: 0 28px 56px rgba(0, 0, 0, 0.38);
		border: 1px solid rgba(226, 239, 255, 0.25);
		background: rgba(7, 10, 15, 0.55);
	}

	.tour-shot img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.tour-shot img.contain {
		object-fit: contain;
		background: rgba(6, 10, 15, 0.8);
	}

	.setup-zone {
		margin: 0 clamp(1rem, 3vw, 2.2rem) 0.7rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.9rem;
		font-size: 0.9rem;
		color: rgba(237, 245, 255, 0.92);
	}

	.form-zone {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.58rem 0.8rem;
		align-items: end;
	}

	.form-zone label {
		grid-column: span 2;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(233, 244, 255, 0.72);
	}

	.form-zone input,
	.form-zone select {
		grid-column: span 2;
		width: 100%;
		padding: 0.66rem 0.74rem;
		border-radius: 0.65rem;
		border: 1px solid rgba(227, 239, 255, 0.32);
		background: rgba(7, 11, 16, 0.56);
		color: #eff5ff;
	}

	.form-zone input:focus,
	.form-zone select:focus {
		outline: none;
		border-color: rgba(205, 225, 245, 0.7);
	}

	.form-zone .primary {
		grid-column: span 2;
		justify-self: start;
	}

	.template-choices {
		grid-column: span 2;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.template-choice {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.5rem;
		align-items: start;
		padding: 0.6rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(228, 239, 255, 0.24);
		background: rgba(7, 11, 16, 0.5);
	}

	.template-choice input {
		grid-column: auto;
		width: auto;
		padding: 0;
		margin-top: 0.2rem;
	}

	.template-choice strong {
		display: block;
		font-size: 0.84rem;
	}

	.template-choice span {
		display: block;
		font-size: 0.76rem;
		color: rgba(233, 244, 255, 0.76);
	}

	.template-choice.selected {
		border-color: rgba(205, 225, 245, 0.7);
	}

	.department-grid {
		grid-column: span 2;
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem 0.75rem;
	}

	.department-grid label {
		display: inline-flex;
		align-items: center;
		gap: 0.38rem;
		font-size: 0.82rem;
		letter-spacing: 0;
		text-transform: none;
		grid-column: auto;
		color: rgba(234, 244, 255, 0.86);
	}

	.department-grid input {
		width: auto;
		padding: 0;
	}

	.toggle-line {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.toggle-line input {
		margin: 0;
	}

	.invite-log {
		grid-column: span 2;
		display: grid;
		gap: 0.22rem;
		font-size: 0.78rem;
		color: rgba(231, 243, 255, 0.78);
	}

	.invite-log p {
		margin: 0;
	}

	.finish-zone {
		display: grid;
		gap: 0.35rem;
	}

	.finish-zone p {
		margin: 0;
		font-size: 0.86rem;
	}

	.finish-zone p.ok {
		color: #b8ebcf;
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
		background: linear-gradient(180deg, rgba(8, 12, 18, 0), rgba(8, 12, 18, 0.84));
	}

	.nav-btn {
		padding: 0.58rem 0.9rem;
		border-radius: 999px;
		border: 1px solid rgba(218, 232, 250, 0.52);
		background: rgba(255, 255, 255, 0.08);
		color: #eef5ff;
		font-weight: 600;
	}

	.nav-btn.primary,
	button.primary {
		background: rgba(170, 199, 230, 0.24);
	}

	button.primary {
		padding: 0.56rem 0.88rem;
		border-radius: 999px;
		border: 1px solid rgba(213, 230, 249, 0.65);
		color: #f1f7ff;
		font-weight: 700;
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
		border-radius: 999px;
		border: 1px solid rgba(226, 238, 252, 0.58);
		background: rgba(255, 255, 255, 0.16);
	}

	.dot.active {
		background: #d1e4f8;
		border-color: #d1e4f8;
		transform: scale(1.07);
	}

	.dot.done {
		background: #9fd4b5;
		border-color: #9fd4b5;
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
			height: min(38vh, 20rem);
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

		.form-zone {
			grid-template-columns: 1fr;
		}

		.form-zone label,
		.form-zone input,
		.form-zone select,
		.form-zone .primary,
		.template-choices,
		.department-grid,
		.invite-log {
			grid-column: span 1;
		}

		.template-choices {
			grid-template-columns: 1fr;
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
	}
</style>
