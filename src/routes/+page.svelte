<script lang="ts">
	import { onMount } from 'svelte';
	import Test from '../components/test.svelte';
	import Results from '../components/results.svelte';
	import Custom from '../components/custom.svelte';
	import {
		batchSize,
		countOptions,
		defaultSettings,
		generateWords,
		loadSettings,
		saveSettings,
		testLabel,
		timeOptions,
		updateBest,
		wordsFromText,
		type Best,
		type Mode,
		type Result,
		type Settings
	} from '../components/typing';

	const modes: { mode: Mode; label: string }[] = [
		{ mode: 'time', label: 'Time' },
		{ mode: 'count', label: 'Words' },
		{ mode: 'custom', label: 'Custom' }
	];

	let settings: Settings = { ...defaultSettings };
	// Words are random, so they're only generated in the browser to avoid a hydration mismatch.
	let ready = false;
	let words: string[] = [];
	let testId = 0;
	let running = false;
	let editing = false;
	let result: Result | null = null;
	let best: { previous?: Best; isNew: boolean } | null = null;

	$: label = testLabel(settings);

	onMount(() => {
		settings = loadSettings();
		ready = true;
		newTest();
	});

	function newTest() {
		if (settings.mode === 'custom') {
			words = wordsFromText(settings.customText);
			if (!words.length) words = wordsFromText(defaultSettings.customText);
		} else {
			words = generateWords(settings.mode === 'count' ? settings.count : batchSize, settings);
		}
		repeatTest();
	}

	function repeatTest() {
		result = null;
		best = null;
		editing = false;
		running = false;
		testId++;
	}

	function change(changes: Partial<Settings>) {
		settings = { ...settings, ...changes };
		saveSettings(settings);
		newTest();
	}

	function moreWords() {
		words = [...words, ...generateWords(batchSize, settings, words[words.length - 1])];
	}

	function onFinish(e: CustomEvent<Result>) {
		result = e.detail;
		best = settings.mode === 'custom' ? null : updateBest(label, result);
	}

	function onKeydown(e: KeyboardEvent) {
		if (editing || !ready) return;

		// Tab only restarts from the test itself, so keyboard users can still tab through the controls.
		const target = e.target;
		const fromTest =
			target === document.body ||
			(target instanceof HTMLElement && target.hasAttribute('data-typing-input'));
		if (e.key === 'Escape' || (e.key === 'Tab' && !e.shiftKey && fromTest)) {
			e.preventDefault();
			newTest();
		}
	}

	function option(active: boolean): string {
		return active
			? 'btn btn-sm px-3 text-primary-500'
			: 'btn btn-sm px-3 text-surface-300 hover:text-surface-50';
	}
</script>

<svelte:window on:keydown={onKeydown} />

<div
	class="card w-full p-2 flex flex-wrap items-center justify-center gap-y-1 text-sm transition-opacity duration-300"
	class:opacity-0={running || !ready}
	class:pointer-events-none={running}
>
	{#if settings.mode !== 'custom'}
		<div class="flex">
			<button
				class={option(settings.punctuation)}
				aria-pressed={settings.punctuation}
				on:click={() => change({ punctuation: !settings.punctuation })}
			>
				@ punctuation
			</button>
			<button
				class={option(settings.numbers)}
				aria-pressed={settings.numbers}
				on:click={() => change({ numbers: !settings.numbers })}
			>
				# numbers
			</button>
		</div>
		<span class="divider-vertical h-6 mx-2 hidden sm:inline-block" />
	{/if}

	<div class="flex">
		{#each modes as { mode, label }}
			<button
				class={option(settings.mode === mode)}
				aria-pressed={settings.mode === mode}
				on:click={() => change({ mode })}
			>
				{label}
			</button>
		{/each}
	</div>

	<span class="divider-vertical h-6 mx-2 hidden sm:inline-block" />

	<div class="flex">
		{#if settings.mode === 'time'}
			{#each timeOptions as time}
				<button
					class={option(settings.time === time)}
					aria-pressed={settings.time === time}
					aria-label="{time} seconds"
					on:click={() => change({ time })}
				>
					{time}
				</button>
			{/each}
		{:else if settings.mode === 'count'}
			{#each countOptions as count}
				<button
					class={option(settings.count === count)}
					aria-pressed={settings.count === count}
					aria-label="{count} words"
					on:click={() => change({ count })}
				>
					{count}
				</button>
			{/each}
		{:else}
			<button class={option(editing)} aria-pressed={editing} on:click={() => (editing = true)}>
				Edit text
			</button>
		{/if}
	</div>
</div>

<!-- Game Container -->
<div class="card w-full flex-grow flex justify-center items-center p-6 md:p-10 min-h-[20rem]">
	<div class="w-full max-w-4xl">
		{#if !ready}
			<!-- Nothing to show until the words are generated in the browser. -->
		{:else if editing}
			<Custom
				text={settings.customText}
				on:save={(e) => change({ customText: e.detail })}
				on:cancel={() => (editing = false)}
			/>
		{:else if result}
			<Results {result} {label} {best} on:next={newTest} on:repeat={repeatTest} />
		{:else}
			{#key testId}
				<Test
					{words}
					timeLimit={settings.mode === 'time' ? settings.time : 0}
					bind:running
					on:more={moreWords}
					on:finish={onFinish}
					on:restart={newTest}
				/>
			{/key}
		{/if}
	</div>
</div>

<p
	class="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-surface-400 transition-opacity duration-300"
	class:opacity-0={running}
>
	<span><kbd class="kbd">tab</kbd> or <kbd class="kbd">esc</kbd> new test</span>
	<span><kbd class="kbd">ctrl</kbd> + <kbd class="kbd">backspace</kbd> delete word</span>
</p>
