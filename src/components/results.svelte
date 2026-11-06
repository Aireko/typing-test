<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Chart from './chart.svelte';
	import type { Best, Result } from './typing';

	export let result: Result;
	/** Test configuration, e.g. "time 30". */
	export let label: string;
	/** Personal best comparison; null for tests that don't track one. */
	export let best: { previous?: Best; isNew: boolean } | null = null;

	const dispatch = createEventDispatcher<{ next: void; repeat: void }>();

	$: stats = [
		{ label: 'Test type', value: label },
		{ label: 'Raw', value: Math.round(result.raw), title: `${result.raw.toFixed(2)} wpm` },
		{
			label: 'Characters',
			value: `${result.correct}/${result.incorrect}/${result.extra}/${result.missed}`,
			title: 'correct / incorrect / extra / missed'
		},
		{
			label: 'Consistency',
			value: `${Math.round(result.consistency)}%`,
			title: `${result.consistency.toFixed(2)}%`
		},
		{ label: 'Time', value: `${Math.round(result.time * 10) / 10}s` }
	];
</script>

<div class="w-full flex flex-col gap-8">
	<div class="grid gap-8 md:grid-cols-[auto,1fr] items-center">
		<div class="flex md:flex-col gap-8">
			<div title="{result.wpm.toFixed(2)} wpm">
				<p class="text-surface-300">WPM</p>
				<p class="text-6xl font-semibold text-primary-500">{Math.round(result.wpm)}</p>
			</div>
			<div title="{result.accuracy.toFixed(2)}%">
				<p class="text-surface-300">Accuracy</p>
				<p class="text-4xl font-semibold">{Math.round(result.accuracy)}%</p>
			</div>
		</div>

		{#if result.history.length > 1}
			<Chart history={result.history} />
		{/if}
	</div>

	<dl class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
		{#each stats as stat}
			<div title={stat.title}>
				<dt class="text-sm text-surface-300">{stat.label}</dt>
				<dd class="text-2xl font-semibold">{stat.value}</dd>
			</div>
		{/each}
	</dl>

	{#if best?.isNew}
		<p class="badge variant-soft-primary self-start gap-1.5 text-sm">
			<span aria-hidden="true">★</span>
			<span>
				New personal best{best.previous ? ` (previously ${Math.round(best.previous.wpm)} wpm)` : ''}
			</span>
		</p>
	{:else if best?.previous}
		<p class="text-sm text-surface-300">
			Personal best for {label}: {Math.round(best.previous.wpm)} wpm
		</p>
	{/if}

	<div class="flex flex-wrap justify-center gap-2">
		<button class="btn variant-filled-primary" on:click={() => dispatch('next')}>Next test</button>
		<button class="btn variant-ghost-surface" on:click={() => dispatch('repeat')}>
			Repeat test
		</button>
	</div>
</div>
