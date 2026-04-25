<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';

	type GuidedStep = {
		selector: string;
		title: string;
		description: string;
		placement?: 'top' | 'bottom' | 'left' | 'right';
	};

	type CardPosition = { top: number; left: number };

	export let title = 'Guided Tour';
	export let steps: GuidedStep[] = [];

	const dispatch = createEventDispatcher<{ finish: void; dismiss: void }>();
	const CARD_WIDTH = 320;
	const PADDING = 18;
	const SPOTLIGHT_RADIUS = 14;
	const SPOTLIGHT_MARGIN = 8;

	let activeIndex = 0;
	let spotlightRect: DOMRect | null = null;
	let targetMissing = false;
	let cardPosition: CardPosition = { top: 24, left: 24 };
	let recomputeFrame = 0;

	$: currentStep = steps[activeIndex];
	$: isLastStep = activeIndex >= steps.length - 1;
	$: isFirstStep = activeIndex <= 0;
	$: totalSteps = steps.length;

	function clamp(value: number, min: number, max: number) {
		return Math.max(min, Math.min(max, value));
	}

	function resolveCardPosition(
		target: DOMRect | null,
		placement: GuidedStep['placement'] = 'bottom'
	): CardPosition {
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		if (!target) {
			return {
				top: Math.max(24, vh * 0.2),
				left: clamp((vw - CARD_WIDTH) / 2, 16, vw - CARD_WIDTH - 16)
			};
		}

		const gap = 12;
		const byBottom = () => ({
			top: clamp(target.bottom + gap, 12, vh - 220),
			left: clamp(target.left + target.width / 2 - CARD_WIDTH / 2, 12, vw - CARD_WIDTH - 12)
		});
		const byTop = () => ({
			top: clamp(target.top - 186 - gap, 12, vh - 220),
			left: clamp(target.left + target.width / 2 - CARD_WIDTH / 2, 12, vw - CARD_WIDTH - 12)
		});
		const byRight = () => ({
			top: clamp(target.top + target.height / 2 - 94, 12, vh - 220),
			left: clamp(target.right + gap, 12, vw - CARD_WIDTH - 12)
		});
		const byLeft = () => ({
			top: clamp(target.top + target.height / 2 - 94, 12, vh - 220),
			left: clamp(target.left - CARD_WIDTH - gap, 12, vw - CARD_WIDTH - 12)
		});

		if (placement === 'top') return byTop();
		if (placement === 'left') return byLeft();
		if (placement === 'right') return byRight();
		return byBottom();
	}

	function recompute() {
		if (!currentStep) return;
		const target = document.querySelector<HTMLElement>(currentStep.selector);

		if (!target) {
			targetMissing = true;
			spotlightRect = null;
			cardPosition = resolveCardPosition(null, currentStep.placement);
			return;
		}

		targetMissing = false;
		spotlightRect = target.getBoundingClientRect();
		cardPosition = resolveCardPosition(spotlightRect, currentStep.placement);
	}

	function scheduleRecompute() {
		cancelAnimationFrame(recomputeFrame);
		recomputeFrame = requestAnimationFrame(recompute);
	}

	function scrollStepTargetIntoView() {
		if (!currentStep) return;
		const target = document.querySelector<HTMLElement>(currentStep.selector);
		target?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
	}

	function nextStep() {
		if (isLastStep) {
			dispatch('finish');
			return;
		}
		activeIndex += 1;
		scrollStepTargetIntoView();
		scheduleRecompute();
	}

	function previousStep() {
		if (isFirstStep) return;
		activeIndex -= 1;
		scrollStepTargetIntoView();
		scheduleRecompute();
	}

	function dismissTour() {
		dispatch('dismiss');
	}

	function handleResize() {
		scheduleRecompute();
	}

	onMount(() => {
		scrollStepTargetIntoView();
		scheduleRecompute();
		window.addEventListener('resize', handleResize);
		window.addEventListener('scroll', handleResize, { passive: true });
		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('scroll', handleResize);
		};
	});

	onDestroy(() => {
		cancelAnimationFrame(recomputeFrame);
	});
</script>

