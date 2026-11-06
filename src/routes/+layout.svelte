<script lang="ts">
	import '../app.postcss';
</script>

<svelte:head>
	<title>Echo Type</title>
	<meta name="description" content="A minimal typing speed test." />
</svelte:head>

<div class="min-h-screen flex justify-center px-4 py-8 md:py-12">
	<div class="w-full max-w-5xl flex flex-col items-center gap-6">
		<h1 class="h1 text-center">Echo Type</h1>
		<slot />
	</div>
</div>
