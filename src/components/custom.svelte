<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { wordsFromText } from './typing';

	/** Current custom text. */
	export let text: string;

	const dispatch = createEventDispatcher<{ save: string; cancel: void }>();

	let draft = text;
	let textarea: HTMLTextAreaElement;

	$: count = wordsFromText(draft).length;

	onMount(() => textarea.focus());

	function save() {
		if (count) dispatch('save', draft.trim());
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') dispatch('cancel');
		else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
	}
</script>

<form class="w-full flex flex-col gap-3" on:submit|preventDefault={save}>
	<label class="label">
		<span>Custom text</span>
		<textarea
			bind:this={textarea}
			bind:value={draft}
			on:keydown={onKeydown}
			class="textarea font-mono p-3"
			rows="6"
			placeholder="Paste or type the text you want to practice"
		/>
	</label>
	<p class="text-sm text-surface-300">
		{count}
		{count === 1 ? 'word' : 'words'} · line breaks and repeated spaces count as one space · Ctrl+Enter
		to save
	</p>
	<div class="flex justify-end gap-2">
		<button type="button" class="btn variant-ghost-surface" on:click={() => dispatch('cancel')}>
			Cancel
		</button>
		<button type="submit" class="btn variant-filled-primary" disabled={!count}>Save</button>
	</div>
</form>
