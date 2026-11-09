<script lang="ts">
	import EmployeeInviteRegistration from '#lib/components/onboarding/EmployeeInviteRegistration.svelte';
	import OwnerRegistration from '#lib/components/onboarding/OwnerRegistration.svelte';
	import type { ActionData, PageData } from './$types';
	import AuthShell from '#lib/components/ui/AuthShell.svelte';
	import { invitationLoginPath } from '#lib/invitations.ts';
	import { nativeRestaurantSwitch } from '#lib/client/restaurantSwitch.ts';

	export let form: ActionData;
	export let data: PageData;
</script>

{#if data.acceptedInvitation}
	<AuthShell eyebrow="" title={data.acceptedInvitation.businessName}>
		<div class="existing-account-invite">
			<img src="/crimini-full-logo.jpg" alt="Crimini" />
			<p>You have already joined this restaurant.</p>
			<form method="POST" action="/workspace/switch" use:nativeRestaurantSwitch>
				<input type="hidden" name="business_id" value={data.acceptedInvitation.businessId} />
				<input type="hidden" name="entry" value="login" />
				<button type="submit">Open restaurant</button>
			</form>
		</div>
	</AuthShell>
{:else if data.inviteCode && !data.inviteEmail}
	<AuthShell eyebrow="" title="Invitation unavailable">
		<div class="existing-account-invite">
			<img src="/crimini-full-logo.jpg" alt="Crimini" />
			<p>This invitation is no longer active. Ask your manager for a new one, or sign in if you have already joined.</p>
			<a href="/login">Sign in</a>
		</div>
	</AuthShell>
{:else if data.inviteCode && data.existingInviteAccount && !data.canAcceptInvite}
	<AuthShell eyebrow="" title={data.invitationBusinessName ? `Join ${data.invitationBusinessName}` : 'Join your restaurant'}>
		<div class="existing-account-invite">
			<img src="/crimini-full-logo.jpg" alt="Crimini" />
			<p>Sign in with your existing account to accept this invitation.</p>
			<p>{data.inviteEmail}</p>
			<a href={invitationLoginPath(data.inviteCode)}>Sign in</a>
		</div>
	</AuthShell>
{:else if data.inviteCode}
	<EmployeeInviteRegistration
		inviteCode={data.inviteCode}
		inviteEmail={data.inviteEmail ?? ''}
		existingAccount={data.canAcceptInvite}
		{form}
	/>
{:else}
	<OwnerRegistration agreementVersion={data.agreementVersion} {form} />
{/if}

<style>
	.existing-account-invite { display: grid; gap: 1rem; }
	.existing-account-invite img { width: min(15rem, 100%); }
	.existing-account-invite p { margin: 0; overflow-wrap: anywhere; }
	.existing-account-invite a, .existing-account-invite button { width: fit-content; color: var(--color-text); border: 0; border-bottom: 1px solid var(--color-divider); border-radius: 0; background: transparent; font: inherit; padding: 0.3rem 0; cursor: pointer; }
</style>
