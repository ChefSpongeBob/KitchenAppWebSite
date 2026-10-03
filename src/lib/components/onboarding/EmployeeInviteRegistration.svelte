<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	type FormValues = {
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
		emailUpdates: boolean;
		smsUpdates: boolean;
	};

	export let inviteCode: string;
	export let inviteEmail = '';
	export let form:
		| {
				error?: string;
				values?: Partial<FormValues>;
		  }
		| null = null;

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

	const seeded = form?.values ?? {};
	let phase: 'intro' | 'form' = form?.error ? 'form' : 'intro';
	let activeStep = form?.error ? 2 : 0;
	let fullName = seeded.realName || seeded.displayName || '';
	let birthday = seeded.birthday || '';
	let addressLine1 = seeded.userAddressLine1 || '';
	let addressLine2 = seeded.userAddressLine2 || '';
	let city = seeded.userCity || '';
	let state = seeded.userState || '';
	let postalCode = seeded.userPostalCode || '';
	let phone = seeded.userPhone || '';
	let email = seeded.email || inviteEmail || '';
	let emailUpdates = seeded.emailUpdates ?? false;
	let smsUpdates = seeded.smsUpdates ?? false;
	let password = '';
	let confirmPassword = '';
	let showPassword = false;
	let showConfirmPassword = false;
	let feedback = '';
	let clientFingerprint = '';

	const steps = ['Name & Birthday', 'Address', 'Contact & Login', 'Welcome'];

	onMount(() => {
		let introTimer: number | undefined;

		if (!form?.error) {
			const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			introTimer = window.setTimeout(() => {
				phase = 'form';
			}, reducedMotion ? 120 : 3600);
		}

		try {
			const storageKey = 'crimini_signup_fingerprint_v1';
			const existing = window.localStorage.getItem(storageKey);
			if (existing?.trim()) {
				clientFingerprint = existing.trim().slice(0, 200);
			} else {
				const created =
					typeof crypto !== 'undefined' && 'randomUUID' in crypto
						? crypto.randomUUID()
						: `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
				clientFingerprint = created;
				window.localStorage.setItem(storageKey, created);
			}
		} catch {
			clientFingerprint = '';
		}

		return () => {
			if (introTimer) window.clearTimeout(introTimer);
		};
	});

	function validateCurrentStep() {
		feedback = '';
		if (activeStep === 0) {
			if (!fullName.trim() || !birthday) {
				feedback = 'Enter your name and birthday.';
				return false;
			}
		}
		if (activeStep === 1) {
			if (!addressLine1.trim() || !city.trim() || !state || !postalCode.trim()) {
				feedback = 'Complete your address.';
				return false;
			}
		}
		return true;
	}

	function nextStep() {
		if (!validateCurrentStep()) return;
		activeStep = Math.min(activeStep + 1, 2);
	}

	function previousStep() {
		feedback = '';
		activeStep = Math.max(activeStep - 1, 0);
	}

	function validateSubmission(event: SubmitEvent) {
		feedback = '';
		if (!phone.trim() || !email.trim()) {
			feedback = 'Enter your phone number and email.';
			event.preventDefault();
			return;
		}
		if (!password || !confirmPassword) {
			feedback = 'Enter and confirm your password.';
			event.preventDefault();
			return;
		}
		if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
			password = '';
			confirmPassword = '';
			feedback = 'Use at least 10 characters with letters and numbers.';
			event.preventDefault();
			return;
		}
		if (password !== confirmPassword) {
			password = '';
			confirmPassword = '';
			feedback = 'Passwords do not match.';
			event.preventDefault();
		}
	}
</script>

<svelte:head>
	<title>Join Your Team | Crimini</title>
</svelte:head>

<section class="invite-shell" class:intro-state={phase === 'intro'} aria-label="Employee registration">
	<div class="mushroom-field" aria-hidden="true">
		<img class="mushroom-mark mushroom-mark-one" src="/crimini-mushrooms-only.svg" alt="" />
		<img class="mushroom-mark mushroom-mark-two" src="/crimini-mushrooms-only.svg" alt="" />
		<img class="mushroom-mark mushroom-mark-three" src="/crimini-mushrooms-only.svg" alt="" />
		<img class="mushroom-mark mushroom-mark-four" src="/crimini-mushrooms-only.svg" alt="" />
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
				<div>
					<p>Let&rsquo;s get started.</p>
					<h1>{steps[activeStep]}</h1>
				</div>
				<span>{String(activeStep + 1).padStart(2, '0')} / 04</span>
			</header>

			<div class="progress" aria-label={`Step ${activeStep + 1} of 4`}>
				<span style={`width:${((activeStep + 1) / 4) * 100}%`}></span>
			</div>

			<form method="POST" on:submit={validateSubmission}>
				<input type="hidden" name="invite_code" value={inviteCode} />
				<input type="hidden" name="display_name" value={fullName.trim()} />
				<input type="hidden" name="real_name" value={fullName.trim()} />
				<input type="hidden" name="birthday" value={birthday} />
				<input type="hidden" name="email" value={email.trim()} />
				<input type="hidden" name="confirm_email" value={email.trim()} />
				<input type="hidden" name="user_phone" value={phone.trim()} />
				<input type="hidden" name="user_address_line_1" value={addressLine1.trim()} />
				<input type="hidden" name="user_address_line_2" value={addressLine2.trim()} />
				<input type="hidden" name="user_city" value={city.trim()} />
				<input type="hidden" name="user_state" value={state} />
				<input type="hidden" name="user_postal_code" value={postalCode.trim()} />
				<input type="hidden" name="client_fingerprint" value={clientFingerprint} />
				<input type="hidden" name="purchase_mode" value="buy_now" />

				{#key activeStep}
					<div class="step" in:fade={{ duration: 220 }}>
						{#if activeStep === 0}
							<label>
								<span>Full name</span>
								<input bind:value={fullName} autocomplete="name" maxlength="120" required />
							</label>
							<label>
								<span>Birthday</span>
								<input type="date" bind:value={birthday} autocomplete="bday" required />
							</label>
						{:else if activeStep === 1}
							<div class="field-grid">
								<label class="wide">
									<span>Address</span>
									<input bind:value={addressLine1} autocomplete="address-line1" maxlength="120" required />
								</label>
								<label class="wide">
									<span>Apartment / Unit</span>
									<input bind:value={addressLine2} autocomplete="address-line2" maxlength="120" />
								</label>
								<label>
									<span>City</span>
									<input bind:value={city} autocomplete="address-level2" maxlength="80" required />
								</label>
								<label>
									<span>State</span>
									<select bind:value={state} autocomplete="address-level1" required>
										{#each US_STATES as [value, label]}
											<option {value}>{label}</option>
										{/each}
									</select>
								</label>
								<label>
									<span>Postal code</span>
									<input bind:value={postalCode} autocomplete="postal-code" maxlength="24" required />
								</label>
							</div>
						{:else}
							<div class="field-grid">
								<label>
									<span>Phone</span>
									<input type="tel" bind:value={phone} autocomplete="tel" maxlength="48" required />
								</label>
								<label>
									<span>Email</span>
									<input
										type="email"
										bind:value={email}
										autocomplete="email"
										readonly={Boolean(inviteEmail)}
										required
									/>
								</label>
								<label>
									<span>Password</span>
									<div class="password-field">
										<input
											name="password"
											type={showPassword ? 'text' : 'password'}
											bind:value={password}
											autocomplete="new-password"
											required
										/>
										<button type="button" on:click={() => (showPassword = !showPassword)}>
											{showPassword ? 'Hide' : 'Show'}
										</button>
									</div>
								</label>
								<label>
									<span>Confirm password</span>
									<div class="password-field">
										<input
											name="confirm_password"
											type={showConfirmPassword ? 'text' : 'password'}
											bind:value={confirmPassword}
											autocomplete="new-password"
											required
										/>
										<button type="button" on:click={() => (showConfirmPassword = !showConfirmPassword)}>
											{showConfirmPassword ? 'Hide' : 'Show'}
										</button>
									</div>
								</label>
							</div>

							<div class="consents">
								<label>
									<input type="checkbox" name="email_updates" value="1" bind:checked={emailUpdates} />
									<span>Email notifications</span>
								</label>
								<label>
									<input type="checkbox" name="sms_updates" value="1" bind:checked={smsUpdates} />
									<span>Text notifications</span>
								</label>
							</div>
						{/if}
					</div>
				{/key}

				{#if feedback || form?.error}
					<p class="feedback" role="alert">{feedback || form?.error}</p>
				{/if}

				<footer class="actions">
					{#if activeStep > 0}
						<button type="button" class="back" on:click={previousStep}>Back</button>
					{/if}
					{#if activeStep < 2}
						<button type="button" class="continue" on:click={nextStep}>Continue</button>
					{:else}
						<button type="submit" class="continue">Create account</button>
					{/if}
				</footer>
			</form>
		</div>
	{/if}
</section>

<style>
	:global(html:has(.invite-shell)),
	:global(body:has(.invite-shell)) {
		width: 100%;
		margin: 0 !important;
		padding: 0 !important;
		overflow-x: hidden;
		background: #fbfaf7;
	}

	:global(.app-content.onboarding-content:has(.invite-shell)) {
		width: 100vw !important;
		max-width: 100vw !important;
		margin: 0 !important;
		padding: 0 !important;
	}

	.invite-shell,
	.invite-shell * {
		box-sizing: border-box;
	}

	.invite-shell {
		position: relative;
		isolation: isolate;
		min-height: 100dvh;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		place-items: center;
		padding: clamp(4.5rem, 8vw, 7rem) clamp(1.1rem, 5vw, 4rem) 3rem;
		background:
			radial-gradient(circle at 16% 15%, rgba(190, 169, 128, 0.12), transparent 26rem),
			linear-gradient(180deg, #ffffff 0%, #fbfaf7 100%);
		color: #111214;
	}

	.invite-shell.intro-state {
		background: #fff;
	}

	.mushroom-field {
		position: absolute;
		z-index: 0;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.mushroom-mark {
		position: absolute;
		display: block;
		height: auto;
		opacity: 0.045;
		filter: grayscale(1) contrast(1.15);
		mix-blend-mode: multiply;
	}

	.mushroom-mark-one {
		top: 5%;
		left: -8rem;
		width: clamp(15rem, 24vw, 24rem);
		transform: rotate(-12deg);
	}

	.mushroom-mark-two {
		top: 8%;
		right: -9rem;
		width: clamp(18rem, 30vw, 31rem);
		transform: rotate(11deg);
	}

	.mushroom-mark-three {
		bottom: -5rem;
		left: 8%;
		width: clamp(12rem, 19vw, 20rem);
		transform: rotate(7deg);
	}

	.mushroom-mark-four {
		right: 6%;
		bottom: -3rem;
		width: clamp(10rem, 16vw, 17rem);
		transform: rotate(-9deg);
	}

	.invite-shell::after {
		content: '';
		position: absolute;
		z-index: 2;
		inset: auto 7vw 2.2rem;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(17, 18, 20, 0.26), transparent);
	}

	.home-link {
		position: absolute;
		top: 1.35rem;
		left: clamp(1.1rem, 4vw, 3rem);
		z-index: 3;
		padding-bottom: 0.22rem;
		border-bottom: 1px solid rgba(17, 18, 20, 0.35);
		color: #111214;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
	}

	.intro {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-rows: minmax(15rem, 1fr) clamp(5.5rem, 12vw, 8rem);
		align-items: end;
		justify-items: center;
		gap: clamp(0.8rem, 2vw, 1.4rem);
		width: min(38rem, 90vw);
		min-height: min(36rem, 72dvh);
		text-align: center;
	}

	.intro-logo {
		display: block;
		width: min(30rem, 82vw);
		height: auto;
		mix-blend-mode: multiply;
		animation: intro-brand 3600ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.intro-copy {
		position: relative;
		align-self: stretch;
		width: 100%;
	}

	.intro h1 {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		font-size: clamp(2.3rem, 7vw, 5.5rem);
		font-weight: 500;
		letter-spacing: -0.065em;
		opacity: 0;
	}

	.welcome-message {
		animation: intro-welcome 1900ms cubic-bezier(0.22, 1, 0.36, 1) 300ms both;
	}

	.intro .starting-message {
		font-size: clamp(2rem, 6vw, 4.7rem);
		animation: intro-starting 1650ms cubic-bezier(0.22, 1, 0.36, 1) 1900ms both;
	}

	.form-shell {
		position: relative;
		z-index: 1;
		justify-self: center;
		width: min(48rem, 100%);
		min-width: 0;
	}

	@keyframes intro-brand {
		0% {
			opacity: 0;
			transform: translateY(0.65rem) scale(0.99);
		}
		16%,
		76% {
			opacity: 1;
			transform: none;
		}
		100% {
			opacity: 0;
			transform: translateY(-1rem) scale(0.98);
		}
	}

	@keyframes intro-welcome {
		0% {
			opacity: 0;
			transform: translateY(0.65rem);
		}
		20%,
		68% {
			opacity: 1;
			transform: none;
		}
		100% {
			opacity: 0;
			transform: translateY(-0.7rem);
		}
	}

	@keyframes intro-starting {
		0% {
			opacity: 0;
			transform: translateY(0.8rem);
		}
		24%,
		70% {
			opacity: 1;
			transform: none;
		}
		100% {
			opacity: 0;
			transform: translateY(-1.3rem);
		}
	}

	.flow-header {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 1rem;
		padding-bottom: 1rem;
	}

	.flow-header img {
		width: 4.25rem;
		height: 3rem;
		object-fit: contain;
		mix-blend-mode: multiply;
	}

	.flow-header p,
	.flow-header h1 {
		margin: 0;
	}

	.flow-header p,
	.flow-header > span {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.flow-header p {
		color: rgba(17, 18, 20, 0.58);
	}

	.flow-header h1 {
		font-size: clamp(1.75rem, 4vw, 3rem);
		font-weight: 520;
		letter-spacing: -0.045em;
	}

	.progress {
		height: 1px;
		margin-bottom: clamp(2rem, 6vw, 4rem);
		background: rgba(17, 18, 20, 0.12);
	}

	.progress span {
		display: block;
		height: 100%;
		background: #111214;
		transition: width 260ms ease;
	}

	form,
	.step {
		display: grid;
		gap: 1.35rem;
	}

	.field-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.35rem 1.5rem;
	}

	.field-grid .wide {
		grid-column: 1 / -1;
	}

	label {
		display: grid;
		gap: 0.42rem;
	}

	label > span {
		color: rgba(17, 18, 20, 0.64);
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	input,
	select {
		width: 100%;
		min-height: 3rem;
		padding: 0.58rem 0.15rem;
		border: 0;
		border-bottom: 1px solid rgba(17, 18, 20, 0.24);
		border-radius: 0;
		outline: 0;
		background: transparent;
		color: #111214;
		font: inherit;
	}

	input:focus,
	select:focus {
		border-bottom-color: #111214;
	}

	input[readonly] {
		color: rgba(17, 18, 20, 0.72);
	}

	.password-field {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: end;
		border-bottom: 1px solid rgba(17, 18, 20, 0.24);
	}

	.password-field:focus-within {
		border-bottom-color: #111214;
	}

	.password-field input {
		border-bottom: 0;
	}

	.password-field button,
	.actions button {
		border: 0;
		border-bottom: 1px solid currentColor;
		border-radius: 0;
		background: transparent;
		color: #111214;
		cursor: pointer;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 750;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.password-field button {
		margin: 0 0.1rem 0.72rem 0.65rem;
		padding: 0.15rem 0;
	}

	.consents {
		display: flex;
		gap: 0.85rem 1.5rem;
		flex-wrap: wrap;
		padding-top: 0.35rem;
	}

	.consents label {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
	}

	.consents input {
		width: 1rem;
		height: 1rem;
		min-height: 0;
		accent-color: #111214;
	}

	.consents label > span {
		color: #111214;
		font-size: 0.82rem;
		letter-spacing: 0;
		text-transform: none;
	}

	.feedback {
		margin: 0;
		padding: 0.7rem 0;
		border-top: 1px solid rgba(142, 47, 36, 0.35);
		border-bottom: 1px solid rgba(142, 47, 36, 0.35);
		color: #74261d;
		font-size: 0.88rem;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 1.4rem;
		padding-top: 1.1rem;
	}

	.actions button {
		padding: 0.55rem 0;
	}

	.actions .back {
		color: rgba(17, 18, 20, 0.58);
	}

	.actions .continue {
		font-weight: 850;
	}

	@media (max-width: 640px) {
		.invite-shell {
			place-items: start stretch;
			padding-top: 5.5rem;
		}

		.form-shell {
			margin: auto;
		}

		.intro {
			grid-template-rows: minmax(12rem, 1fr) 6.5rem;
			min-height: min(32rem, 70dvh);
		}

		.mushroom-mark {
			opacity: 0.035;
		}

		.mushroom-mark-one {
			top: 10%;
			left: -9rem;
		}

		.mushroom-mark-two {
			top: 24%;
			right: -11rem;
		}

		.mushroom-mark-three {
			left: -4rem;
			bottom: -2rem;
		}

		.mushroom-mark-four {
			display: none;
		}

		.flow-header {
			grid-template-columns: 3.1rem 1fr auto;
			gap: 0.7rem;
		}

		.flow-header img {
			width: 3.1rem;
			height: 2.25rem;
		}

		.field-grid {
			grid-template-columns: 1fr;
		}

		.field-grid .wide {
			grid-column: auto;
		}

		.actions {
			justify-content: space-between;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.intro-logo,
		.welcome-message,
		.intro .starting-message {
			animation: none;
		}

		.progress span {
			transition: none;
		}
	}
</style>
