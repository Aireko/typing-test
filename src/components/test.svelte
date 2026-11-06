<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';
	import {
		batchSize,
		consistency,
		countChars,
		maxExtraLetters,
		wpm,
		type Result,
		type Sample
	} from './typing';

	/** Words to type. In time mode the parent keeps appending to this list on `more`. */
	export let words: string[];
	/** Test length in seconds; 0 means the test ends when the last word is typed. */
	export let timeLimit = 0;
	/** True while the test is in progress. */
	export let running = false;

	const dispatch = createEventDispatcher<{ more: void; finish: Result; restart: void }>();

	type LetterState = 'correct' | 'incorrect' | 'extra' | 'pending';

	const letterClasses: Record<LetterState, string> = {
		correct: 'text-surface-50',
		incorrect: 'text-error-500',
		extra: 'text-error-700',
		pending: 'text-surface-400'
	};

	// What was typed for each word so far; the last entry is the word in progress.
	let typed: string[] = [''];
	let current = 0;
	let status: 'idle' | 'running' | 'finished' = 'idle';
	let startTime = 0;
	let elapsed = 0;
	let liveWpm = 0;
	let timer: ReturnType<typeof setInterval> | undefined;

	// Every keystroke, for accuracy and the per-second chart.
	let keystrokes: { time: number; correct: boolean }[] = [];
	// Net wpm at the end of each full second.
	let snapshots: number[] = [];

	let input: HTMLInputElement;
	let container: HTMLElement;
	let wordElements: HTMLElement[] = [];
	let focused = false;
	let caret = { x: 0, y: 0 };
	let offset = 0;

	$: running = status === 'running';
	$: remaining = Math.max(0, Math.ceil(timeLimit - elapsed));

	onMount(() => {
		input.focus();
		refresh();
		document.fonts?.ready.then(refresh);
	});

	onDestroy(() => clearInterval(timer));

	function letters(word: string, value: string): string[] {
		return (word + value.slice(word.length)).split('');
	}

	function letterState(word: string, value: string, j: number): LetterState {
		if (j >= word.length) return 'extra';
		if (j >= value.length) return 'pending';
		return value[j] === word[j] ? 'correct' : 'incorrect';
	}

	function secondsSince(now: number): number {
		return (now - startTime) / 1000;
	}

	function start(now: number) {
		status = 'running';
		startTime = now;
		timer = setInterval(update, 100);
	}

	function update() {
		elapsed = secondsSince(performance.now());
		const net = wpm(countChars(words, typed, current).wordChars, elapsed);

		const fullSeconds = Math.floor(timeLimit ? Math.min(elapsed, timeLimit) : elapsed);
		if (snapshots.length < fullSeconds) {
			snapshots = [...snapshots, ...Array(fullSeconds - snapshots.length).fill(net)];
			liveWpm = Math.round(net);
		}

		if (timeLimit && elapsed >= timeLimit) finish();
	}

	/** Returns true if the key should be ignored because the time ran out. */
	function timeUp(now: number): boolean {
		if (timeLimit && secondsSince(now) >= timeLimit) {
			finish();
			return true;
		}
		return false;
	}

	function insert(char: string) {
		const now = performance.now();
		if (status === 'idle') start(now);
		else if (timeUp(now)) return;

		const target = words[current];
		const value = typed[current];
		if (value.length >= target.length + maxExtraLetters) return;

		keystrokes.push({ time: secondsSince(now), correct: char === target[value.length] });
		typed[current] = value + char;

		// The last word finishes the test as soon as it's typed correctly, no space needed.
		if (!timeLimit && current === words.length - 1 && typed[current] === target) finish();
	}

	function space() {
		const now = performance.now();
		if (status !== 'running' || typed[current] === '' || timeUp(now)) return;

		keystrokes.push({ time: secondsSince(now), correct: typed[current] === words[current] });
		current++;
		if (current === words.length) return finish();

		typed = [...typed, ''];
		if (timeLimit && words.length - current < batchSize / 2) dispatch('more');
	}

	function backspace(wholeWord: boolean) {
		if (status !== 'running') return;

		if (typed[current] !== '') {
			typed[current] = wholeWord ? '' : typed[current].slice(0, -1);
			return;
		}

		// Going back is only allowed into a previous word that has mistakes.
		if (current === 0 || typed[current - 1] === words[current - 1]) return;
		typed = typed.slice(0, -1);
		current--;
		if (wholeWord) typed[current] = '';
	}

	function finish() {
		if (status === 'finished') return;
		clearInterval(timer);

		const time = timeLimit || secondsSince(performance.now());
		const chars = countChars(words, typed, current);
		const net = wpm(chars.wordChars, time);
		const history = buildHistory(time, net);
		const correctKeys = keystrokes.filter((k) => k.correct).length;

		status = 'finished';
		elapsed = time;
		dispatch('finish', {
			wpm: net,
			raw: wpm(chars.typedChars, time),
			accuracy: keystrokes.length ? (correctKeys / keystrokes.length) * 100 : 0,
			consistency: consistency(history.map((s) => s.raw)),
			correct: chars.correct,
			incorrect: chars.incorrect,
			extra: chars.extra,
			missed: chars.missed,
			time,
			history
		});
	}

	/** Buckets keystrokes into one sample per second for the results chart. */
	function buildHistory(time: number, finalWpm: number): Sample[] {
		const fullSeconds = Math.floor(time);
		const partial = time - fullSeconds;
		// A trailing fraction of a second only gets its own sample if it's long enough to be meaningful;
		// otherwise it's folded into the last full second. Either way the last sample ends at `time`.
		const buckets = partial >= 0.5 || fullSeconds === 0 ? fullSeconds + 1 : fullSeconds;

		const samples: Sample[] = Array.from({ length: buckets }, (_, i) => ({
			second: i + 1,
			wpm: snapshots[i] ?? finalWpm,
			raw: 0,
			errors: 0
		}));
		const last = samples[buckets - 1];
		last.second = Math.round(time * 100) / 100;
		last.wpm = finalWpm;

		const keys = Array(buckets).fill(0);
		for (const k of keystrokes) {
			const i = Math.min(Math.floor(k.time), buckets - 1);
			keys[i]++;
			if (!k.correct) samples[i].errors++;
		}
		samples.forEach((s, i) => {
			const duration = (i === buckets - 1 ? time : s.second) - i;
			s.raw = wpm(keys[i], duration > 0 ? duration : 1);
		});

		return samples;
	}

	async function refresh() {
		await tick();
		const word = wordElements[current];
		if (!word || !container) return;

		const letterElements = word.children as HTMLCollectionOf<HTMLElement>;
		const index = typed[current].length;
		const letter = letterElements[Math.min(index, letterElements.length - 1)];
		caret = {
			x: letter.offsetLeft + (index < letterElements.length ? 0 : letter.offsetWidth),
			y: word.offsetTop
		};

		// Keep the current line as the second visible line once the first one is done.
		const line = Math.round(word.offsetTop / word.offsetHeight);
		offset = Math.max(0, line - 1) * word.offsetHeight;
	}

	function onKeydown(e: KeyboardEvent) {
		if (status === 'finished' || e.isComposing) return;

		// AltGr shows up as Ctrl+Alt on Windows and is needed for some characters.
		const ctrl = e.ctrlKey && !e.altKey;
		if (e.key === 'Backspace') backspace(e.ctrlKey || e.altKey || e.metaKey);
		else if (e.key === ' ') space();
		else if (e.key.length === 1 && !ctrl && !e.metaKey) insert(e.key);
		else return;

		e.preventDefault();
		refresh();
	}

	// Fallback for keyboards that don't report keys on keydown, like many on-screen ones.
	function onInput(e: Event) {
		if ((e as InputEvent).isComposing) return;
		flushInput();
	}

	function flushInput() {
		const value = input.value;
		input.value = '';
		if (status === 'finished') return;

		for (const char of value) {
			if (char === ' ') space();
			else insert(char);
		}
		refresh();
	}

	// Let the user start typing without clicking first.
	function onWindowKeydown(e: KeyboardEvent) {
		if (e.target === input || status === 'finished') return;
		const field = 'input, textarea, select, [contenteditable]';
		if (e.target instanceof Element && e.target.closest(field)) return;
		if (e.key.length !== 1 && e.key !== 'Backspace') return;
		if ((e.ctrlKey && !e.altKey) || e.metaKey) return;

		input.focus();
		onKeydown(e);
	}

	function focus() {
		input.focus();
	}
