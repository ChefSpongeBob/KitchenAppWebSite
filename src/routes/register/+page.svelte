<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { onMount } from 'svelte';

	export let form:
		| {
				error?: string;
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
				alt: 'Admin dashboard preview',
				fit: 'contain',
				align: 'left',
				frame: 'landscape'
			}
		},
		{
			id: 'roles',
			kind: 'info',
			title: 'Role-based launch paths',
			description: 'Admins and staff enter separate first-open tours.',
			bullets: ['Admin control path', 'Team execution path', 'Guided first actions'],
			background: {
				kind: 'image',
				src: '/marketing/FB_IMG_2922002948285858149.jpg',
				position: 'center center',
				alt: 'Plated dishes'
			},
			shot: {
				src: '/marketing/app/recipe-categories.png',
				alt: 'Admin panel',
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

	let activeIndex = 0;
	let touchStartX = 0;
	let touchStartY = 0;

	let planTier = 'small';
	let addOnTempMonitoring = false;
	let addOnCameraMonitoring = false;
	let displayName = '';
	let realName = '';
	let birthday = '';
	let email = '';
	let confirmEmail = '';
	let businessName = '';
	let legalName = '';
	let registryId = '';
	let contactEmail = '';
	let contactPhone = '';
	let websiteUrl = '';
	let addressLine1 = '';
	let addressLine2 = '';
	let addressCity = '';
	let addressState = '';
	let addressPostalCode = '';
	let addressCountry = '';

	let userPhone = '';
	let userAddressLine1 = '';
	let userAddressLine2 = '';
	let userCity = '';
	let userState = '';
	let userPostalCode = '';
	let emergencyContactName = '';
	let emergencyContactPhone = '';
	let emergencyContactRelationship = '';
	let password = '';
	let confirmPassword = '';
	let emailUpdates = true;
	let clientFingerprint = '';
	let purchaseMode: 'trial' | 'buy_now' = 'trial';
	let storeBillingPreference: 'both' | 'google_play' | 'app_store' = 'both';
	let liabilityAgreementAccepted = false;
	$: basePlanPrice = planTier === 'large' ? 275 : planTier === 'medium' ? 120 : 50;
	$: addOnTotal = (addOnTempMonitoring ? 30 : 0) + (addOnCameraMonitoring ? 30 : 0);
	$: estimatedMonthlyTotal = basePlanPrice + addOnTotal;

	let showPassword = false;
	let showConfirmPassword = false;

	$: inviteMode = Boolean(data.inviteCode);
	$: activeSlide = slides[activeIndex];

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
		activeIndex = Math.min(activeIndex + 1, slides.length - 1);
	}

	function previousSlide() {
		activeIndex = Math.max(activeIndex - 1, 0);
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

				{#if form?.error}
					<p class="tour-feedback error">{form.error}</p>
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
									<p class="tier-price">$50/mo</p>
									<ul class="tier-features">
										<li>Up to 20 employees</li>
										<li>Core scheduling, todo, lists</li>
										<li>Add monitoring options as needed</li>
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
									<p class="tier-price">$120/mo</p>
									<ul class="tier-features">
										<li>Up to 75 users</li>
										<li>Advanced admin + editor controls</li>
										<li>Add monitoring options as needed</li>
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
									<p class="tier-price">$275/mo</p>
									<ul class="tier-features">
										<li>Up to 250 employees</li>
										<li>Full platform + multi-team scale</li>
										<li>Add monitoring options as needed</li>
									</ul>
									{#if planTier === 'large'}
										<p class="tier-status">Selected plan</p>
									{/if}
								</button>
							</div>

							<div class="addons-showcase">
								<div class="addon-grid" aria-label="Optional monitoring add-ons">
									<button
										type="button"
										class="addon-card"
										class:active={addOnTempMonitoring}
										on:click={() => (addOnTempMonitoring = !addOnTempMonitoring)}
										aria-pressed={addOnTempMonitoring}
									>
										<strong>Cooler + Freezer Sensors</strong>
										<span>Temperature monitoring</span>
										<em>+$30/mo</em>
										{#if addOnTempMonitoring}
											<p class="tier-status">Selected add-on</p>
										{/if}
									</button>
									<button
										type="button"
										class="addon-card"
										class:active={addOnCameraMonitoring}
										on:click={() => (addOnCameraMonitoring = !addOnCameraMonitoring)}
										aria-pressed={addOnCameraMonitoring}
									>
										<strong>Camera Security Monitoring</strong>
										<span>Security camera monitoring</span>
										<em>+$30/mo</em>
										{#if addOnCameraMonitoring}
											<p class="tier-status">Selected add-on</p>
										{/if}
									</button>
								</div>
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
							<input id="address-state" bind:value={addressState} />

							<label for="address-postal-code">Business postal code</label>
							<input id="address-postal-code" bind:value={addressPostalCode} />

							<label for="address-country">Business country</label>
							<input id="address-country" bind:value={addressCountry} placeholder="United States" />
						{:else}
							<p class="invite-note">Invite detected. This account will attach to the invited workspace.</p>
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
					</div>
				{/if}

				{#if activeSlide.id === 'purchase'}
					<form class="form-zone inline-signup" method="POST">
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
						<input type="hidden" name="addon_temp_monitoring" value={addOnTempMonitoring ? '1' : '0'} />
						<input type="hidden" name="addon_camera_monitoring" value={addOnCameraMonitoring ? '1' : '0'} />
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
						{:else}
							<div class="payment-placeholder">
								<h2>Workspace Billing</h2>
								<p>This invite joins an existing workspace. Billing is managed by the workspace owner.</p>
							</div>
						{/if}

						<label class="inline-toggle agreement-toggle" for="liability-agreement-accepted">
							<input
								id="liability-agreement-accepted"
								name="liability_agreement_accepted"
								type="checkbox"
								bind:checked={liabilityAgreementAccepted}
								value="1"
								required
							/>
							<span>I agree to the NexusNorthSystems LLC liability release agreement.</span>
						</label>

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

	.tour-main {
		position: relative;
		z-index: 2;
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
		color: rgba(237, 245, 255, 0.92);
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
		color: rgba(236, 245, 255, 0.92);
	}

	.tour-feedback {
		margin: 0;
		font-size: 0.84rem;
		font-weight: 600;
	}

	.tour-feedback.error {
		color: #ffc9cf;
	}

	.tour-shot {
		margin: 0;
		width: min(46vw, 40rem);
		aspect-ratio: 16 / 10;
		border-radius: 1rem;
		overflow: hidden;
		box-shadow: 0 28px 56px rgba(0, 0, 0, 0.38);
		border: 1px solid rgba(226, 239, 255, 0.25);
		background: linear-gradient(170deg, rgba(198, 226, 250, 0.14), rgba(7, 10, 15, 0.64));
		padding: 0.36rem;
		position: relative;
		transform: translateY(0);
		transition: transform 220ms ease, box-shadow 220ms ease;
	}

	.tour-shot::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 18% 14%, rgba(186, 218, 248, 0.24), transparent 52%);
		pointer-events: none;
	}

	.tour-shot:hover {
		transform: translateY(-2px);
		box-shadow: 0 32px 58px rgba(0, 0, 0, 0.4);
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
		border-radius: 0.72rem;
	}

	.tour-shot img.contain {
		object-fit: contain;
		background: rgba(6, 10, 15, 0.9);
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
		color: rgba(233, 244, 255, 0.72);
	}

	.form-zone input {
		grid-column: span 2;
		width: 100%;
		padding: 0.66rem 0.74rem;
		border-radius: 0.65rem;
		border: 1px solid rgba(227, 239, 255, 0.32);
		background: rgba(7, 11, 16, 0.56);
		color: #eff5ff;
	}

	.form-zone input:focus {
		outline: none;
		border-color: rgba(205, 225, 245, 0.7);
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
		border-radius: 0.65rem;
		border: 1px solid rgba(227, 239, 255, 0.3);
		background: rgba(255, 255, 255, 0.08);
		color: #eff5ff;
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
		color: rgba(236, 245, 255, 0.92);
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
		border-radius: 0.8rem;
		border: 1px solid rgba(227, 239, 255, 0.34);
		background: rgba(7, 11, 16, 0.56);
		color: #eff5ff;
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
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
	}

	.store-pref-card.active {
		border-color: rgba(218, 237, 255, 0.95);
		background: linear-gradient(180deg, rgba(170, 199, 230, 0.28), rgba(170, 199, 230, 0.14));
		box-shadow:
			0 0 0 1px rgba(222, 240, 255, 0.5) inset,
			0 14px 28px rgba(0, 0, 0, 0.3);
		transform: translateY(-1px);
	}

	.purchase-mode-card {
		padding: 0.95rem 0.9rem;
		border-radius: 0.8rem;
		border: 1px solid rgba(227, 239, 255, 0.34);
		background: rgba(7, 11, 16, 0.56);
		color: #eff5ff;
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
		color: rgba(236, 245, 255, 0.86);
	}

	.purchase-mode-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
	}

	.purchase-mode-card.active {
		border-color: rgba(218, 237, 255, 0.95);
		background: linear-gradient(180deg, rgba(170, 199, 230, 0.28), rgba(170, 199, 230, 0.14));
		box-shadow:
			0 0 0 1px rgba(222, 240, 255, 0.5) inset,
			0 14px 28px rgba(0, 0, 0, 0.3);
		transform: translateY(-1px);
	}

	.submit-btn {
		grid-column: span 2;
		justify-self: start;
	}

	.auth-note {
		grid-column: span 2;
		margin: 0;
		font-size: 0.82rem;
		color: rgba(233, 244, 255, 0.82);
	}

	.auth-note a {
		color: #f5fbff;
	}

	.invite-note {
		grid-column: span 2;
		margin: 0;
		font-size: 0.82rem;
		color: rgba(214, 236, 255, 0.9);
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

	.addons-showcase {
		display: grid;
		gap: 0.7rem;
	}

	.addon-grid {
		display: grid;
		gap: 0.8rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.tier-card {
		padding: 1.2rem 1.1rem;
		min-height: 8.6rem;
		border-radius: 0.8rem;
		border: 1px solid rgba(227, 239, 255, 0.34);
		background: rgba(7, 11, 16, 0.56);
		color: #eff5ff;
		text-align: left;
		display: grid;
		gap: 0.36rem;
		align-content: start;
		transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease;
	}

	.tier-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
	}

	.tier-card strong {
		font-size: 1.34rem;
		line-height: 1.1;
	}

	.tier-price {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: rgba(236, 245, 255, 0.95);
	}

	.tier-features {
		margin: 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.2rem;
	}

	.tier-features li {
		font-size: 0.84rem;
		color: rgba(236, 245, 255, 0.86);
	}

	.tier-card.active {
		border-color: rgba(218, 237, 255, 0.95);
		background: linear-gradient(180deg, rgba(170, 199, 230, 0.28), rgba(170, 199, 230, 0.14));
		box-shadow:
			0 0 0 1px rgba(222, 240, 255, 0.5) inset,
			0 14px 28px rgba(0, 0, 0, 0.3);
		transform: translateY(-1px);
	}

	.addon-card {
		padding: 1rem;
		min-height: 7.4rem;
		border-radius: 0.8rem;
		border: 1px solid rgba(227, 239, 255, 0.34);
		background: rgba(7, 11, 16, 0.56);
		color: #eff5ff;
		text-align: left;
		display: grid;
		gap: 0.3rem;
		align-content: start;
		transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease;
	}

	.addon-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
	}

	.addon-card strong {
		font-size: 1rem;
		line-height: 1.2;
	}

	.addon-card span {
		font-size: 0.86rem;
		color: rgba(236, 245, 255, 0.86);
	}

	.addon-card em {
		font-size: 0.84rem;
		font-style: normal;
		color: rgba(199, 222, 247, 0.92);
	}

	.addon-card.active {
		border-color: rgba(218, 237, 255, 0.95);
		background: linear-gradient(180deg, rgba(170, 199, 230, 0.28), rgba(170, 199, 230, 0.14));
		box-shadow:
			0 0 0 1px rgba(222, 240, 255, 0.5) inset,
			0 14px 28px rgba(0, 0, 0, 0.3);
		transform: translateY(-1px);
	}

	.tier-status {
		margin: 0.2rem 0 0;
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgba(206, 224, 245, 0.9);
	}

	.tier-card.active .tier-status {
		color: rgba(234, 247, 255, 0.98);
	}

	.addon-card.active .tier-status {
		color: rgba(234, 247, 255, 0.98);
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
		border-radius: 999px;
		border: 1px solid rgba(218, 232, 250, 0.52);
		background: rgba(7, 11, 16, 0.58);
		color: #eef5ff;
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
		background: rgba(170, 199, 230, 0.24);
		border-color: rgba(213, 230, 249, 0.68);
	}

	.side-arrow:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

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
		.password-row,
		.submit-btn,
		.auth-note,
		.invite-note,
		.tier-showcase,
		.purchase-mode-grid,
		.store-pref-grid,
		.agreement-toggle {
			grid-column: span 1;
		}

		.tier-grid {
			grid-template-columns: 1fr;
		}

		.addon-grid {
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
