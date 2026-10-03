<script lang="ts">
	import EmployeeInviteRegistration from '$lib/components/onboarding/EmployeeInviteRegistration.svelte';
	import OwnerRegistration from '$lib/components/onboarding/OwnerRegistration.svelte';
	import type { ActionData, PageData } from './$types';

	export let form: ActionData;
	export let data: PageData;
</script>

{#if data.inviteCode}
	<EmployeeInviteRegistration
		inviteCode={data.inviteCode}
		inviteEmail={data.inviteEmail ?? ''}
		{form}
	/>
{:else}
	<OwnerRegistration agreementVersion={data.agreementVersion} {form} />
{/if}
