<script lang="ts">
	export let active: 'overview' | 'team' | 'onboarding' | 'hr' | 'access' = 'overview';
	export let canReviewOnboarding = false;
	export let canViewSensitive = false;
	export let canManagePermissions = false;

	$: tabs = [
		{ key: 'overview', label: 'Overview', href: '/admin/users?view=overview', visible: true },
		{ key: 'team', label: 'Team', href: '/admin/users?view=team', visible: true },
		{
			key: 'onboarding',
			label: 'Onboarding',
			href: '/admin/onboarding',
			visible: canReviewOnboarding
		},
		{
			key: 'hr',
			label: 'HR & Compliance',
			href: '/admin/users?view=hr',
			visible: canViewSensitive
		},
		{
			key: 'access',
			label: 'Access',
			href: '/admin/users?view=access',
			visible: canManagePermissions
		}
	].filter((tab) => tab.visible);
</script>

<nav class="people-hr-nav" aria-label="People and HR sections">
	{#each tabs as tab}
		<a
			href={tab.href}
			class:active={active === tab.key}
			aria-current={active === tab.key ? 'page' : undefined}
		>
			{tab.label}
		</a>
	{/each}
</nav>

<style>
	.people-hr-nav {
		display: flex;
		gap: clamp(0.9rem, 2.4vw, 1.7rem);
		overflow-x: auto;
		padding: 0.25rem 0 0;
		border-bottom: 1px solid var(--color-divider);
		scrollbar-width: thin;
	}

	a {
		flex: 0 0 auto;
		padding: 0.58rem 0 0.52rem;
		border-bottom: 2px solid transparent;
		color: var(--color-text-muted);
		font-size: 0.76rem;
		font-weight: var(--weight-semibold);
		letter-spacing: 0.035em;
		text-decoration: none;
	}

	a:hover,
	a:focus-visible,
	a.active {
		color: var(--color-text);
		border-bottom-color: var(--color-text);
	}
</style>
