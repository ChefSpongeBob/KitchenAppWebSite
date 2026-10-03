<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	type FormValues = {
		displayName: string;
		ownerTitle: string;
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
		smsUpdates: boolean;
		businessName: string;
		planTier: string;
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
		storeBillingPreference: 'both' | 'google_play' | 'app_store';
		liabilityAgreementAccepted: boolean;
		menuTitle: string;
	};

	export let agreementVersion: string;
	export let form:
		| { error?: string; activeSlideId?: string; values?: Partial<FormValues> }
		| null = null;

	const US_STATES = [
		['', 'Select state'], ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'],
		['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'],
		['DE', 'Delaware'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
		['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
		['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
		['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
		['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
		['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
		['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
		['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
		['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'],
		['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
		['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'], ['DC', 'District of Columbia']
	];
	const COUNTRIES = [['United States', 'United States'], ['Canada', 'Canada'], ['Mexico', 'Mexico']];
	const steps = [
		'Name & Birthday', 'Address', 'Contact & Login', 'Profile Details', 'Your Business',
		'Business Contact', 'Menu', 'Business Details', 'Choose a Plan', 'Welcome to Crimini'
	];
	const optionalSteps = new Set([0, 1, 3, 5, 6, 7]);
	const seeded = form?.values ?? {};
	const errorStep = form?.activeSlideId === 'security' ? 2 : form?.activeSlideId === 'business' ? 4 : form?.activeSlideId === 'tier' ? 8 : form?.activeSlideId === 'purchase' ? 9 : 0;

	let phase: 'intro' | 'form' = form?.error ? 'form' : 'intro';
	let activeStep = form?.error ? errorStep : 0;
	let displayName = seeded.displayName ?? '';
	let ownerTitle = seeded.ownerTitle ?? '';
	let realName = seeded.realName ?? '';
	let birthday = seeded.birthday ?? '';
	let email = seeded.email ?? '';
	let confirmEmail = seeded.confirmEmail ?? '';
	let userPhone = seeded.userPhone ?? '';
	let userAddressLine1 = seeded.userAddressLine1 ?? '';
	let userAddressLine2 = seeded.userAddressLine2 ?? '';
	let userCity = seeded.userCity ?? '';
	let userState = seeded.userState ?? '';
	let userPostalCode = seeded.userPostalCode ?? '';
	let emergencyContactName = seeded.emergencyContactName ?? '';
	let emergencyContactPhone = seeded.emergencyContactPhone ?? '';
	let emergencyContactRelationship = seeded.emergencyContactRelationship ?? '';
	let emailUpdates = seeded.emailUpdates ?? true;
	let smsUpdates = seeded.smsUpdates ?? false;
	let password = '';
	let confirmPassword = '';
	let showPassword = false;
	let showConfirmPassword = false;

	let businessName = seeded.businessName ?? '';
	let addressLine1 = seeded.addressLine1 ?? '';
	let addressLine2 = seeded.addressLine2 ?? '';
	let addressCity = seeded.addressCity ?? '';
	let addressState = seeded.addressState ?? '';
	let addressPostalCode = seeded.addressPostalCode ?? '';
	let addressCountry = seeded.addressCountry ?? 'United States';
	let contactEmail = seeded.contactEmail ?? '';
	let contactPhone = seeded.contactPhone ?? '';
	let legalName = seeded.legalName ?? '';
	let registryId = seeded.registryId ?? '';
	let websiteUrl = seeded.websiteUrl ?? '';
	let planTier = seeded.planTier ?? 'small';
	let storeBillingPreference = seeded.storeBillingPreference ?? 'both';
	let liabilityAgreementAccepted = seeded.liabilityAgreementAccepted ?? false;
	let menuTitle = seeded.menuTitle ?? '';
	let businessLogo: File | null = null;
	let businessDocuments: File[] = [];
	let menuFile: File | null = null;
	let feedback = '';
	let clientFingerprint = '';
	let shellElement: HTMLElement;

	$: basePlanPrice = planTier === 'large' ? 90 : planTier === 'medium' ? 65 : 30;
	$: tempMonitoringIncluded = planTier === 'medium' || planTier === 'large';

	onMount(() => {
		let introTimer: number | undefined;
		if (!form?.error) {
			const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			introTimer = window.setTimeout(() => (phase = 'form'), reducedMotion ? 120 : 3600);
		}
		try {
			const key = 'crimini_signup_fingerprint_v1';
			const existing = window.localStorage.getItem(key);
			if (existing?.trim()) clientFingerprint = existing.trim().slice(0, 200);
			else {
				clientFingerprint = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
				window.localStorage.setItem(key, clientFingerprint);
			}
		} catch { clientFingerprint = ''; }
		return () => { if (introTimer) window.clearTimeout(introTimer); };
	});

	function passwordIsValid() {
		if (!email.trim() || !confirmEmail.trim()) { feedback = 'Enter and confirm your email.'; return false; }
		if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) { feedback = 'Emails do not match.'; return false; }
		if (!password || !confirmPassword) { feedback = 'Enter and confirm your password.'; return false; }
		if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
			password = ''; confirmPassword = ''; feedback = 'Use at least 10 characters with letters and numbers.'; return false;
		}
		if (password !== confirmPassword) { password = ''; confirmPassword = ''; feedback = 'Passwords do not match.'; return false; }
		return true;
	}

	function nextStep() {
		feedback = '';
		if (activeStep === 2 && !passwordIsValid()) return;
		if (activeStep === 4 && !businessName.trim()) { feedback = 'Enter your restaurant or business name.'; return; }
		activeStep = Math.min(activeStep + 1, steps.length - 1);
		requestAnimationFrame(() => shellElement?.scrollTo({ top: 0 }));
	}
	function skipStep() { feedback = ''; activeStep = Math.min(activeStep + 1, steps.length - 1); requestAnimationFrame(() => shellElement?.scrollTo({ top: 0 })); }
	function previousStep() { feedback = ''; activeStep = Math.max(activeStep - 1, 0); requestAnimationFrame(() => shellElement?.scrollTo({ top: 0 })); }
	function firstFile(event: Event) { return (event.currentTarget as HTMLInputElement).files?.[0] ?? null; }
	function selectedFiles(event: Event) { return Array.from((event.currentTarget as HTMLInputElement).files ?? []).slice(0, 6); }
	function validateSubmission() {
		feedback = '';
		if (!passwordIsValid()) { activeStep = 2; return false; }
		if (!businessName.trim()) { feedback = 'Enter your restaurant or business name.'; activeStep = 4; return false; }
		if (!liabilityAgreementAccepted) { feedback = 'Accept the agreement to create your workspace.'; return false; }
		return true;
	}
</script>

<svelte:head><title>Create Your Crimini Workspace</title></svelte:head>

<section
	bind:this={shellElement}
	class="owner-shell"
	class:intro-state={phase === 'intro'}
	class:form-state={phase === 'form'}
	aria-label="Business registration"
>
	<div class="mushroom-field" aria-hidden="true">
		<img class="mushroom-mark mark-one" src="/crimini-mushrooms-only.svg" alt="" />
		<img class="mushroom-mark mark-two" src="/crimini-mushrooms-only.svg" alt="" />
		<img class="mushroom-mark mark-three" src="/crimini-mushrooms-only.svg" alt="" />
		<img class="mushroom-mark mark-four" src="/crimini-mushrooms-only.svg" alt="" />
	</div>
	<a class="home-link" href="/">Home</a>

	{#if phase === 'intro'}
		<div class="intro">
			<img class="intro-logo" src="/crimini-full-logo.jpg" alt="Crimini by NNS, LLC" />
			<div class="intro-copy" aria-live="polite">
				<h1 class="welcome-message">Welcome!</h1>
				<h1 class="starting-message">Let&rsquo;s get started.</h1>
			</div>
		</div>
	{:else}
		<div class="form-shell" in:fade={{ duration: 520 }}>
			<header class="flow-header">
				<img src="/crimini-mushrooms-only.svg" alt="" aria-hidden="true" />
				<div><p>Set up Crimini</p><h1>{steps[activeStep]}</h1></div>
				<span>{String(activeStep + 1).padStart(2, '0')} / {steps.length}</span>
			</header>
			<div class="progress" aria-label={`Step ${activeStep + 1} of ${steps.length}`}><span style={`width:${((activeStep + 1) / steps.length) * 100}%`}></span></div>

			<form method="POST" enctype="multipart/form-data" use:enhance={({ formData, cancel }) => {
				if (!validateSubmission()) { cancel(); return; }
				if (businessLogo) formData.set('business_logo', businessLogo);
				for (const document of businessDocuments) formData.append('business_documents', document);
				if (menuFile) formData.set('business_menu', menuFile);
			}}>
				<input type="hidden" name="display_name" value={displayName.trim() || realName.trim()} />
				<input type="hidden" name="owner_title" value={ownerTitle.trim()} />
				<input type="hidden" name="real_name" value={realName.trim() || displayName.trim()} />
				<input type="hidden" name="birthday" value={birthday} />
				<input type="hidden" name="email" value={email.trim()} />
				<input type="hidden" name="confirm_email" value={confirmEmail.trim()} />
				<input type="hidden" name="user_phone" value={userPhone.trim()} />
				<input type="hidden" name="user_address_line_1" value={userAddressLine1.trim()} />
				<input type="hidden" name="user_address_line_2" value={userAddressLine2.trim()} />
				<input type="hidden" name="user_city" value={userCity.trim()} />
				<input type="hidden" name="user_state" value={userState} />
				<input type="hidden" name="user_postal_code" value={userPostalCode.trim()} />
				<input type="hidden" name="emergency_contact_name" value={emergencyContactName.trim()} />
				<input type="hidden" name="emergency_contact_phone" value={emergencyContactPhone.trim()} />
				<input type="hidden" name="emergency_contact_relationship" value={emergencyContactRelationship.trim()} />
				<input type="hidden" name="password" value={password} />
				<input type="hidden" name="confirm_password" value={confirmPassword} />
				<input type="hidden" name="email_updates" value={emailUpdates ? '1' : '0'} />
				<input type="hidden" name="sms_updates" value={smsUpdates ? '1' : '0'} />
				<input type="hidden" name="business_name" value={businessName.trim()} />
				<input type="hidden" name="address_line_1" value={addressLine1.trim()} />
				<input type="hidden" name="address_line_2" value={addressLine2.trim()} />
				<input type="hidden" name="address_city" value={addressCity.trim()} />
				<input type="hidden" name="address_state" value={addressState} />
				<input type="hidden" name="address_postal_code" value={addressPostalCode.trim()} />
				<input type="hidden" name="address_country" value={addressCountry} />
				<input type="hidden" name="contact_email" value={contactEmail.trim()} />
				<input type="hidden" name="contact_phone" value={contactPhone.trim()} />
				<input type="hidden" name="legal_name" value={legalName.trim()} />
				<input type="hidden" name="registry_id" value={registryId.trim()} />
				<input type="hidden" name="website_url" value={websiteUrl.trim()} />
				<input type="hidden" name="plan_tier" value={planTier} />
				<input type="hidden" name="addon_temp_monitoring" value={tempMonitoringIncluded ? '1' : '0'} />
				<input type="hidden" name="purchase_mode" value="buy_now" />
				<input type="hidden" name="store_billing_preference" value={storeBillingPreference} />
				<input type="hidden" name="liability_agreement_accepted" value={liabilityAgreementAccepted ? '1' : '0'} />
				<input type="hidden" name="liability_agreement_version" value={agreementVersion} />
				<input type="hidden" name="client_fingerprint" value={clientFingerprint} />
				<input type="hidden" name="menu_title" value={menuTitle.trim()} />

				{#key activeStep}
					<div class:business-stage={activeStep === 4} class="step" in:fade={{ duration: 220 }}>
						{#if activeStep === 0}
							<div class="field-grid">
								<label><span>Full name</span><input bind:value={realName} autocomplete="name" maxlength="120" /></label>
								<label><span>Birthday</span><input type="date" bind:value={birthday} autocomplete="bday" /></label>
							</div>
						{:else if activeStep === 1}
							<div class="field-grid">
								<label class="wide"><span>Home address</span><input bind:value={userAddressLine1} autocomplete="address-line1" maxlength="120" /></label>
								<label class="wide"><span>Apartment / Unit</span><input bind:value={userAddressLine2} autocomplete="address-line2" maxlength="120" /></label>
								<label><span>City</span><input bind:value={userCity} autocomplete="address-level2" maxlength="80" /></label>
								<label><span>State</span><select bind:value={userState} autocomplete="address-level1">{#each US_STATES as [value, label]}<option {value}>{label}</option>{/each}</select></label>
								<label><span>Postal code</span><input bind:value={userPostalCode} autocomplete="postal-code" maxlength="24" /></label>
							</div>
						{:else if activeStep === 2}
							<div class="field-grid">
								<label><span>Phone</span><input type="tel" bind:value={userPhone} autocomplete="tel" maxlength="48" /></label>
								<label><span>Email</span><input type="email" bind:value={email} autocomplete="email" required /></label>
								<label><span>Confirm email</span><input type="email" bind:value={confirmEmail} autocomplete="email" required /></label>
								<label><span>Password</span><div class="password-field"><input type={showPassword ? 'text' : 'password'} bind:value={password} autocomplete="new-password" required /><button type="button" on:click={() => (showPassword = !showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
								<label><span>Confirm password</span><div class="password-field"><input type={showConfirmPassword ? 'text' : 'password'} bind:value={confirmPassword} autocomplete="new-password" required /><button type="button" on:click={() => (showConfirmPassword = !showConfirmPassword)}>{showConfirmPassword ? 'Hide' : 'Show'}</button></div></label>
							</div>
							<div class="consents"><label><input type="checkbox" bind:checked={emailUpdates} /><span>Email notifications</span></label><label><input type="checkbox" bind:checked={smsUpdates} /><span>Text notifications</span></label></div>
						{:else if activeStep === 3}
							<div class="field-grid">
								<label><span>Display name</span><input bind:value={displayName} maxlength="120" /></label>
								<label><span>Your title</span><input bind:value={ownerTitle} placeholder="Owner" maxlength="120" /></label>
								<label><span>Emergency contact</span><input bind:value={emergencyContactName} maxlength="120" /></label>
								<label><span>Emergency phone</span><input type="tel" bind:value={emergencyContactPhone} maxlength="48" /></label>
								<label><span>Relationship</span><input bind:value={emergencyContactRelationship} maxlength="80" /></label>
							</div>
						{:else if activeStep === 4}
							<p class="business-lead">Let&rsquo;s set up your business!</p>
							<div class="business-fields"><div class="field-grid">
								<label class="wide"><span>Restaurant or business name</span><input bind:value={businessName} maxlength="120" required /></label>
								<label class="wide"><span>Business address</span><input bind:value={addressLine1} maxlength="120" /></label>
								<label class="wide"><span>Suite / Unit</span><input bind:value={addressLine2} maxlength="120" /></label>
								<label><span>City</span><input bind:value={addressCity} maxlength="80" /></label>
								<label><span>State</span><select bind:value={addressState}>{#each US_STATES as [value, label]}<option {value}>{label}</option>{/each}</select></label>
								<label><span>Postal code</span><input bind:value={addressPostalCode} maxlength="24" /></label>
								<label><span>Country</span><select bind:value={addressCountry}>{#each COUNTRIES as [value, label]}<option {value}>{label}</option>{/each}</select></label>
								<label class="wide upload-field"><span>Business logo</span><input type="file" accept="image/jpeg,image/png,image/webp" on:change={(event) => (businessLogo = firstFile(event))} /><small>{businessLogo?.name ?? 'JPG, PNG, or WebP. 5MB maximum.'}</small></label>
							</div></div>
						{:else if activeStep === 5}
							<div class="field-grid">
								<label><span>Business email</span><input type="email" bind:value={contactEmail} maxlength="120" /></label>
								<label><span>Business phone</span><input type="tel" bind:value={contactPhone} maxlength="48" /></label>
								<label class="wide upload-field"><span>Business documents</span><input type="file" accept="application/pdf" multiple on:change={(event) => (businessDocuments = selectedFiles(event))} /><small>{businessDocuments.length ? `${businessDocuments.length} selected` : 'Optional: SOPs, handbook, or employee documents. Up to 6 PDFs.'}</small></label>
							</div>
						{:else if activeStep === 6}
							<div class="field-grid">
								<label><span>Menu title</span><input bind:value={menuTitle} placeholder="Dinner" maxlength="180" /></label>
								<label class="upload-field"><span>Menu PDF</span><input type="file" accept="application/pdf" on:change={(event) => (menuFile = firstFile(event))} /><small>{menuFile?.name ?? 'Upload now or add menus later.'}</small></label>
							</div>
						{:else if activeStep === 7}
							<div class="field-grid">
								<label><span>Legal business name</span><input bind:value={legalName} maxlength="120" /></label>
								<label><span>Registration ID</span><input bind:value={registryId} maxlength="80" /></label>
								<label class="wide"><span>Website</span><input type="url" bind:value={websiteUrl} placeholder="https://" maxlength="180" /></label>
							</div>
						{:else if activeStep === 8}
							<div class="plan-list" role="radiogroup" aria-label="Plan size">
								<button type="button" class:active={planTier === 'small'} on:click={() => (planTier = 'small')} aria-pressed={planTier === 'small'}><span><strong>Small</strong><small>Up to 20 employees</small></span><b>$30/mo</b></button>
								<button type="button" class:active={planTier === 'medium'} on:click={() => (planTier = 'medium')} aria-pressed={planTier === 'medium'}><span><strong>Medium</strong><small>Up to 75 users + temperature monitoring</small></span><b>$65/mo</b></button>
								<button type="button" class:active={planTier === 'large'} on:click={() => (planTier = 'large')} aria-pressed={planTier === 'large'}><span><strong>Large</strong><small>Up to 250 users + full platform</small></span><b>$90/mo</b></button>
							</div>
						{:else}
							<div class="final-step">
								<img src="/crimini-full-logo.jpg" alt="Crimini by NNS, LLC" />
								<p>Choose where you plan to use Crimini.</p>
								<div class="platform-list" role="radiogroup" aria-label="Preferred platform">
									<button type="button" class:active={storeBillingPreference === 'app_store'} on:click={() => (storeBillingPreference = 'app_store')}>iPhone / iPad</button>
									<button type="button" class:active={storeBillingPreference === 'google_play'} on:click={() => (storeBillingPreference = 'google_play')}>Android</button>
									<button type="button" class:active={storeBillingPreference === 'both'} on:click={() => (storeBillingPreference = 'both')}>Both + Web</button>
								</div>
								<p class="web-note">Use criminiops.com for scheduling, reports, and large-screen work. Every feature remains available in the app.</p>
								<div class="purchase-summary"><span>{businessName}</span><strong>${basePlanPrice}/month</strong></div>
								<label class="agreement"><input type="checkbox" bind:checked={liabilityAgreementAccepted} /><span>I agree to the <a href="/legal/liability-agreement" target="_blank" rel="noreferrer">Crimini agreement</a>.</span></label>
							</div>
						{/if}
					</div>
				{/key}

				{#if feedback || form?.error}<p class="feedback" role="alert">{feedback || form?.error}</p>{/if}
				<footer class="actions">
					<div>{#if activeStep > 0}<button type="button" class="back" on:click={previousStep}>Back</button>{/if}</div>
					<div class="forward-actions">
						{#if optionalSteps.has(activeStep)}<button type="button" class="skip" on:click={skipStep}>Skip</button>{/if}
						{#if activeStep < steps.length - 1}<button type="button" class="continue" on:click={nextStep}>Continue</button>{:else}<button type="submit" class="continue">Create workspace</button>{/if}
					</div>
				</footer>
			</form>
		</div>
	{/if}
</section>

<style>
	:global(html:has(.owner-shell)), :global(body:has(.owner-shell)) { width: 100%; margin: 0 !important; padding: 0 !important; overflow-x: hidden; background: #fbfaf7; }
	:global(.app-content.onboarding-content:has(.owner-shell)) { width: 100vw !important; max-width: 100vw !important; margin: 0 !important; padding: 0 !important; }
	.owner-shell, .owner-shell * { box-sizing: border-box; }
	.owner-shell { position: relative; isolation: isolate; min-height: 100dvh; display: grid; grid-template-columns: minmax(0, 1fr); place-items: center; padding: clamp(4.5rem, 8vw, 7rem) clamp(1.1rem, 5vw, 4rem) 3rem; overflow: hidden; background: radial-gradient(circle at 16% 15%, rgba(190, 169, 128, 0.12), transparent 26rem), linear-gradient(180deg, #fff 0%, #fbfaf7 100%); color: #111214; }
	.owner-shell.intro-state { background: #fff; }
	.owner-shell.form-state { align-items: start; overflow-y: auto; }
	.mushroom-field { position: absolute; z-index: 0; inset: 0; overflow: hidden; pointer-events: none; }
	.mushroom-mark { position: absolute; display: block; height: auto; opacity: 0.045; filter: grayscale(1) contrast(1.15); mix-blend-mode: multiply; }
	.mark-one { top: 5%; left: -8rem; width: clamp(15rem, 24vw, 24rem); transform: rotate(-12deg); }
	.mark-two { top: 8%; right: -9rem; width: clamp(18rem, 30vw, 31rem); transform: rotate(11deg); }
	.mark-three { bottom: -5rem; left: 8%; width: clamp(12rem, 19vw, 20rem); transform: rotate(7deg); }
	.mark-four { right: 6%; bottom: -3rem; width: clamp(10rem, 16vw, 17rem); transform: rotate(-9deg); }
	.owner-shell::after { content: ''; position: absolute; z-index: 2; inset: auto 7vw 2.2rem; height: 1px; background: linear-gradient(90deg, transparent, rgba(17, 18, 20, 0.26), transparent); }
	.home-link { position: absolute; top: 1.35rem; left: clamp(1.1rem, 4vw, 3rem); z-index: 3; padding-bottom: 0.22rem; border-bottom: 1px solid rgba(17, 18, 20, 0.35); color: #111214; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; text-decoration: none; text-transform: uppercase; }
	.intro { position: relative; z-index: 1; display: grid; grid-template-rows: minmax(15rem, 1fr) clamp(5.5rem, 12vw, 8rem); align-items: end; justify-items: center; gap: 1rem; width: min(38rem, 90vw); min-height: min(36rem, 72dvh); text-align: center; }
	.intro-logo { display: block; width: min(30rem, 82vw); height: auto; mix-blend-mode: multiply; animation: intro-brand 3600ms cubic-bezier(0.22, 1, 0.36, 1) both; }
	.intro-copy { position: relative; align-self: stretch; width: 100%; }
	.intro h1 { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; font-size: clamp(2.3rem, 7vw, 5.5rem); font-weight: 500; letter-spacing: -0.065em; opacity: 0; }
	.welcome-message { animation: intro-welcome 1900ms cubic-bezier(0.22, 1, 0.36, 1) 300ms both; }
	.intro .starting-message { font-size: clamp(2rem, 6vw, 4.7rem); animation: intro-starting 1650ms cubic-bezier(0.22, 1, 0.36, 1) 1900ms both; }
	@keyframes intro-brand { 0% { opacity: 0; transform: translateY(0.65rem) scale(0.99); } 16%, 76% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-1rem) scale(0.98); } }
	@keyframes intro-welcome { 0% { opacity: 0; transform: translateY(0.65rem); } 20%, 68% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-0.7rem); } }
	@keyframes intro-starting { 0% { opacity: 0; transform: translateY(0.8rem); } 24%, 70% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-1.3rem); } }
	.form-shell { position: relative; z-index: 1; justify-self: center; width: min(52rem, 100%); min-width: 0; }
	.flow-header { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 1rem; padding-bottom: 1rem; }
	.flow-header img { width: 4.25rem; height: 3rem; object-fit: contain; mix-blend-mode: multiply; }
	.flow-header p, .flow-header h1 { margin: 0; }
	.flow-header p, .flow-header > span { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
	.flow-header p { color: rgba(17, 18, 20, 0.58); }
	.flow-header h1 { font-size: clamp(1.75rem, 4vw, 3rem); font-weight: 520; letter-spacing: -0.045em; }
	.progress { height: 1px; margin-bottom: clamp(1.8rem, 5vw, 3.2rem); background: rgba(17, 18, 20, 0.12); }
	.progress span { display: block; height: 100%; background: #111214; transition: width 260ms ease; }
	form, .step { display: grid; gap: 1.25rem; }
	.step { min-height: 18rem; align-content: start; }
	.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem 1.5rem; }
	.field-grid .wide { grid-column: 1 / -1; }
	label { display: grid; gap: 0.42rem; }
	label > span { color: rgba(17, 18, 20, 0.64); font-size: 0.76rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
	input, select { width: 100%; min-height: 3rem; padding: 0.58rem 0.15rem; border: 0; border-bottom: 1px solid rgba(17, 18, 20, 0.24); border-radius: 0; outline: 0; background: transparent; color: #111214; font: inherit; }
	input:focus, select:focus { border-bottom-color: #111214; }
	input[type='file'] { padding: 0.7rem 0; }
	input[type='file']::file-selector-button { margin-right: 1rem; padding: 0.25rem 0; border: 0; border-bottom: 1px solid #111214; background: transparent; color: #111214; font: inherit; font-size: 0.75rem; font-weight: 750; text-transform: uppercase; cursor: pointer; }
	.upload-field small { color: rgba(17, 18, 20, 0.56); font-size: 0.78rem; }
	.password-field { display: grid; grid-template-columns: 1fr auto; align-items: end; border-bottom: 1px solid rgba(17, 18, 20, 0.24); }
	.password-field input { border-bottom: 0; }
	.password-field button, .actions button { padding: 0.2rem 0; border: 0; border-bottom: 1px solid currentColor; border-radius: 0; background: transparent; color: #111214; cursor: pointer; font: inherit; font-size: 0.78rem; font-weight: 750; letter-spacing: 0.06em; text-transform: uppercase; }
	.password-field button { margin: 0 0.1rem 0.72rem 0.65rem; }
	.consents { display: flex; gap: 0.85rem 1.5rem; flex-wrap: wrap; padding-top: 0.35rem; }
	.consents label, .agreement { display: inline-flex; align-items: center; gap: 0.55rem; }
	.consents input, .agreement input { width: 1rem; height: 1rem; min-height: 0; accent-color: #111214; }
	.consents label > span, .agreement > span { color: #111214; font-size: 0.82rem; letter-spacing: 0; text-transform: none; }
	.business-stage { position: relative; }
	.business-lead { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; font-size: clamp(2rem, 5vw, 4rem); font-weight: 520; letter-spacing: -0.055em; text-align: center; pointer-events: none; animation: business-lead 1500ms cubic-bezier(0.22, 1, 0.36, 1) both; }
	.business-fields { opacity: 0; animation: business-fields 560ms ease 1250ms both; }
	@keyframes business-lead { 0% { opacity: 0; transform: translateY(1rem); } 25%, 66% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-1.8rem); } }
	@keyframes business-fields { from { opacity: 0; transform: translateY(1rem); } to { opacity: 1; transform: none; } }
	.plan-list { border-top: 1px solid rgba(17, 18, 20, 0.18); }
	.plan-list button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.15rem 0.2rem; border: 0; border-bottom: 1px solid rgba(17, 18, 20, 0.18); background: transparent; color: #111214; text-align: left; cursor: pointer; }
	.plan-list button > span { display: grid; gap: 0.18rem; }
	.plan-list small { color: rgba(17, 18, 20, 0.58); }
	.plan-list button.active { font-weight: 850; background: linear-gradient(90deg, rgba(182, 155, 104, 0.13), transparent 68%); }
	.final-step { display: grid; justify-items: center; gap: 1.2rem; text-align: center; }
	.final-step > img { width: min(18rem, 70vw); height: auto; mix-blend-mode: multiply; }
	.final-step > p { margin: 0; }
	.platform-list { display: flex; justify-content: center; gap: 1.2rem; flex-wrap: wrap; }
	.platform-list button { padding: 0.35rem 0; border: 0; border-bottom: 1px solid rgba(17, 18, 20, 0.3); background: transparent; color: #111214; cursor: pointer; font: inherit; }
	.platform-list button.active { border-bottom-width: 2px; font-weight: 850; }
	.web-note { max-width: 38rem; color: rgba(17, 18, 20, 0.64); font-size: 0.9rem; }
	.purchase-summary { width: min(32rem, 100%); display: flex; justify-content: space-between; gap: 1rem; padding: 0.8rem 0; border-top: 1px solid rgba(17, 18, 20, 0.18); border-bottom: 1px solid rgba(17, 18, 20, 0.18); }
	.agreement a { color: inherit; text-underline-offset: 0.18rem; }
	.feedback { margin: 0; padding: 0.7rem 0; border-top: 1px solid rgba(142, 47, 36, 0.35); border-bottom: 1px solid rgba(142, 47, 36, 0.35); color: #74261d; font-size: 0.88rem; }
	.actions, .forward-actions { display: flex; align-items: center; gap: 1.4rem; }
	.actions { justify-content: space-between; padding-top: 0.9rem; }
	.actions .back, .actions .skip { color: rgba(17, 18, 20, 0.58); }
	.actions .continue { font-weight: 850; }
	@media (max-width: 640px) {
		.owner-shell { place-items: start stretch; padding-top: 5.5rem; overflow-y: auto; }
		.form-shell { margin: auto; }
		.intro { grid-template-rows: minmax(12rem, 1fr) 6.5rem; min-height: min(32rem, 70dvh); }
		.mushroom-mark { opacity: 0.035; }
		.mark-one { top: 10%; left: -9rem; } .mark-two { top: 24%; right: -11rem; } .mark-three { left: -4rem; bottom: -2rem; } .mark-four { display: none; }
		.flow-header { grid-template-columns: 3.1rem 1fr auto; gap: 0.7rem; }
		.flow-header img { width: 3.1rem; height: 2.25rem; }
		.flow-header > span { font-size: 0.64rem; }
		.field-grid { grid-template-columns: 1fr; }
		.field-grid .wide { grid-column: auto; }
		.step { min-height: 22rem; }
		.actions { align-items: flex-end; }
		.forward-actions { flex-direction: column-reverse; align-items: flex-end; gap: 0.65rem; }
	}
	@media (prefers-reduced-motion: reduce) {
		.intro-logo, .welcome-message, .intro .starting-message, .business-lead, .business-fields { animation: none; }
		.business-lead { display: none; } .business-fields { opacity: 1; } .progress span { transition: none; }
	}
</style>
