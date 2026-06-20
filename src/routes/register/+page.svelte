<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { onMount } from 'svelte';

	export let form:
		| {
				error?: string;
				activeSlideId?: string;
				values?: Partial<RegisterFormValues>;
		  }
		| null;

	export let data: {
		inviteCode: string | null;
		agreementVersion: string;
	};

	type SlideKind = 'info' | 'input';
	type ShotAlign = 'left' | 'right' | 'center';
	type ShotFrame = 'portrait' | 'landscape' | 'wide';
	type Slide = {
		id: string;
		kind: SlideKind;
		title: string;
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
			align?: ShotAlign;
			frame?: ShotFrame;
		};
	};

	type RegisterFormValues = {
		displayName: string;
		realName: string;
		birthday: string;
		email: string;
		confirmEmail: string;
		userPhone: string;
		userAddressLine1: string;
		userAddressLine2: string;
		userCity: string;
		userState: string;
		userPostalCode: string;
		emergencyContactName: string;
		emergencyContactPhone: string;
		emergencyContactRelationship: string;
		emailUpdates: boolean;
		businessName: string;
		planTier: string;
		addOnTempMonitoring: boolean;
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
		purchaseMode: 'trial' | 'buy_now';
		storeBillingPreference: 'both' | 'google_play' | 'app_store';
		liabilityAgreementAccepted: boolean;
	};

	const US_STATES = [
		['', 'Select state'],
		['AL', 'Alabama'],
		['AK', 'Alaska'],
		['AZ', 'Arizona'],
		['AR', 'Arkansas'],
		['CA', 'California'],
		['CO', 'Colorado'],
		['CT', 'Connecticut'],
		['DE', 'Delaware'],
		['FL', 'Florida'],
		['GA', 'Georgia'],
		['HI', 'Hawaii'],
		['ID', 'Idaho'],
		['IL', 'Illinois'],
		['IN', 'Indiana'],
		['IA', 'Iowa'],
		['KS', 'Kansas'],
		['KY', 'Kentucky'],
		['LA', 'Louisiana'],
		['ME', 'Maine'],
		['MD', 'Maryland'],
		['MA', 'Massachusetts'],
		['MI', 'Michigan'],
		['MN', 'Minnesota'],
		['MS', 'Mississippi'],
		['MO', 'Missouri'],
		['MT', 'Montana'],
		['NE', 'Nebraska'],
		['NV', 'Nevada'],
		['NH', 'New Hampshire'],
		['NJ', 'New Jersey'],
		['NM', 'New Mexico'],
		['NY', 'New York'],
		['NC', 'North Carolina'],
		['ND', 'North Dakota'],
		['OH', 'Ohio'],
		['OK', 'Oklahoma'],
		['OR', 'Oregon'],
		['PA', 'Pennsylvania'],
		['RI', 'Rhode Island'],
		['SC', 'South Carolina'],
		['SD', 'South Dakota'],
		['TN', 'Tennessee'],
		['TX', 'Texas'],
		['UT', 'Utah'],
		['VT', 'Vermont'],
		['VA', 'Virginia'],
		['WA', 'Washington'],
		['WV', 'West Virginia'],
		['WI', 'Wisconsin'],
		['WY', 'Wyoming'],
		['DC', 'District of Columbia']
	];

	const COUNTRIES = [
		['United States', 'United States'],
		['Canada', 'Canada'],
		['Mexico', 'Mexico']
	];

	const slides: Slide[] = [
		{
			id: 'intro',
			kind: 'info',
			title: 'Service-built operating platform',
			description: 'Built for teams that run high-tempo shifts.',
			bullets: ['Operational clarity', 'Fast communication', 'Consistent execution'],
			background: {
				kind: 'video',
				src: '/marketing/20240730_154643.mp4',
				alt: 'Kitchen team preparing and plating during service'
			},
			shot: {
				src: '/marketing/app/employee-homepage.png',
				alt: 'App homepage overview',
				fit: 'contain',
				align: 'right',
				frame: 'portrait'
			}
		},
		{
			id: 'flow',
			kind: 'info',
			title: 'One flow across the full shift',
			description: 'Plan, execute, and close from one workspace.',
			bullets: ['Schedule', 'Tasking', 'Prep and docs'],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_4126678697134084261.jpg',
				position: 'center center',
				alt: 'Kitchen production'
			},
			shot: {
				src: '/marketing/app/scheduling-builder.png',
				alt: 'Scheduling builder screen',
				fit: 'contain',
				align: 'center',
				frame: 'wide'
			}
		},
		{
			id: 'features',
			kind: 'info',
			title: 'Depth where operations need it',
			description: 'Use only what your team needs.',
			bullets: ['Schedules', 'ToDo and Whiteboard', 'Lists and Recipes'],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_3952972665318110830.jpg',
				position: 'center center',
				alt: 'Service pass'
			},
			shot: {
				src: '/marketing/app/admin-dashboard.png',
				alt: 'Manager dashboard preview',
				fit: 'contain',
				align: 'left',
				frame: 'landscape'
			}
		},
		{
			id: 'roles',
			kind: 'info',
			title: 'Role-based launch paths',
			description: 'Managers and staff enter separate first-open tours.',
			bullets: ['Manager control path', 'Team execution path', 'Guided first actions'],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_2922002948285858149.jpg',
				position: 'center center',
				alt: 'Plated dishes'
			},
			shot: {
				src: '/marketing/app/recipe-categories.png',
				alt: 'Manager panel',
				fit: 'contain',
				align: 'right',
				frame: 'landscape'
			}
		},
		{
			id: 'tier',
			kind: 'input',
			title: 'Choose plan size',
			description: '',
			bullets: [],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_3336762680387538905.jpg',
				position: 'center center',
				alt: 'Kitchen output'
			}
		},
		{
			id: 'business',
			kind: 'input',
			title: 'Business profile',
			description: '',
			bullets: [],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_2544492397669735085.jpg',
				position: 'center center',
				alt: 'Dish assembly'
			}
		},
		{
			id: 'security',
			kind: 'input',
			title: 'User profile and security',
			description: '',
			bullets: [],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_5753045492765058409.jpg',
				position: 'center center',
				alt: 'Production spread'
			},
			shot: {
				src: '/marketing/app/employee-homepage.png',
				alt: 'Employee homepage',
				fit: 'contain',
				align: 'center',
				frame: 'portrait'
			}
		},
		{
			id: 'purchase',
			kind: 'input',
			title: 'Purchase and agreement',
			description: '',
			bullets: [],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_4126678697134084261.jpg',
				position: 'center center',
				alt: 'Kitchen service line'
			}
		}
	];

	const formValues = form?.values ?? {};
	const requestedActiveSlideId = form?.activeSlideId ?? (form?.error ? 'purchase' : 'intro');
	let activeIndex = Math.max(0, slides.findIndex((slide) => slide.id === requestedActiveSlideId));
	let appliedFormSlide = false;
	let touchStartX = 0;
	let touchStartY = 0;

	let planTier = formValues.planTier ?? 'small';
	let displayName = formValues.displayName ?? '';
	let realName = formValues.realName ?? '';
	let birthday = formValues.birthday ?? '';
	let email = formValues.email ?? '';
	let confirmEmail = formValues.confirmEmail ?? '';
	let businessName = formValues.businessName ?? '';
	let legalName = formValues.legalName ?? '';
	let registryId = formValues.registryId ?? '';
	let contactEmail = formValues.contactEmail ?? '';
	let contactPhone = formValues.contactPhone ?? '';
	let websiteUrl = formValues.websiteUrl ?? '';
	let addressLine1 = formValues.addressLine1 ?? '';
	let addressLine2 = formValues.addressLine2 ?? '';
	let addressCity = formValues.addressCity ?? '';
	let addressState = formValues.addressState ?? '';
	let addressPostalCode = formValues.addressPostalCode ?? '';
	let addressCountry = formValues.addressCountry ?? 'United States';

	let userPhone = formValues.userPhone ?? '';
	let userAddressLine1 = formValues.userAddressLine1 ?? '';
	let userAddressLine2 = formValues.userAddressLine2 ?? '';
	let userCity = formValues.userCity ?? '';
	let userState = formValues.userState ?? '';
	let userPostalCode = formValues.userPostalCode ?? '';
	let emergencyContactName = formValues.emergencyContactName ?? '';
	let emergencyContactPhone = formValues.emergencyContactPhone ?? '';
	let emergencyContactRelationship = formValues.emergencyContactRelationship ?? '';
	let password = '';
	let confirmPassword = '';
	let emailUpdates = formValues.emailUpdates ?? true;
	let clientFingerprint = '';
	let purchaseMode: 'trial' | 'buy_now' = formValues.purchaseMode ?? 'trial';
	let storeBillingPreference: 'both' | 'google_play' | 'app_store' = formValues.storeBillingPreference ?? 'both';
	let liabilityAgreementAccepted = formValues.liabilityAgreementAccepted ?? false;
	$: basePlanPrice = planTier === 'large' ? 90 : planTier === 'medium' ? 65 : 30;
	$: tempMonitoringIncluded = planTier === 'medium' || planTier === 'large';
	$: estimatedMonthlyTotal = basePlanPrice;

	let showPassword = false;
	let showConfirmPassword = false;
	let passwordFeedback = '';

	$: inviteMode = Boolean(data.inviteCode);
	$: visibleSlides = inviteMode
		? slides.filter((slide) => slide.id !== 'tier' && slide.id !== 'business')
		: slides;
	$: if (!appliedFormSlide && form?.activeSlideId && visibleSlides.some((slide) => slide.id === form.activeSlideId)) {
		activeIndex = visibleSlides.findIndex((slide) => slide.id === form.activeSlideId);
		appliedFormSlide = true;
	}
	$: activeSlide = visibleSlides[activeIndex] ?? visibleSlides[0];
	$: activeIndex = Math.min(activeIndex, visibleSlides.length - 1);

	onMount(() => {
		try {
			const storageKey = 'sknns_trial_fingerprint_v1';
			const existing = window.localStorage.getItem(storageKey);
			if (existing && existing.trim()) {
				clientFingerprint = existing.trim().slice(0, 200);
				return;
			}
			const created =
				typeof crypto !== 'undefined' && 'randomUUID' in crypto
					? crypto.randomUUID()
					: `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
			clientFingerprint = created;
			window.localStorage.setItem(storageKey, created);
		} catch {
			clientFingerprint = '';
		}
	});

	function nextSlide() {
		if (activeSlide.id === 'security' && !validatePasswordBeforeAccountStep()) return;
		activeIndex = Math.min(activeIndex + 1, visibleSlides.length - 1);
	}

	function previousSlide() {
		passwordFeedback = '';
		activeIndex = Math.max(activeIndex - 1, 0);
	}

	function clearPasswordInputs(message: string) {
		password = '';
		confirmPassword = '';
		showPassword = false;
		showConfirmPassword = false;
		passwordFeedback = message;
	}

	function validatePasswordBeforeAccountStep() {
		passwordFeedback = '';
		if (!password || !confirmPassword) {
			clearPasswordInputs('Enter and confirm the password.');
			return false;
		}
		if (password.length < 10) {
			clearPasswordInputs('Password must be at least 10 characters.');
			return false;
		}
		if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
			clearPasswordInputs('Password must include letters and numbers.');
			return false;
		}
		if (password !== confirmPassword) {
			clearPasswordInputs('Passwords do not match.');
			return false;
		}
		return true;
	}

	function handleRegisterSubmit(event: SubmitEvent) {
		if (validatePasswordBeforeAccountStep()) return;
		event.preventDefault();
		const securityIndex = visibleSlides.findIndex((slide) => slide.id === 'security');
		activeIndex = securityIndex >= 0 ? securityIndex : activeIndex;
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

<section class="tour-shell" id="onboarding-slideshow" aria-label="Signup onboarding slideshow">
	<a class="tour-home-link" href="/" aria-label="Return to homepage">
		<span aria-hidden="true">&lt;</span>
		Home
	</a>

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

	{#key activeSlide.id}
		<main
			class="tour-main"
			class:shot-left={activeSlide.shot?.align === 'left'}
			class:shot-center={activeSlide.shot?.align === 'center'}
			class:shot-right={!activeSlide.shot || activeSlide.shot.align === 'right'}
			in:fade={{ duration: 220 }}
			out:fade={{ duration: 160 }}
		>
			<div class="tour-copy" in:fly={{ y: 18, duration: 260 }}>
				{#if activeSlide.kind === 'info'}
					<h1>{activeSlide.title}</h1>
					<p class="tour-description">{activeSlide.description}</p>
				{/if}

				{#if activeSlide.bullets.length > 0}
					<ul class="tour-bullets">
						{#each activeSlide.bullets as bullet}
							<li>{bullet}</li>
						{/each}
					</ul>
				{/if}

				{#if !inviteMode && activeSlide.id === 'intro'}
					<form method="GET" action="/register" class="invite-code-entry">
						<label for="invite-code-entry">Invite code</label>
						<div>
							<input id="invite-code-entry" name="invite" autocomplete="one-time-code" />
							<button type="submit">Continue</button>
						</div>
					</form>
				{/if}

				{#if activeSlide.id === 'tier'}
					<div class="form-zone inline-signup">
						<div class="tier-showcase">
							<h2>Choose Plan Size</h2>
							<div class="tier-grid" role="radiogroup" aria-label="Plan size">
								<button
									type="button"
									class="tier-card"
									class:active={planTier === 'small'}
									on:click={() => (planTier = 'small')}
									aria-pressed={planTier === 'small'}
								>
									<strong>Small</strong>
									<p class="tier-price">$30/mo</p>
									<ul class="tier-features">
										<li>Up to 20 employees</li>
										<li>Core scheduling, todo, lists</li>
										<li>Temperature monitoring starts at Medium</li>
									</ul>
									{#if planTier === 'small'}
										<p class="tier-status">Selected plan</p>
									{/if}
								</button>
								<button
									type="button"
									class="tier-card"
									class:active={planTier === 'medium'}
									on:click={() => (planTier = 'medium')}
									aria-pressed={planTier === 'medium'}
								>
									<strong>Medium</strong>
									<p class="tier-price">$65/mo</p>
									<ul class="tier-features">
										<li>Up to 75 users</li>
										<li>Advanced admin + editor controls</li>
										<li>Temperature monitoring included</li>
									</ul>
									{#if planTier === 'medium'}
										<p class="tier-status">Selected plan</p>
									{/if}
								</button>
								<button
									type="button"
									class="tier-card"
									class:active={planTier === 'large'}
									on:click={() => (planTier = 'large')}
									aria-pressed={planTier === 'large'}
								>
									<strong>Large</strong>
									<p class="tier-price">$90/mo</p>
									<ul class="tier-features">
										<li>Up to 250 employees</li>
										<li>Full platform + multi-team scale</li>
										<li>Temperature monitoring included</li>
									</ul>
									{#if planTier === 'large'}
										<p class="tier-status">Selected plan</p>
									{/if}
								</button>
							</div>

						</div>
					</div>
				{/if}

				{#if activeSlide.id === 'business'}
					<div class="form-zone inline-signup">
						{#if !inviteMode}
							<label for="register-business-name">Business name</label>
							<input id="register-business-name" bind:value={businessName} placeholder="Northside Kitchen" required />

							<label for="legal-name">Legal business name</label>
							<input id="legal-name" bind:value={legalName} placeholder="Northside Kitchen LLC" />

							<label for="registry-id">Registry ID</label>
							<input id="registry-id" bind:value={registryId} placeholder="State filing number" />

							<label for="contact-email">Business contact email</label>
							<input id="contact-email" type="email" bind:value={contactEmail} placeholder="ops@northsidekitchen.com" />

							<label for="contact-phone">Business contact phone</label>
							<input id="contact-phone" bind:value={contactPhone} placeholder="(555) 555-0143" />

							<label for="website-url">Business website</label>
							<input id="website-url" bind:value={websiteUrl} placeholder="northsidekitchen.com" />

							<label for="address-line-1">Business address line 1</label>
							<input id="address-line-1" bind:value={addressLine1} placeholder="123 Main Street" />

							<label for="address-line-2">Business address line 2</label>
							<input id="address-line-2" bind:value={addressLine2} placeholder="Suite / Unit" />

							<label for="address-city">Business city</label>
							<input id="address-city" bind:value={addressCity} />

							<label for="address-state">Business state / region</label>
							<select id="address-state" bind:value={addressState}>
								{#each US_STATES as [value, label]}
									<option value={value}>{label}</option>
								{/each}
							</select>

							<label for="address-postal-code">Business postal code</label>
							<input id="address-postal-code" bind:value={addressPostalCode} />

							<label for="address-country">Business country</label>
							<select id="address-country" bind:value={addressCountry}>
								{#each COUNTRIES as [value, label]}
									<option value={value}>{label}</option>
								{/each}
							</select>
						{/if}
					</div>
				{/if}

				{#if activeSlide.id === 'security'}
					<div class="form-zone inline-signup">
						<label for="register-display-name">Display name</label>
						<input id="register-display-name" bind:value={displayName} placeholder="Alex Rivera" required />

						<label for="real-name">Legal name</label>
						<input id="real-name" bind:value={realName} placeholder="Alex Jordan Rivera" />

						<label for="birthday">Birthday</label>
						<input id="birthday" type="date" bind:value={birthday} />

						<label for="register-email">Email</label>
						<input id="register-email" type="email" bind:value={email} required />

						<label for="register-confirm-email">Confirm email</label>
						<input id="register-confirm-email" type="email" bind:value={confirmEmail} required />

						<label for="user-phone">Phone</label>
						<input id="user-phone" bind:value={userPhone} placeholder="(555) 555-5555" />

						<label for="user-address-line-1">Address line 1</label>
						<input id="user-address-line-1" bind:value={userAddressLine1} placeholder="123 Main Street" />

						<label for="user-address-line-2">Address line 2</label>
						<input id="user-address-line-2" bind:value={userAddressLine2} placeholder="Suite / Unit" />

						<label for="user-city">City</label>
						<input id="user-city" bind:value={userCity} />

						<label for="user-state">State / Region</label>
						<input id="user-state" bind:value={userState} />

						<label for="user-postal-code">Postal code</label>
						<input id="user-postal-code" bind:value={userPostalCode} />

						<label for="emergency-contact-name">Emergency contact</label>
						<input id="emergency-contact-name" bind:value={emergencyContactName} />

						<label for="emergency-contact-phone">Emergency phone</label>
						<input id="emergency-contact-phone" bind:value={emergencyContactPhone} />

						<label for="emergency-contact-relationship">Relationship</label>
						<input id="emergency-contact-relationship" bind:value={emergencyContactRelationship} />

						<label for="register-password">Password</label>
						<div class="password-row">
							<input id="register-password" type={showPassword ? 'text' : 'password'} bind:value={password} required />
							<button type="button" class="plain-toggle" on:click={() => (showPassword = !showPassword)}>
								{showPassword ? 'Hide' : 'Show'}
							</button>
						</div>

						<label for="register-confirm-password">Confirm password</label>
						<div class="password-row">
							<input
								id="register-confirm-password"
								type={showConfirmPassword ? 'text' : 'password'}
								bind:value={confirmPassword}
								required
							/>
							<button type="button" class="plain-toggle" on:click={() => (showConfirmPassword = !showConfirmPassword)}>
								{showConfirmPassword ? 'Hide' : 'Show'}
							</button>
						</div>

						<label class="inline-toggle" for="register-email-updates">
							<input id="register-email-updates" type="checkbox" bind:checked={emailUpdates} value="1" />
							<span>Email updates</span>
						</label>

						{#if passwordFeedback}
							<p class="tour-feedback error password-feedback">{passwordFeedback}</p>
						{/if}

						<button type="button" class="primary inline-continue" on:click={nextSlide}>Continue</button>
					</div>
				{/if}

				{#if activeSlide.id === 'purchase'}
					<form class="form-zone inline-signup" method="POST" on:submit={handleRegisterSubmit}>
						{#if form?.error}
							<p class="tour-feedback error form-feedback">{form.error}</p>
						{/if}
						<input type="hidden" name="display_name" value={displayName} />
						<input type="hidden" name="real_name" value={realName} />
						<input type="hidden" name="birthday" value={birthday} />
						<input type="hidden" name="email" value={email} />
						<input type="hidden" name="confirm_email" value={confirmEmail} />
						<input type="hidden" name="user_phone" value={userPhone} />
						<input type="hidden" name="user_address_line_1" value={userAddressLine1} />
						<input type="hidden" name="user_address_line_2" value={userAddressLine2} />
						<input type="hidden" name="user_city" value={userCity} />
						<input type="hidden" name="user_state" value={userState} />
						<input type="hidden" name="user_postal_code" value={userPostalCode} />
						<input type="hidden" name="emergency_contact_name" value={emergencyContactName} />
						<input type="hidden" name="emergency_contact_phone" value={emergencyContactPhone} />
						<input
							type="hidden"
							name="emergency_contact_relationship"
							value={emergencyContactRelationship}
						/>
						<input type="hidden" name="password" value={password} />
						<input type="hidden" name="confirm_password" value={confirmPassword} />
						<input type="hidden" name="email_updates" value={emailUpdates ? '1' : '0'} />
						<input type="hidden" name="business_name" value={businessName} />
						<input type="hidden" name="plan_tier" value={planTier} />
						<input type="hidden" name="addon_temp_monitoring" value={tempMonitoringIncluded ? '1' : '0'} />
						<input type="hidden" name="addon_camera_monitoring" value="0" />
						<input type="hidden" name="legal_name" value={legalName} />
						<input type="hidden" name="registry_id" value={registryId} />
						<input type="hidden" name="contact_email" value={contactEmail} />
						<input type="hidden" name="contact_phone" value={contactPhone} />
						<input type="hidden" name="website_url" value={websiteUrl} />
						<input type="hidden" name="address_line_1" value={addressLine1} />
						<input type="hidden" name="address_line_2" value={addressLine2} />
						<input type="hidden" name="address_city" value={addressCity} />
						<input type="hidden" name="address_state" value={addressState} />
						<input type="hidden" name="address_postal_code" value={addressPostalCode} />
						<input type="hidden" name="address_country" value={addressCountry} />
						<input type="hidden" name="client_fingerprint" value={clientFingerprint} />
						<input type="hidden" name="purchase_mode" value={purchaseMode} />
						<input type="hidden" name="store_billing_preference" value={storeBillingPreference} />
						<input type="hidden" name="liability_agreement_version" value={data.agreementVersion} />
						{#if inviteMode}
							<input type="hidden" name="invite_code" value={data.inviteCode} />
						{/if}

						{#if !inviteMode}
							<div class="payment-placeholder">
								<h2>Payment Setup</h2>
								<p>Billing is completed through mobile app stores after account creation.</p>
								<p>Estimated monthly total: ${estimatedMonthlyTotal}</p>
							</div>

							<div class="purchase-mode-grid">
								<button
									type="button"
									class="purchase-mode-card"
									class:active={purchaseMode === 'trial'}
									aria-pressed={purchaseMode === 'trial'}
									on:click={() => (purchaseMode = 'trial')}
								>
									<strong>Start free trial</strong>
									<span>One month trial, upgrade any time.</span>
								</button>
								<button
									type="button"
									class="purchase-mode-card"
									class:active={purchaseMode === 'buy_now'}
									aria-pressed={purchaseMode === 'buy_now'}
									on:click={() => (purchaseMode = 'buy_now')}
								>
									<strong>Purchase now</strong>
									<span>Continue with app-store billing activation after account creation.</span>
								</button>
							</div>

							<div class="store-pref-grid" role="radiogroup" aria-label="Store billing preference">
								<button
									type="button"
									class="store-pref-card"
									class:active={storeBillingPreference === 'both'}
									aria-pressed={storeBillingPreference === 'both'}
									on:click={() => (storeBillingPreference = 'both')}
								>
									<div class="store-pref-badges">
										<img
											class="store-pref-badge"
											src="/store-badges/google-play-badge.svg"
											alt="Get it on Google Play"
											loading="lazy"
										/>
										<img
											class="store-pref-badge"
											src="/store-badges/app-store-badge.svg"
											alt="Download on the App Store"
											loading="lazy"
										/>
									</div>
									<strong>Both Stores</strong>
								</button>
								<button
									type="button"
									class="store-pref-card"
									class:active={storeBillingPreference === 'google_play'}
									aria-pressed={storeBillingPreference === 'google_play'}
									on:click={() => (storeBillingPreference = 'google_play')}
								>
									<img
										class="store-pref-badge"
										src="/store-badges/google-play-badge.svg"
										alt="Get it on Google Play"
										loading="lazy"
									/>
									<strong>Google Play</strong>
								</button>
								<button
									type="button"
									class="store-pref-card"
									class:active={storeBillingPreference === 'app_store'}
									aria-pressed={storeBillingPreference === 'app_store'}
									on:click={() => (storeBillingPreference = 'app_store')}
								>
									<img
										class="store-pref-badge"
										src="/store-badges/app-store-badge.svg"
										alt="Download on the App Store"
										loading="lazy"
									/>
									<strong>App Store</strong>
								</button>
							</div>
						{/if}

						{#if !inviteMode}
							<label class="inline-toggle agreement-toggle" for="liability-agreement-accepted">
								<input
									id="liability-agreement-accepted"
									name="liability_agreement_accepted"
									type="checkbox"
									bind:checked={liabilityAgreementAccepted}
									value="1"
									required
								/>
								<span>I agree to the Crimini by NNS, LLC liability release agreement.</span>
							</label>
						{/if}

						<button type="submit" class="primary submit-btn">Create account</button>
						<p class="auth-note">
							Already have an account?
							<a href="/login">Login</a>
						</p>
					</form>
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

	{#if activeSlide.id !== 'purchase' && activeSlide.id !== 'security'}
		<div class="bottom-continue">
			<button type="button" class="primary inline-continue" on:click={nextSlide}>Continue</button>
		</div>
	{/if}

	<nav class="side-nav" aria-label="Slideshow navigation">
		<button type="button" class="side-arrow side-arrow-left" on:click={previousSlide} disabled={activeIndex === 0}>
			<span aria-hidden="true">&lt;</span>
			<span class="sr-only">Back</span>
		</button>
		{#if activeSlide.id !== 'purchase'}
			<button type="button" class="side-arrow side-arrow-right" on:click={nextSlide}>
				<span aria-hidden="true">&gt;</span>
				<span class="sr-only">Next</span>
			</button>
		{/if}
	</nav>
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
			linear-gradient(105deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.46) 34%, rgba(255, 255, 255, 0.2) 64%, rgba(255, 255, 255, 0.58) 100%),
			radial-gradient(circle at 78% 44%, rgba(143, 130, 110, 0.13), transparent 44%);
	}

	.tour-main {
		position: relative;
		z-index: 2;
	}

	.tour-home-link {
		position: fixed;
		top: max(0.9rem, calc(var(--safe-top) + 0.72rem));
		left: max(0.9rem, calc(var(--safe-left) + 0.9rem));
		z-index: 5;
		display: inline-flex;
		align-items: center;
		gap: 0.42rem;
		text-decoration: none;
		border: 1px solid rgba(17, 18, 20, 0.16);
		background: rgba(255, 255, 255, 0.86);
		color: #111214;
		padding: 0.48rem 0.68rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		backdrop-filter: blur(8px);
		box-shadow: none;
	}

	.tour-home-link:hover {
		border-color: rgba(17, 18, 20, 0.42);
		background: #ffffff;
	}

	.tour-main {
		display: grid;
		grid-template-columns: minmax(0, 1.02fr) minmax(0, 1fr);
		gap: clamp(1rem, 3vw, 2.5rem);
		align-items: center;
		padding: max(1rem, var(--safe-top)) clamp(1rem, 3vw, 2.2rem) 0;
		min-height: 100dvh;
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
		grid-template-columns: minmax(0, 1fr);
		align-content: center;
	}

	.tour-main.shot-center .tour-copy {
		justify-self: center;
		width: min(100%, 52rem);
	}

	.tour-main.shot-center .tour-shot {
		justify-self: center;
	}

	.tour-copy {
		display: grid;
		gap: 0.62rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.5rem, 4.6vw, 3.1rem);
		line-height: 1.06;
		max-width: 18ch;
	}

	.tour-description {
		margin: 0;
		font-size: clamp(0.92rem, 1.15vw, 1.05rem);
		line-height: 1.48;
		max-width: 56ch;
		color: rgba(17, 18, 20, 0.68);
	}

	.tour-bullets {
		margin: 0.1rem 0 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.28rem;
	}

	.tour-bullets li {
		font-size: 0.88rem;
		line-height: 1.35;
		color: rgba(17, 18, 20, 0.68);
	}

	.invite-code-entry {
		display: grid;
		gap: 0.3rem;
		width: min(100%, 22rem);
		margin-top: 0.35rem;
	}

	.invite-code-entry label {
		color: rgba(17, 18, 20, 0.58);
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.invite-code-entry div {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.5rem;
	}

	.invite-code-entry input {
		width: 100%;
		min-height: 2.5rem;
		border: 1px solid rgba(17, 18, 20, 0.16);
		border-radius: 0;
		padding: 0.58rem 0.68rem;
		background: rgba(255, 255, 255, 0.84);
		color: #111214;
		font: inherit;
	}

	.invite-code-entry button {
		min-height: 2.5rem;
		border: 1px solid #111214;
		border-radius: 0;
		padding: 0.58rem 0.82rem;
		background: #111214;
		color: #ffffff;
		cursor: pointer;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 700;
	}

	.tour-feedback {
		margin: 0;
		font-size: 0.84rem;
		font-weight: 600;
	}

	.tour-feedback.error {
		color: #8e4036;
	}

	.password-feedback,
	.form-feedback {
		grid-column: span 2;
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
		transform: translateY(0);
		transition: transform 220ms ease;
	}

	.tour-shot::before {
		content: none;
	}

	.tour-shot:hover {
		transform: translateY(-2px);
	}

	.tour-shot.portrait {
		width: min(28vw, 19rem);
		aspect-ratio: 10 / 16;
	}

	.tour-shot.landscape {
		width: min(48vw, 42rem);
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

	.form-zone {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.58rem 0.8rem;
		align-items: end;
	}

	.inline-signup {
		margin-top: 0.45rem;
		width: min(100%, 42rem);
	}

	.form-zone label {
		grid-column: span 2;
		font-size: 0.76rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(17, 18, 20, 0.58);
	}

	.form-zone input,
	.form-zone select {
		grid-column: span 2;
		width: 100%;
		padding: 0.66rem 0.74rem;
		border-radius: 0;
		border: 1px solid rgba(17, 18, 20, 0.16);
		background: rgba(255, 255, 255, 0.9);
		color: #111214;
		font: inherit;
	}

	.form-zone input:focus,
	.form-zone select:focus {
		outline: none;
		border-color: rgba(17, 18, 20, 0.52);
	}

	.password-row {
		grid-column: span 2;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.5rem;
		align-items: center;
	}

	.password-row input {
		grid-column: auto;
	}

	.plain-toggle {
		padding: 0.6rem 0.75rem;
		border-radius: 0;
		border: 1px solid rgba(17, 18, 20, 0.18);
		background: rgba(255, 255, 255, 0.9);
		color: #111214;
		font-weight: 600;
	}

	.inline-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		text-transform: none;
		letter-spacing: 0;
	}

	.agreement-toggle {
		grid-column: span 2;
		margin-top: 0.2rem;
		font-size: 0.82rem;
		line-height: 1.4;
		color: rgba(17, 18, 20, 0.68);
	}

	.inline-toggle input {
		grid-column: auto;
		width: auto;
		padding: 0;
	}

	.purchase-mode-grid {
		grid-column: span 2;
		display: grid;
		gap: 0.7rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin-top: 0.2rem;
	}

	.store-pref-grid {
		grid-column: span 2;
		display: grid;
		gap: 0.55rem;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.store-pref-card {
		padding: 0.78rem 0.72rem;
		border-radius: 0;
		border: 1px solid rgba(17, 18, 20, 0.16);
		background: rgba(255, 255, 255, 0.88);
		color: #111214;
		text-align: center;
		display: grid;
		gap: 0.45rem;
		justify-items: center;
		transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease;
	}

	.store-pref-card strong {
		font-size: 0.82rem;
		line-height: 1.2;
	}

	.store-pref-badges {
		display: grid;
		gap: 0.35rem;
		width: min(100%, 10.8rem);
	}

	.store-pref-badge {
		width: 100%;
		height: auto;
		border-radius: 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.16);
		background: rgba(10, 12, 15, 0.62);
	}

	.store-pref-card:hover {
		transform: translateY(-1px);
		box-shadow: none;
	}

	.store-pref-card.active {
		border-color: #111214;
		background: #f8f4ec;
		box-shadow: none;
		transform: translateY(-1px);
	}

	.purchase-mode-card {
		padding: 0.95rem 0.9rem;
		border-radius: 0;
		border: 1px solid rgba(17, 18, 20, 0.16);
		background: rgba(255, 255, 255, 0.88);
		color: #111214;
		text-align: left;
		display: grid;
		gap: 0.3rem;
		transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease;
	}

	.purchase-mode-card strong {
		font-size: 0.95rem;
		line-height: 1.2;
	}

	.purchase-mode-card span {
		font-size: 0.8rem;
		color: rgba(17, 18, 20, 0.68);
	}

	.purchase-mode-card:hover {
		transform: translateY(-1px);
		box-shadow: none;
	}

	.purchase-mode-card.active {
		border-color: #111214;
		background: #f8f4ec;
		box-shadow: none;
		transform: translateY(-1px);
	}

	.submit-btn {
		grid-column: span 2;
		justify-self: start;
	}

	.bottom-continue {
		position: fixed;
		left: 50%;
		bottom: max(1rem, calc(var(--safe-bottom) + 1rem));
		z-index: 4;
		transform: translateX(-50%);
		display: flex;
		justify-content: center;
		pointer-events: none;
	}

	.bottom-continue button {
		pointer-events: auto;
		box-shadow: 0 14px 34px rgba(17, 18, 20, 0.12);
	}

	.auth-note {
		grid-column: span 2;
		margin: 0;
		font-size: 0.82rem;
		color: rgba(17, 18, 20, 0.68);
	}

	.auth-note a {
		color: #111214;
	}

	.tier-showcase {
		grid-column: span 2;
		display: grid;
		gap: 1rem;
		width: min(100%, 56rem);
	}

	.tier-showcase h2 {
		margin: 0;
		font-size: clamp(1.2rem, 2.2vw, 1.8rem);
		line-height: 1.1;
	}

	.tier-grid {
		display: grid;
		gap: 0.9rem;
		grid-template-columns: 1fr;
	}

	.tier-card {
		padding: 1.2rem 1.1rem;
		min-height: 8.6rem;
		border-radius: 0;
		border: 1px solid rgba(17, 18, 20, 0.16);
		background: rgba(255, 255, 255, 0.88);
		color: #111214;
		text-align: left;
		display: grid;
		gap: 0.36rem;
		align-content: start;
		transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease;
	}

	.tier-card:hover {
		transform: translateY(-1px);
		box-shadow: none;
	}

	.tier-card strong {
		font-size: 1.34rem;
		line-height: 1.1;
	}

	.tier-price {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: #111214;
	}

	.tier-features {
		margin: 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.2rem;
	}

	.tier-features li {
		font-size: 0.84rem;
		color: rgba(17, 18, 20, 0.68);
	}

	.tier-card.active {
		border-color: #111214;
		background: #f8f4ec;
		box-shadow: none;
		transform: translateY(-1px);
	}

	.tier-status {
		margin: 0.2rem 0 0;
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgba(17, 18, 20, 0.66);
	}

	.tier-card.active .tier-status {
		color: rgba(17, 18, 20, 0.8);
	}

	.side-nav {
		position: absolute;
		inset: 0;
		z-index: 3;
		pointer-events: none;
	}

	.side-arrow {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 2.6rem;
		height: 2.6rem;
		display: grid;
		place-items: center;
		pointer-events: auto;
		border-radius: 0;
		border: 1px solid rgba(17, 18, 20, 0.18);
		background: rgba(255, 255, 255, 0.9);
		color: #111214;
		font-weight: 600;
		font-size: 1.1rem;
		backdrop-filter: blur(4px);
	}

	.side-arrow-left {
		left: clamp(0.5rem, 1.8vw, 1.2rem);
	}

	.side-arrow-right {
		right: clamp(0.5rem, 1.8vw, 1.2rem);
	}

	.side-arrow:hover {
		background: #f8f4ec;
		border-color: rgba(17, 18, 20, 0.42);
	}

	.side-arrow:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	button.primary {
		background: #111214;
	}

	button.primary {
		padding: 0.56rem 0.88rem;
		border-radius: 0;
		border: 1px solid #111214;
		color: #ffffff;
		font-weight: 700;
	}

	.tour-shell {
		background: #ffffff;
		color: #111214;
	}

	.tour-bg {
		background: #ffffff;
	}

	.tour-bg img,
	.tour-bg video {
		filter: grayscale(0.06) saturate(0.72) contrast(1.06) brightness(1.08);
		opacity: 1;
	}

	.tour-shade {
		background:
			linear-gradient(105deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.46) 34%, rgba(255, 255, 255, 0.2) 64%, rgba(255, 255, 255, 0.58) 100%),
			radial-gradient(circle at 78% 44%, rgba(143, 130, 110, 0.13), transparent 44%);
	}

	.tour-copy h1,
	.tier-showcase h2,
	.payment-placeholder h2 {
		font-family: Georgia, 'Times New Roman', serif;
		font-weight: 400;
		letter-spacing: -0.045em;
		color: #111214;
	}

	.tour-description,
	.tour-bullets li,
	.agreement-toggle,
	.auth-note,
	.purchase-mode-card span,
	.tier-features li {
		color: rgba(17, 18, 20, 0.68);
	}

	.tour-feedback.error {
		color: #9f1f2b;
	}

	.tier-card,
	.purchase-mode-card,
	.store-pref-card,
	.payment-placeholder {
		border-radius: 0;
		border: 1px solid rgba(17, 18, 20, 0.16);
		background: rgba(255, 255, 255, 0.88);
		color: #111214;
		box-shadow: 0 18px 44px rgba(17, 18, 20, 0.08);
		backdrop-filter: blur(8px);
	}

	.tier-card:hover,
	.purchase-mode-card:hover,
	.store-pref-card:hover {
		box-shadow: 0 22px 46px rgba(17, 18, 20, 0.1);
	}

	.tour-shot img,
	.tour-shot img.contain {
		background: transparent;
	}

	.form-zone label {
		color: rgba(17, 18, 20, 0.58);
	}

	.form-zone input,
	.form-zone select {
		border-radius: 0;
		border: 1px solid rgba(17, 18, 20, 0.16);
		background: rgba(255, 255, 255, 0.9);
		color: #111214;
	}

	.form-zone input:focus,
	.form-zone select:focus {
		border-color: rgba(17, 18, 20, 0.52);
		box-shadow: 0 0 0 3px rgba(17, 18, 20, 0.08);
	}

	.plain-toggle,
	.side-arrow {
		border-radius: 0;
		border: 1px solid rgba(17, 18, 20, 0.18);
		background: rgba(255, 255, 255, 0.9);
		color: #111214;
	}

	.side-arrow:hover {
		background: #f8f4ec;
		border-color: rgba(17, 18, 20, 0.42);
	}

	button.primary {
		border-radius: 0;
		border-color: #111214;
		background: #111214;
		color: #ffffff;
	}

	.tier-card strong,
	.purchase-mode-card strong,
	.store-pref-card strong,
	.tier-price {
		color: #111214;
	}

	.tier-card.active,
	.purchase-mode-card.active,
	.store-pref-card.active {
		border-color: #111214;
		background: #f8f4ec;
		box-shadow:
			0 0 0 1px #111214 inset,
			0 20px 42px rgba(17, 18, 20, 0.1);
	}

	.tier-status,
	.tier-card.active .tier-status {
		color: rgba(17, 18, 20, 0.66);
	}

	.store-pref-badge {
		border-color: rgba(17, 18, 20, 0.14);
		background: #ffffff;
	}

	.auth-note a {
		color: #111214;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
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
			min-height: 100dvh;
		}

		.tour-shot {
			width: min(100%, 36rem);
			aspect-ratio: 16 / 10;
		}

		.tour-shot.portrait {
			width: min(100%, 18rem);
			aspect-ratio: 10 / 16;
		}

		.tour-shot.wide {
			width: min(100%, 36rem);
			aspect-ratio: 16 / 9.2;
		}
	}

	@media (max-width: 720px) {
		h1 {
			font-size: clamp(1.35rem, 8.4vw, 2.18rem);
		}

		.tour-main {
			padding-bottom: 1rem;
			min-height: 100dvh;
		}

		.form-zone {
			grid-template-columns: 1fr;
		}

		.form-zone label,
		.form-zone input,
		.form-zone select,
		.password-row,
		.submit-btn,
		.auth-note,
		.password-feedback,
		.form-feedback,
		.tier-showcase,
		.purchase-mode-grid,
		.store-pref-grid,
		.agreement-toggle {
			grid-column: span 1;
		}

		.tier-grid {
			grid-template-columns: 1fr;
		}

		.purchase-mode-grid {
			grid-template-columns: 1fr;
		}

		.store-pref-grid {
			grid-template-columns: 1fr;
		}

		.password-row {
			grid-template-columns: 1fr;
		}

		.side-arrow {
			width: 2.35rem;
			height: 2.35rem;
		}

		.tour-shot,
		.tour-shot.landscape,
		.tour-shot.wide {
			width: min(100%, 28rem);
		}

		.tour-shot.portrait {
			width: min(100%, 15.5rem);
		}
	}
</style>
