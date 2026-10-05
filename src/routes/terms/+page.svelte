<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
</script>

<svelte:head>
	<title>Terms of Service | Crimini</title>
	<meta
		name="description"
		content="Terms governing Crimini restaurant workspaces, accounts, subscriptions, employee records, and connected monitoring."
	/>
</svelte:head>

<Layout>
	<section class="legal-page">
		<p class="eyebrow">Crimini</p>
		<h1>Terms of Service</h1>
		<p class="updated">Effective October 5, 2026</p>

		<div class="legal-section">
			<h2>Agreement And Eligibility</h2>
			<p>
				These Terms govern use of Crimini websites, mobile apps, restaurant workspaces, and
				connected services provided by NNS, LLC. By creating or using an account, you agree to these
				Terms and the
				<a href="/privacy">Privacy Policy</a>. You must be legally able to enter this agreement. A
				person creating a workspace represents that they are authorized to act for that business.
			</p>
		</div>

		<div class="legal-section">
			<h2>Service And Accounts</h2>
			<p>
				Crimini provides restaurant operations software for scheduling, staff workflows, lists,
				recipes, documents, reports, onboarding, communication, billing access, and configured
				temperature monitoring. Users must provide accurate information, protect credentials, use
				only their assigned account, and notify support of suspected unauthorized access.
			</p>
		</div>

		<div class="legal-section">
			<h2>Workspace Administration</h2>
			<p>
				The subscribing business controls its workspace, invitations, permissions, records, feature
				settings, and user access. Owners and authorized managers must assign appropriate
				permissions, remove access when it is no longer needed, and ensure only authorized people
				can view sensitive business or employee information.
			</p>
		</div>

		<div class="legal-section">
			<h2>Employment, Tax, And Compliance</h2>
			<p>
				Businesses are responsible for required employment documents, identity verification, payroll
				and tax setup, record retention, wage and scheduling rules, food safety, workplace notices,
				employee consent, and state or local forms. Crimini provides workflow and record-management
				tools; it does not provide legal, tax, payroll, food-safety, or human-resources advice and
				is not an employer or payroll processor.
			</p>
		</div>

		<div class="legal-section">
			<h2>Customer Content</h2>
			<p>
				The business and its users retain ownership of content they submit. They grant NNS, LLC a
				limited license to host, process, reproduce, and transmit that content only as needed to
				operate, secure, and support Crimini. Users must have the rights and lawful authority
				required to submit content and personal information.
			</p>
		</div>

		<div class="legal-section">
			<h2>Monitoring Tools</h2>
			<p>
				Temperature monitoring supports operational awareness but is not an emergency, life-safety,
				or regulatory certification system. Connectivity, batteries, placement, equipment, and
				third-party services can delay or prevent readings and alerts. Businesses remain responsible
				for manual checks, calibration, equipment, local code, food-safety decisions, staff
				training, and incident response.
			</p>
		</div>

		<div class="legal-section">
			<h2>Subscriptions And Stores</h2>
			<p>
				Paid access is governed by the <a href="/billing-terms">Billing Terms</a>. Purchases made
				through Apple or Google are also governed by that store's terms. Canceling a subscription
				does not itself delete an account or workspace, and deleting an account does not itself
				cancel a store subscription.
			</p>
		</div>

		<div class="legal-section">
			<h2>Acceptable Use</h2>
			<p>
				Users may not access another business without authorization; bypass billing, permissions, or
				security controls; probe or disrupt the service; upload malicious or unlawful content;
				misuse personal data; impersonate another person; or use Crimini in violation of law.
				Automated access is allowed only through interfaces expressly provided by Crimini.
			</p>
		</div>

		<div class="legal-section">
			<h2>Third-Party Services</h2>
			<p>
				Crimini relies on third-party app stores, hosting, email, device, and network services.
				Their own terms may apply. NNS, LLC is not responsible for third-party outages, account
				decisions, or content outside its reasonable control.
			</p>
		</div>

		<div class="legal-section">
			<h2>Availability, Changes, And Suspension</h2>
			<p>
				We may maintain, secure, update, replace, or discontinue service functions. Access may be
				limited or suspended for nonpayment, security risk, unlawful use, material breach, or
				protection of users and the service. Where practical, notice will be provided before a
				material change or suspension.
			</p>
		</div>

		<div class="legal-section">
			<h2>Disclaimers</h2>
			<p>
				To the extent permitted by law, Crimini is provided "as is" and "as available." NNS, LLC
				disclaims implied warranties of merchantability, fitness for a particular purpose,
				noninfringement, and uninterrupted or error-free operation. Rights that cannot legally be
				waived remain unaffected.
			</p>
		</div>

		<div class="legal-section">
			<h2>Limitation Of Liability</h2>
			<p>
				To the extent permitted by law, NNS, LLC will not be liable for indirect, incidental,
				special, consequential, exemplary, or lost-profit damages arising from Crimini. NNS, LLC's
				aggregate liability for a claim will not exceed the amount paid for the affected service
				during the 12 months before the event giving rise to the claim. This limitation does not
				apply where prohibited by law.
			</p>
		</div>

		<div class="legal-section">
			<h2>Indemnity</h2>
			<p>
				To the extent permitted by law, a business agrees to defend and indemnify NNS, LLC from
				third-party claims arising from its unlawful content, misuse of Crimini, violation of these
				Terms, or failure to meet its employment, tax, safety, privacy, or regulatory obligations.
			</p>
		</div>

		<div class="legal-section">
			<h2>Governing Law And Changes</h2>
			<p>
				These Terms are governed by applicable United States law and the law of the state in which
				NNS, LLC is organized, without regard to conflict-of-law rules. We may update these Terms
				and will post the effective date above. Continued use after an effective update constitutes
				acceptance where allowed by law.
			</p>
		</div>

		<div class="legal-section">
			<h2>Contact And Related Terms</h2>
			<p>
				Questions may be sent to <a href="mailto:support@criminiops.com">support@criminiops.com</a>.
			</p>
			<nav aria-label="Legal links">
				<a href="/privacy">Privacy</a>
				<a href="/billing-terms">Billing Terms</a>
				<a href="/account-deletion">Account Deletion</a>
				<a href="/support">Support</a>
			</nav>
		</div>
	</section>
</Layout>

<style>
	.legal-page {
		max-width: 780px;
		margin: 0 auto;
		padding: clamp(3rem, 8vw, 6rem) 0;
		color: #111214;
	}

	.eyebrow,
	.updated {
		margin: 0;
		color: rgba(17, 18, 20, 0.58);
		font-size: 0.78rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0.35rem 0 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(2.6rem, 8vw, 5.4rem);
		font-weight: 400;
		letter-spacing: -0.065em;
		line-height: 0.92;
	}

	.updated {
		margin-top: 1rem;
		padding-bottom: 1.2rem;
		border-bottom: 1px solid rgba(17, 18, 20, 0.16);
	}

	.legal-section {
		padding: 1.15rem 0;
		border-bottom: 1px solid rgba(17, 18, 20, 0.12);
	}

	h2 {
		margin: 0 0 0.45rem;
		font-size: 1rem;
		letter-spacing: -0.02em;
	}

	p {
		margin: 0;
		color: rgba(17, 18, 20, 0.72);
		line-height: 1.65;
	}

	p + nav {
		margin-top: 0.65rem;
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	a {
		border-bottom: 1px solid rgba(17, 18, 20, 0.22);
		color: #111214;
		text-decoration: none;
	}

	a:hover,
	a:focus-visible {
		border-bottom-color: #111214;
	}
</style>