{#if totalSteps > 0}
	<div class="tour-root" role="dialog" aria-modal="true" aria-label={title}>
		{#if spotlightRect}
			<div
				class="spotlight"
				style={`
					top:${Math.max(PADDING, spotlightRect.top - SPOTLIGHT_MARGIN)}px;
					left:${Math.max(PADDING, spotlightRect.left - SPOTLIGHT_MARGIN)}px;
					width:${Math.max(44, spotlightRect.width + SPOTLIGHT_MARGIN * 2)}px;
					height:${Math.max(44, spotlightRect.height + SPOTLIGHT_MARGIN * 2)}px;
					border-radius:${SPOTLIGHT_RADIUS}px;
				`}
			></div>
		{:else}
			<div class="fallback-overlay"></div>
		{/if}

		<aside
			class="tour-card"
			style={`top:${cardPosition.top}px;left:${cardPosition.left}px;width:${CARD_WIDTH}px;`}
		>
			<p class="tour-title">{title}</p>
			<p class="tour-step">Step {activeIndex + 1} of {totalSteps}</p>
			<h2>{currentStep.title}</h2>
			<p class="tour-description">{currentStep.description}</p>
			{#if targetMissing}
				<p class="tour-note">This step target is currently hidden. You can continue.</p>
			{/if}

			<div class="tour-actions">
				<button type="button" on:click={dismissTour} class="quiet">Skip</button>
				<div class="nav-actions">
					<button type="button" on:click={previousStep} disabled={isFirstStep}>Back</button>
					<button type="button" on:click={nextStep}>{isLastStep ? 'Finish' : 'Next'}</button>
				</div>
			</div>
		</aside>
	</div>
{/if}

<style>
	.tour-root {
		position: fixed;
		inset: 0;
		z-index: 1800;
		pointer-events: none;
	}

	.spotlight {
		position: fixed;
		pointer-events: none;
		box-shadow: 0 0 0 9999px rgba(5, 8, 14, 0.66);
		border: 2px solid rgba(226, 235, 248, 0.86);
		outline: 1px solid rgba(132, 146, 166, 0.72);
		background: transparent;
	}

	.fallback-overlay {
		position: fixed;
		inset: 0;
		background: rgba(5, 8, 14, 0.7);
	}

	.tour-card {
		position: fixed;
		pointer-events: auto;
		border: 1px solid rgba(228, 239, 255, 0.2);
		border-radius: 14px;
		padding: 0.78rem 0.82rem 0.8rem;
		background:
			linear-gradient(155deg, rgba(132, 146, 166, 0.32), rgba(132, 146, 166, 0.11) 58%, rgba(132, 146, 166, 0.04)),
			#111722;
		box-shadow: 0 24px 52px rgba(0, 0, 0, 0.46);
		display: grid;
		gap: 0.35rem;
	}

	.tour-title {
		margin: 0;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: rgba(228, 239, 255, 0.8);
	}

	.tour-step {
		margin: 0;
		font-size: 0.72rem;
		color: rgba(228, 239, 255, 0.66);
	}

	.tour-card h2 {
		margin: 0.1rem 0 0.12rem;
		font-size: 1rem;
		color: #f4f8ff;
	}

	.tour-description {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.42;
		color: rgba(232, 241, 255, 0.9);
	}

	.tour-note {
		margin: 0.04rem 0 0;
		font-size: 0.74rem;
		color: #facc15;
	}

	.tour-actions {
		margin-top: 0.45rem;
		display: flex;
		justify-content: space-between;
		gap: 0.58rem;
		align-items: center;
	}

	.nav-actions {
		display: inline-flex;
		gap: 0.38rem;
	}

	button {
		border-radius: 9px;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.42rem 0.62rem;
		border: 1px solid rgba(226, 239, 255, 0.26);
		background: rgba(226, 239, 255, 0.1);
		color: #f4f8ff;
		cursor: pointer;
	}

	button.quiet {
		background: transparent;
		color: rgba(232, 241, 255, 0.82);
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 720px) {
		.tour-card {
			left: 10px !important;
			right: 10px;
			width: auto !important;
			max-width: none;
			top: auto !important;
			bottom: 12px;
		}
	}
</style>
