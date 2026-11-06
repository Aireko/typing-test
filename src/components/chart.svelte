<script lang="ts">
	import type { Sample } from './typing';

	/** One sample per second; needs at least two to draw lines. */
	export let history: Sample[];

	const height = 220;
	const margin = { top: 12, right: 40, bottom: 52, left: 48 };
	const xSteps = [1, 2, 5, 10, 15, 30, 60];

	let width = 640;
	let active: number | null = null;

	$: plotBottom = height - margin.bottom;
	$: errorsY = plotBottom + 16;
	$: first = history[0].second;
	$: last = history[history.length - 1].second;
	$: scale = niceScale(Math.max(...history.map((s) => Math.max(s.wpm, s.raw))));
	$: yTicks = Array.from({ length: scale.max / scale.step + 1 }, (_, i) => i * scale.step);
	$: xStep = xSteps.find((step) => (last - first) / step <= 8) ?? 120;
	$: xTicks = Array.from(
		{ length: Math.floor(last / xStep) - Math.ceil(first / xStep) + 1 },
		(_, i) => (Math.ceil(first / xStep) + i) * xStep
	);

	$: x = (second: number) =>
		margin.left + ((second - first) / (last - first || 1)) * (width - margin.left - margin.right);
	$: y = (value: number) => margin.top + (1 - value / scale.max) * (plotBottom - margin.top);
	$: path = (key: 'wpm' | 'raw') =>
		history.map((s, i) => `${i ? 'L' : 'M'}${x(s.second)},${y(s[key])}`).join('');

	$: end = history[history.length - 1];
	// Only label the raw line's end if it won't collide with the wpm label.
	$: labelRaw = Math.abs(y(end.wpm) - y(end.raw)) >= 14;
	$: point = active === null ? null : history[active];
	// Keep the tooltip inside the chart by showing it left of the crosshair past the middle.
	$: flip = point !== null && x(point.second) > width / 2;

	function niceScale(value: number) {
		const rough = Math.max(value, 10) / 4;
		const magnitude = 10 ** Math.floor(Math.log10(rough));
		const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
		return { max: Math.ceil(Math.max(value, 10) / step) * step, step };
	}

	function onPointerMove(e: PointerEvent) {
		const px = e.clientX - (e.currentTarget as SVGElement).getBoundingClientRect().left;
		let nearest = 0;
		history.forEach((s, i) => {
			if (Math.abs(x(s.second) - px) < Math.abs(x(history[nearest].second) - px)) nearest = i;
		});
		active = nearest;
	}

	function onKeydown(e: KeyboardEvent) {
		const moves: Record<string, number> = {
			ArrowLeft: (active ?? 0) - 1,
			ArrowRight: (active ?? -1) + 1,
			Home: 0,
			End: history.length - 1
		};
		if (!(e.key in moves)) return;
		e.preventDefault();
		active = Math.max(0, Math.min(history.length - 1, moves[e.key]));
	}

	function format(value: number): string {
		return String(Math.round(value));
	}
</script>

