<script lang="ts">
  import { X } from 'lucide-svelte'
  import {
    FREQ_MIN,
    FREQ_MAX,
    MIN_SWEEP_SPEED,
    MAX_SWEEP_SPEED,
    clampFreq,
    type RattleRecord,
  } from './consts'

  interface Props {
    rangeMin: number | null
    rangeMax: number | null
    sweepSpeed: number
    sweepCurrentFreq: number
    rattleRecords: RattleRecord[]
    rattleTestActive: boolean
    starting: boolean
    rangeError: string | null
    startRattleTest: () => void
    stopRattleTest: () => void
    onRattleClick: () => void
    clearRattleRecords: () => void
    onDeleteRattle: (id: string) => void
    onSelectRattleForManual: (r: RattleRecord) => void
  }

  let {
    rangeMin = $bindable(),
    rangeMax = $bindable(),
    sweepSpeed = $bindable(),
    sweepCurrentFreq,
    rattleRecords = $bindable(),
    rattleTestActive,
    starting,
    rangeError,
    startRattleTest,
    stopRattleTest,
    onRattleClick,
    clearRattleRecords,
    onDeleteRattle,
    onSelectRattleForManual,
  }: Props = $props()

  // Map axis covers the chosen range and every recorded rattle, so dots never
  // fall off the bar when the range is changed after recording.
  const axis = $derived.by(() => {
    const freqs = rattleRecords.map((r) => r.frequency)
    const lo = clampFreq(Number.isFinite(rangeMin) ? rangeMin! : FREQ_MIN)
    const hi = clampFreq(Number.isFinite(rangeMax) ? rangeMax! : FREQ_MAX)
    const min = Math.min(lo, hi, ...freqs)
    const max = Math.max(lo, hi, ...freqs)
    return { min, max, span: max - min || 1 }
  })

  function mapPosition(freq: number) {
    return ((freq - axis.min) / axis.span) * 100
  }
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <!-- Current frequency display -->
  <div class="mb-4 flex flex-col items-center gap-1">
    <p class="text-sm uppercase tracking-wider text-slate-500">Current</p>
    <p class="text-4xl font-bold tabular-nums text-slate-50 sm:text-5xl">
      {Math.round(sweepCurrentFreq)} Hz
    </p>
  </div>

  <!-- Range selection -->
  <div class="mb-2 flex gap-4">
    <div class="flex-1">
      <label for="range-min" class="mb-1 block text-xs text-slate-500">
        From (Hz)
      </label>
      <input
        id="range-min"
        type="number"
        inputmode="numeric"
        min={FREQ_MIN}
        max={FREQ_MAX}
        bind:value={rangeMin}
        disabled={rattleTestActive}
        class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 disabled:opacity-50"
      />
    </div>
    <div class="flex-1">
      <label for="range-max" class="mb-1 block text-xs text-slate-500">
        To (Hz)
      </label>
      <input
        id="range-max"
        type="number"
        inputmode="numeric"
        min={FREQ_MIN}
        max={FREQ_MAX}
        bind:value={rangeMax}
        disabled={rattleTestActive}
        class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 disabled:opacity-50"
      />
    </div>
  </div>
  <p class="mb-3 min-h-4 text-xs text-red-400" role="alert">
    {rangeError ?? ''}
  </p>

  <!-- Sweep speed -->
  <div class="mb-4">
    <label for="sweep-speed" class="mb-1 block text-xs text-slate-500">
      Sweep speed: {sweepSpeed} Hz/sec
    </label>
    <input
      id="sweep-speed"
      type="range"
      min={MIN_SWEEP_SPEED}
      max={MAX_SWEEP_SPEED}
      step="0.5"
      bind:value={sweepSpeed}
      class="w-full cursor-pointer accent-slate-400"
    />
  </div>

  <!-- Rattle map -->
  <div
    class="mb-4 min-h-28 flex-1 overflow-auto rounded-xl border border-slate-700 bg-slate-900/50 p-4"
  >
    <div class="mb-2 flex items-center justify-between">
      <p class="text-sm font-medium text-slate-400">Rattle Map</p>
      {#if rattleRecords.length > 0}
        <button
          type="button"
          class="btn-tactile rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-400 hover:bg-slate-800"
          onclick={clearRattleRecords}
        >
          Clear
        </button>
      {/if}
    </div>
    {#if rattleRecords.length === 0}
      <p class="text-center text-sm text-slate-500">
        No rattles recorded yet. Tap Rattle! when you hear one.
      </p>
    {:else}
      <!-- List -->
      <ul class="mb-4 flex flex-col gap-2">
        {#each rattleRecords as r (r.id)}
          <li class="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2">
            <span class="shrink-0 font-mono text-sm text-amber-400">
              {r.frequency} Hz
            </span>
            <input
              type="text"
              bind:value={r.name}
              placeholder="Name this rattle (e.g. door, dash)"
              class="min-w-0 flex-1 rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
              aria-label="Name for rattle at {r.frequency} Hz"
            />
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-700 hover:text-slate-300"
              onclick={() => onDeleteRattle(r.id)}
              aria-label="Delete rattle at {r.frequency} Hz"
            >
              <X class="h-4 w-4" />
            </button>
          </li>
        {/each}
      </ul>
      <!-- Visual frequency axis -->
      <div class="relative h-8 w-full rounded bg-slate-800">
        {#each rattleRecords as r (r.id)}
          <button
            type="button"
            class="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-amber-500 hover:ring-2 hover:ring-amber-400 hover:ring-offset-2 hover:ring-offset-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-800"
            style="left: {mapPosition(r.frequency)}%"
            title={r.name
              ? `${r.frequency} Hz – ${r.name}. Click to open in Manual.`
              : `${r.frequency} Hz. Click to open in Manual.`}
            onclick={() => onSelectRattleForManual(r)}
            aria-label="Go to Manual at {r.frequency} Hz{r.name
              ? ` (${r.name})`
              : ''}"
          ></button>
        {/each}
        <div
          class="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[10px] text-slate-500"
        >
          <span>{axis.min}</span>
          <span>{axis.max} Hz</span>
        </div>
      </div>
    {/if}
  </div>

  <button
    type="button"
    class="btn-tactile mb-4 w-full rounded-xl border-2 border-amber-500 bg-amber-500/20 py-4 text-lg font-bold text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
    onclick={onRattleClick}
    disabled={!rattleTestActive}
  >
    Rattle!
  </button>
  <button
    type="button"
    class="btn-tactile w-full rounded-xl border-2 py-4 disabled:opacity-50 {rattleTestActive
      ? 'border-red-600 bg-red-600 text-white hover:border-red-500 hover:bg-red-500'
      : 'border-emerald-600 bg-emerald-600/20 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-500/30'}"
    onclick={rattleTestActive ? stopRattleTest : startRattleTest}
    disabled={!rattleTestActive && (starting || rangeError !== null)}
  >
    {rattleTestActive ? 'Stop Test' : 'Start Test'}
  </button>
</div>