</script>

<svelte:window on:keydown={onWindowKeydown} on:resize={refresh} />

<div class="w-full flex flex-col gap-4 font-mono">
	<div
		class="flex items-baseline gap-6 text-2xl md:text-3xl text-primary-500 transition-opacity"
		class:opacity-0={status !== 'running'}
	>
		<span>{timeLimit ? remaining : `${current}/${words.length}`}</span>
		<span class="text-lg md:text-xl text-surface-400">{liveWpm} wpm</span>
	</div>

	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div
		class="relative text-2xl/[1.5em] md:text-3xl/[1.5em] h-[4.5em] overflow-hidden"
		on:click={focus}
	>
		<input
			bind:this={input}
			on:keydown={onKeydown}
			on:input={onInput}
			on:compositionend={flushInput}
			on:focus={() => (focused = true)}
			on:blur={() => (focused = false)}
			data-typing-input
			class="absolute top-0 left-0 w-px h-px opacity-0 text-base"
			aria-label="Type the words shown"
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
		/>

		<div
			bind:this={container}
			class="relative flex flex-wrap transition-transform duration-150 ease-out select-none"
			class:blur-sm={!focused}
			style="transform: translateY(-{offset}px)"
		>
			{#each words as word, i}
				<div
					bind:this={wordElements[i]}
					class="mr-[0.6em] {i < current && typed[i] !== word
						? 'underline decoration-error-500 decoration-2 underline-offset-[0.3em]'
						: ''}"
				>
					{#each letters(word, typed[i] ?? '') as letter, j}
						<span class={letterClasses[letterState(word, typed[i] ?? '', j)]}>{letter}</span>
					{/each}
				</div>
			{/each}

			{#if focused}
				<span
					class="caret absolute top-0 left-0 w-[0.1em] h-[1.1em] mt-[0.2em] -ml-[0.05em] rounded-full bg-primary-500"
					class:blink={status === 'idle'}
					style="transform: translate({caret.x}px, {caret.y}px)"
				/>
			{/if}
		</div>

		{#if !focused}
			<button
				class="absolute inset-0 flex items-center justify-center text-base font-sans text-surface-200"
				on:click={focus}
			>
				Click here or start typing to focus
			</button>
		{/if}
	</div>

	<div class="flex justify-center">
		<button
			class="btn-icon btn-icon-sm text-surface-400 hover:text-surface-50"
			title="Restart test"
			aria-label="Restart test"
			on:click={() => dispatch('restart')}
		>
			<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M3 12a9 9 0 1 0 3-6.7L3 8" stroke-linecap="round" stroke-linejoin="round" />
				<path d="M3 3v5h5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>
	</div>
</div>

<style>
	.caret {
		transition: transform 90ms ease-out;
	}

	.blink {
		animation: blink 1s step-end infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
</style>
