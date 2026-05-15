<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
</script>

<Layout>
	<section class="legal-page">
		<p class="eyebrow">Crimini</p>
		<h1>Privacy Policy</h1>
		<p class="updated">Last updated May 10, 2026</p>

		<div class="legal-section">
			<h2>Data We Collect</h2>
			<p>
				Crimini collects account, workspace, employee profile, scheduling, checklist, document,
				recipe, task, invite, device/session, and operational monitoring data entered or generated
				while using the service.
			</p>
			<p>
				Operational monitoring may include temperature sensor records, camera event metadata, uploaded
				document/media files, IP address, user agent, device/session identifiers, and audit records.
			</p>
		</div>

		<div class="legal-section">
			<h2>How We Use Data</h2>
			<p>
				We use data to run restaurant workspaces, authenticate users, isolate each business account,
				send invites or password reset messages, support onboarding, maintain security, prevent trial
				abuse, troubleshoot service issues, and improve reliability.
			</p>
		</div>

		<div class="legal-section">
			<h2>Sharing</h2>
			<p>
				We do not sell personal data. Data may be processed through infrastructure and service
				providers used to host the app, store uploaded files, deliver email, monitor security, or meet
				legal obligations.
			</p>
		</div>

		<div class="legal-section">
			<h2>Retention And Deletion</h2>
			<p>
				Workspace data is retained while an account is active. Account deletion requests are handled
				through the account deletion page. Some records may be retained when needed for fraud
				prevention, security, tax, legal, or compliance reasons.
			</p>
		</div>

		<div class="legal-section">
			<h2>Security</h2>
			<p>
				Crimini uses authenticated sessions, tenant-scoped database access, HTTPS, role-based admin
				access, audit logging, and production schema controls to protect workspace data.
			</p>
		</div>

		<div class="legal-section">
			<h2>Contact</h2>
			<p>
				Privacy and deletion requests can be submitted through the account deletion page.
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
</style>
