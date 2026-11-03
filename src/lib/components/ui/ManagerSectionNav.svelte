<script lang="ts">
	import { page as pageState } from '$app/state';
  import { toStore } from 'svelte/store';
  const page = toStore(() => ({ ...pageState }));
	import { defaultAppFeatureModes } from '#lib/features/appFeatures.ts';
	import {
		canViewManagerNavigationItem,
		isManagerNavigationItemActive,
		managerNavigationGroups,
		type ManagerNavigationGroup
	} from '#lib/navigation/managerNavigation.ts';

	export let groupId: ManagerNavigationGroup['id'];

	$: group = managerNavigationGroups.find((entry) => entry.id === groupId);
	$: featureModes = $page.data?.featureModes ?? defaultAppFeatureModes;
	$: user = $page.data?.user ?? null;
	$: visibleItems = (group?.items ?? []).filter((item) =>
		canViewManagerNavigationItem(item, user, featureModes)
	);
</script>

{#if visibleItems.length > 1}
	<nav class="manager-section-nav" aria-label={`${group?.label ?? 'Manager'} sections`}>
		{#each visibleItems as item}
			<a
			href={item.href}
			class:active={isManagerNavigationItemActive(item, $page.url.pathname, $page.url.search)}
			>
				<span class="material-icons" aria-hidden="true">{item.icon}</span>
				{item.label}
			</a>
		{/each}
	</nav>
{/if}

<style>
	.manager-section-nav {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		overflow-x: auto;
		padding: 0.1rem 0 0.72rem;
		border-bottom: 1px solid var(--color-divider);
		scrollbar-width: thin;
	}
	.manager-section-nav a {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		flex: 0 0 auto;
		padding: 0.52rem 0.68rem;
		color: var(--color-text-muted);
		font-size: 0.74rem;
		font-weight: var(--weight-semibold);
		text-decoration: none;
		white-space: nowrap;
	}
	.manager-section-nav a::after {
		content: '';
		position: absolute;
		left: 0.68rem;
		right: 0.68rem;
		bottom: -1px;
		height: 1px;
		background: transparent;
	}
	.manager-section-nav a.active {
		color: var(--color-text);
	}
	.manager-section-nav a.active::after {
		background: linear-gradient(90deg, var(--color-text), transparent);
	}
	.manager-section-nav .material-icons {
		font-size: 1rem;
	}
	@media (max-width: 640px) {
		.manager-section-nav {
			margin-inline: -0.35rem;
			padding-inline: 0.35rem;
		}
		.manager-section-nav a {
			padding-inline: 0.55rem;
		}
	}
</style>