<div class="chart flex flex-col gap-2 w-full min-w-0">
	<div class="flex justify-end gap-4 text-xs text-surface-300">
		<span class="flex items-center gap-1.5"><span class="key bg-[var(--wpm)]" />wpm</span>
		<span class="flex items-center gap-1.5"><span class="key bg-[var(--raw)]" />raw</span>
		<span class="flex items-center gap-1.5">
			<svg class="w-2 h-2" viewBox="0 0 8 8"><path class="cross" d="M1,1L7,7M7,1L1,7" /></svg>
			errors
		</span>
	</div>

	<div class="relative" bind:clientWidth={width}>
		<!-- Focus and arrow keys show the same tooltip as hover; the data table below covers screen readers. -->
		<!-- svelte-ignore a11y-no-noninteractive-tabindex a11y-no-noninteractive-element-interactions -->
		<!-- 100% width so the chart follows its container instead of propping it open. -->
		<svg
			width="100%"
			{height}
			viewBox="0 0 {width} {height}"
			class="block overflow-visible outline-none focus-visible:ring-2 ring-primary-500 rounded"
			role="img"
			tabindex="0"
			aria-label="Speed over time: wpm and raw speed per second, with errors marked. Use arrow keys to read values."
			on:pointermove={onPointerMove}
			on:pointerleave={() => (active = null)}
			on:focus={() => (active = history.length - 1)}
			on:blur={() => (active = null)}
			on:keydown={onKeydown}
		>
			{#each yTicks as tick}
				<line
					class={tick === 0 ? 'baseline' : 'grid'}
					x1={margin.left}
					x2={width - margin.right}
					y1={y(tick)}
					y2={y(tick)}
				/>
				<text class="tick" x={margin.left - 8} y={y(tick)} text-anchor="end" dy="0.32em">
					{tick}
				</text>
			{/each}

			{#each xTicks as tick}
				<text class="tick" x={x(tick)} y={height - 8} text-anchor="middle">{tick}s</text>
			{/each}

			<text class="tick" x={margin.left - 8} y={errorsY} text-anchor="end" dy="0.32em">errors</text>
			{#each history as s}
				{#if s.errors}
					<path class="cross" d="M{x(s.second) - 3},{errorsY - 3}l6,6m0,-6l-6,6" />
				{/if}
			{/each}

			<path class="line raw" d={path('raw')} />
			<path class="line wpm" d={path('wpm')} />

			<text class="end-label" x={x(end.second) + 8} y={y(end.wpm)} dy="0.32em">
				{format(end.wpm)}
			</text>
			{#if labelRaw}
				<text class="end-label" x={x(end.second) + 8} y={y(end.raw)} dy="0.32em">
					{format(end.raw)}
				</text>
			{/if}

			{#if point}
				<line
					class="crosshair"
					x1={x(point.second)}
					x2={x(point.second)}
					y1={margin.top}
					y2={errorsY + 6}
				/>
				<circle class="dot raw" cx={x(point.second)} cy={y(point.raw)} r="4" />
				<circle class="dot wpm" cx={x(point.second)} cy={y(point.wpm)} r="4" />
			{/if}
		</svg>

		{#if point}
			<div
				class="tooltip absolute pointer-events-none rounded-container-token px-3 py-2 text-xs"
				style="top: {margin.top}px; left: {x(point.second)}px; transform: translateX({flip
					? 'calc(-100% - 12px)'
					: '12px'})"
			>
				<p class="mb-1 text-surface-300">{point.second}s</p>
				<p class="row"><span class="line-key bg-[var(--wpm)]" /><b>{format(point.wpm)}</b> wpm</p>
				<p class="row"><span class="line-key bg-[var(--raw)]" /><b>{format(point.raw)}</b> raw</p>
				<p class="row"><span class="line-key bg-[var(--errors)]" /><b>{point.errors}</b> errors</p>
			</div>
		{/if}
	</div>

	<details class="text-sm text-surface-300">
		<summary class="cursor-pointer w-fit">Show data table</summary>
		<div class="max-h-48 overflow-y-auto mt-2">
			<table class="w-full text-right tabular-nums">
				<thead>
					<tr class="text-surface-400"><th>second</th><th>wpm</th><th>raw</th><th>errors</th></tr>
				</thead>
				<tbody>
					{#each history as s}
						<tr
							><td>{s.second}</td><td>{format(s.wpm)}</td><td>{format(s.raw)}</td><td>{s.errors}</td
							></tr
						>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
</div>

<style>
	.chart {
		--surface: rgb(var(--color-surface-800));
		--wpm: rgb(var(--color-primary-500));
		--raw: rgb(var(--color-surface-400));
		--errors: #c98500;
	}

	.key {
		width: 0.875rem;
		height: 2px;
		border-radius: 1px;
	}

	.grid {
		stroke: rgb(var(--color-surface-700));
		stroke-width: 1;
	}

	.baseline {
		stroke: rgb(var(--color-surface-500));
		stroke-width: 1;
	}

	.tick {
		fill: rgb(var(--color-surface-300));
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	.end-label {
		fill: rgb(var(--color-surface-200));
		font-size: 12px;
		font-weight: 600;
	}

	.line {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.line.wpm {
		stroke: var(--wpm);
	}

	.line.raw {
		stroke: var(--raw);
	}

	/* The surface-colored ring keeps dots legible where they sit on a line. */
	.dot {
		stroke: var(--surface);
		stroke-width: 2;
	}

	.dot.wpm {
		fill: var(--wpm);
	}

	.dot.raw {
		fill: var(--raw);
	}

	.cross {
		fill: none;
		stroke: var(--errors);
		stroke-width: 2;
		stroke-linecap: round;
	}

	.crosshair {
		stroke: rgb(var(--color-surface-400));
		stroke-width: 1;
	}

	.tooltip {
		background: rgb(var(--color-surface-900));
		border: 1px solid rgb(var(--color-surface-600));
		white-space: nowrap;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		color: rgb(var(--color-surface-300));
	}

	.row b {
		color: rgb(var(--color-surface-50));
	}

	.line-key {
		width: 0.75rem;
		height: 2px;
		border-radius: 1px;
	}

	th,
	td {
		padding: 0.125rem 0.5rem;
		font-weight: normal;
	}
</style>
