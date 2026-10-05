<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
</script>

<svelte:head>
	<title>Privacy Policy | Crimini</title>
	<meta
		name="description"
		content="How Crimini collects, uses, protects, and deletes account, restaurant workspace, employee, billing, and sensor data."
	/>
</svelte:head>

<Layout>
	<section class="legal-page">
		<p class="eyebrow">Crimini</p>
		<h1>Privacy Policy</h1>
		<p class="updated">Effective October 5, 2026</p>

		<div class="legal-section">
			<h2>Scope</h2>
			<p>
				This policy applies to Crimini websites, mobile apps, restaurant workspaces, and connected
				temperature-monitoring services operated by NNS, LLC. A restaurant controls the business and
				employee records placed in its workspace. NNS, LLC processes those records to provide
				Crimini.
			</p>
		</div>

		<div class="legal-section">
			<h2>Data We Collect</h2>
			<p>
				<strong>Account and contact data:</strong> names, email addresses, phone numbers, login credentials,
				communication choices, business roles, and permissions.
			</p>
			<p>
				<strong>Business and operational data:</strong> restaurant details, branding, schedules, availability,
				time-off requests, lists, recipes, tasks, announcements, menus, documents, reports, waste logs,
				and related activity.
			</p>
			<p>
				<strong>Employee and onboarding data:</strong> profile details, address, date of birth, emergency
				contacts, employment forms, acknowledgements, identity-verification records, and payroll, tax,
				or bank information submitted through an employer's onboarding process. Some of this data is sensitive.
			</p>
			<p>
				<strong>Billing data:</strong> plan, entitlement, renewal, transaction, and purchase-verification
				details. Apple, Google, or another authorized billing provider processes payment-card information;
				Crimini does not receive a complete payment-card number from app-store purchases.
			</p>
			<p>
				<strong>Device and technical data:</strong> session and device identifiers, push-notification
				tokens, IP address, user agent, security and audit events, uploaded files, and temperature-sensor
				serial, temperature, humidity, battery, signal, gateway, and status data.
			</p>
		</div>

		<div class="legal-section">
			<h2>How We Use Data</h2>
			<p>
				We use data to create and secure accounts, provide tenant-scoped restaurant workspaces,
				process purchases and entitlements, deliver schedules and operational tools, support
				employee onboarding, deliver requested email, text, and push communications, operate sensor
				monitoring, maintain audit records, prevent abuse, troubleshoot failures, and improve
				service reliability.
			</p>
			<p>Crimini does not use customer data for third-party advertising or cross-app tracking.</p>
		</div>

		<div class="legal-section">
			<h2>Business Access</h2>
			<p>
				Workspace owners and authorized managers may access employee and operational data according
				to their assigned permissions. Employees can access only the workspace and functions made
				available to them. A business may export or retain records when required for its employment,
				tax, safety, or other legal responsibilities.
			</p>
		</div>

		<div class="legal-section">
			<h2>Service Providers And Disclosure</h2>
			<p>
				We do not sell personal data. We disclose data only as needed to operate Crimini, including
				to Cloudflare for hosting, databases, file storage, security, and delivery; Resend for
				transactional email; Apple and Google for app distribution, purchases, and notifications;
				and professional or legal providers when necessary. We may also disclose information to
				comply with law, protect rights and safety, investigate misuse, or complete a business
				transaction subject to appropriate protections.
			</p>
		</div>

		<div class="legal-section">
			<h2>Retention</h2>
			<p>
				We retain information while an account or workspace is active and as needed to provide the
				service. Retention varies by record: operational readings may be kept for shorter periods,
				while billing, security, employment, tax, acknowledgement, and audit records may be retained
				longer when required by the business, law, or a legitimate security need. Data is deleted or
				de-identified when it is no longer needed, subject to backups and required retention.
			</p>
		</div>

		<div class="legal-section">
			<h2>Security</h2>
			<p>
				Crimini uses HTTPS, authenticated sessions, tenant-scoped access, role and permission
				controls, encryption for designated sensitive records, audit logging, rate limits, and
				restricted production access. No system can guarantee absolute security. Users must protect
				account credentials and report suspected unauthorized access promptly.
			</p>
		</div>

		<div class="legal-section">
			<h2>Choices And Rights</h2>
			<p>
				Users may update profile information and communication choices in Crimini. Depending on
				location, you may request access, correction, export, restriction, or deletion of personal
				data. Employment record requests may need to be handled by the restaurant that controls the
				workspace. We may verify identity and authority before completing a request.
			</p>
			<p>
				Submit a deletion request through <a href="/account-deletion">Account Deletion</a> or
				contact
				<a href="mailto:support@criminiops.com">support@criminiops.com</a>. We do not discriminate
				for exercising applicable privacy rights.
			</p>
		</div>

		<div class="legal-section">
			<h2>Communications</h2>
			<p>
				Transactional messages may be sent for account security, invitations, onboarding, billing,
				and service operations. Optional email or text notifications are sent according to recorded
				consent and can be changed in account settings. Carrier message and data rates may apply to
				text messages.
			</p>
		</div>

		<div class="legal-section">
			<h2>Children And Processing Location</h2>
			<p>
				Crimini is a business service and is not directed to children under 13. Data may be
				processed in the United States and other locations where service providers operate, subject
				to applicable legal protections.
			</p>
		</div>

		<div class="legal-section">
			<h2>Changes And Contact</h2>
			<p>
				We may update this policy as Crimini changes. Material updates will be posted here and
				communicated when required. Questions may be sent to <a href="mailto:support@criminiops.com"
					>support@criminiops.com</a
				>.
			</p>
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

	p + p {
		margin-top: 0.65rem;
	}

	a {
		color: #111214;
		text-underline-offset: 0.16rem;
	}
</style>
