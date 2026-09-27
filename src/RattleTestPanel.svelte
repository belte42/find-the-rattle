<script lang="ts">
  import {
    ArrowDown,
    ArrowUp,
    Check,
    Minus,
    Pause,
    Play,
    Plus,
    Repeat,
  } from 'lucide-svelte'
  import { autoRepeat } from './lib/autoRepeat'
  import {
    FREQ_MIN,
    FREQ_MAX,
    MIN_SWEEP_SPEED,
    MAX_SWEEP_SPEED,
    WEAK_BASS_HZ,
    clampFreq,
    type RattleRecord,
    type TestState,
  } from './consts'

  interface Props {
    rangeMin: number | null
    rangeMax: number | null
    sweepSpeed: number
    loop: boolean
    rattleRecords: RattleRecord[]
    testState: TestState
    starting: boolean
    rangeError: string | null
    sweepCurrentFreq: number
    sweepDirection: 1 | -1 | 0
    /** Set while refining around a saved rattle */
    refine: { lo: number; hi: number; name: string } | null
    lastMark: { frequency: number; count: number } | null
    onStart: () => void
    onStop: () => void
    onHold: () => void
    onResume: () => void
    onNudge: (delta: number) => void
    onSaveHeld: () => void
    onMark: () => void
    onClear: () => void
    onDelete: (id: string) => void
    onToggleFixed: (id: string) => void
    onRefine: (r: RattleRecord) => void
    onSelectForManual: (r: RattleRecord) => void
  }

  let {
    rangeMin = $bindable(),
    rangeMax = $bindable(),
    sweepSpeed = $bindable(),
    loop = $bindable(),
    rattleRecords = $bindable(),
    testState,
    starting,
    rangeError,
    sweepCurrentFreq,
    sweepDirection,
    refine,
    lastMark,
    onStart,
    onStop,
    onHold,
    onResume,
    onNudge,
    onSaveHeld,
    onMark,
    onClear,
    onDelete,
    onToggleFixed,
    onRefine,
    onSelectForManual,
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

  function onMarkKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onMark()
    }
  }
</script>

{#snippet speedSlider()}
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
{/snippet}

{#snippet stopButton()}
  <button
    type="button"
    class="btn-tactile flex-1 rounded-xl border-2 border-red-600 bg-red-600 py-4 text-white hover:bg-red-500"
    onclick={onStop}
  >
    Stop
  </button>
{/snippet}

<div class="flex min-h-0 flex-1 flex-col">
  {#if testState === 'idle'}
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
          class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
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
          class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
        />
      </div>
    </div>
    {#if rangeError}
      <p class="mb-3 text-xs text-red-400" role="alert">{rangeError}</p>
    {:else if (rangeMin ?? 0) < WEAK_BASS_HZ}
      <p class="mb-3 text-xs text-slate-500">
        Tip: many car speakers produce little below ~{WEAK_BASS_HZ} Hz, so rattles
        there may not show up.
      </p>
    {:else}
      <div class="mb-3"></div>
    {/if}

    {@render speedSlider()}

    <button
      type="button"
      class="mb-4 flex items-center gap-2 self-start rounded-lg border-2 px-3 py-2 text-sm {loop
        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
        : 'border-slate-700 text-slate-400'}"
      aria-pressed={loop}
      onclick={() => (loop = !loop)}
    >
      <Repeat class="h-4 w-4" />
      Loop (sweep up and back down)
    </button>

    <!-- Rattle map -->
    <div
      class="mb-4 min-h-28 flex-1 overflow-auto rounded-xl border border-slate-700 bg-slate-900/50 p-3"
    >
      <div class="mb-2 flex items-center justify-between">
        <p class="text-sm font-medium text-slate-400">Rattle Map</p>
        {#if rattleRecords.length > 0}
          <button
            type="button"
            class="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-400 hover:bg-slate-800"
            onclick={onClear}
          >
            Clear
          </button>
        {/if}
      </div>
      {#if rattleRecords.length === 0}
        <p class="text-center text-sm text-slate-500">
          No rattles recorded yet. Start a test and tap the pad when something
          rattles.
        </p>
      {:else}
        <!-- Visual frequency axis -->
        <div class="relative mb-3 h-8 w-full rounded bg-slate-800">
          {#each rattleRecords as r (r.id)}
            <button
              type="button"
              class="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-amber-400 {r.fixed
                ? 'bg-emerald-600'
                : 'bg-amber-500'}"
              style="left: {mapPosition(r.frequency)}%"
              title={r.name ? `${r.frequency} Hz – ${r.name}` : `${r.frequency} Hz`}
              onclick={() => onSelectForManual(r)}
              aria-label="Open {r.frequency} Hz{r.name ? ` (${r.name})` : ''} in Manual"
            ></button>
          {/each}
          <div
            class="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[10px] text-slate-500"
          >
            <span>{axis.min}</span>
            <span>{axis.max} Hz</span>
          </div>
        </div>
        <!-- List -->
        <ul class="flex flex-col gap-2">
          {#each rattleRecords as r (r.id)}
            <li class="rounded-lg bg-slate-800 px-3 py-2 {r.fixed ? 'opacity-60' : ''}">
              <div class="flex items-center gap-2">
                <span
                  class="w-14 shrink-0 font-mono text-sm {r.fixed
                    ? 'text-emerald-400 line-through'
                    : 'text-amber-400'}"
                >
                  {r.frequency} Hz
                </span>
                <input
                  type="text"
                  bind:value={r.name}
                  placeholder="Where? (e.g. left door)"
                  class="min-w-0 flex-1 rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
                  aria-label="Name for rattle at {r.frequency} Hz"
                />
              </div>
              <div class="mt-2 flex gap-1 text-xs">
                <button
                  type="button"
                  class="rounded px-2 py-1.5 text-sky-400 hover:bg-slate-700"
                  onclick={() => onRefine(r)}
                >
                  Refine
                </button>
                <button
                  type="button"
                  class="rounded px-2 py-1.5 text-slate-300 hover:bg-slate-700"
                  onclick={() => onSelectForManual(r)}
                >
                  Play
                </button>
                <button
                  type="button"
                  class="rounded px-2 py-1.5 hover:bg-slate-700 {r.fixed
                    ? 'text-emerald-400'
                    : 'text-slate-300'}"
                  aria-pressed={r.fixed}
                  onclick={() => onToggleFixed(r.id)}
                >
                  {r.fixed ? '✓ Fixed' : 'Mark fixed'}
                </button>
                <button
                  type="button"
                  class="ml-auto rounded px-2 py-1.5 text-slate-500 hover:bg-slate-700 hover:text-red-400"
                  onclick={() => onDelete(r.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <button
      type="button"
      class="btn-tactile w-full rounded-xl border-2 border-emerald-600 bg-emerald-600/20 py-4 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
      onclick={onStart}
      disabled={starting || rangeError !== null}
    >
      Start Test
    </button>
  {:else if testState === 'running'}
    <!-- Current frequency -->
    <div class="mb-3 flex flex-col items-center">
      <p class="text-xs uppercase tracking-wider text-slate-500">
        {refine ? `Refining ${refine.lo}–${refine.hi} Hz` : 'Sweeping'}
      </p>
      <p
        class="flex items-center gap-2 text-5xl font-bold tabular-nums text-slate-50"
      >
        {Math.round(sweepCurrentFreq)} Hz
        {#if sweepDirection === 1}
          <ArrowUp class="h-7 w-7 text-slate-500" aria-label="going up" />
        {:else if sweepDirection === -1}
          <ArrowDown class="h-7 w-7 text-slate-500" aria-label="going down" />
        {/if}
      </p>
    </div>

    {@render speedSlider()}

    <!-- Big tap pad: easy to hit while leaning into the car -->
    <div
      class="mb-4 flex min-h-40 flex-1 cursor-pointer select-none flex-col items-center justify-center rounded-2xl border-2 border-amber-500 bg-amber-500/15 p-4 text-center active:bg-amber-500/30"
      style="touch-action: none"
      role="button"
      tabindex="0"
      aria-label="Mark rattle at current frequency"
      onpointerdown={onMark}
      onkeydown={onMarkKey}
    >
      <p class="text-2xl font-bold text-amber-300">Rattle!</p>
      <p class="mt-1 text-sm text-amber-200/70">
        Tap anywhere here when something rattles
      </p>
      {#if lastMark}
        {#key lastMark.count}
          <p class="mark-flash mt-3 flex items-center gap-1 text-sm font-semibold text-emerald-300">
            <Check class="h-4 w-4" /> Marked {lastMark.frequency} Hz
          </p>
        {/key}
      {/if}
    </div>

    <div class="flex gap-3">
      <button
        type="button"
        class="btn-tactile flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-sky-500 bg-sky-500/15 py-4 text-sky-300"
        onclick={onHold}
      >
        <Pause class="h-5 w-5" /> Hold
      </button>
      {@render stopButton()}
    </div>
  {:else}
    <!-- Holding: fine-tune around the frozen frequency -->
    <div class="flex flex-1 flex-col items-center justify-center">
      <p class="mb-2 text-xs uppercase tracking-wider text-sky-400">Holding</p>
      <div class="mb-3 flex w-full items-center justify-between gap-3">
        <button
          type="button"
          class="flex h-20 w-20 shrink-0 select-none items-center justify-center rounded-2xl border-2 border-slate-600 bg-slate-800 active:bg-slate-700"
          use:autoRepeat={() => onNudge(-1)}
          aria-label="Down 1 Hz"
        >
          <Minus class="h-8 w-8" />
        </button>
        <p class="text-5xl font-bold tabular-nums text-slate-50">
          {Math.round(sweepCurrentFreq)} Hz
        </p>
        <button
          type="button"
          class="flex h-20 w-20 shrink-0 select-none items-center justify-center rounded-2xl border-2 border-slate-600 bg-slate-800 active:bg-slate-700"
          use:autoRepeat={() => onNudge(1)}
          aria-label="Up 1 Hz"
        >
          <Plus class="h-8 w-8" />
        </button>
      </div>
      <p class="mb-4 text-center text-sm text-slate-500">
        Nudge until the rattle is loudest, then press on panels to find it.
      </p>
      {#if lastMark}
        {#key lastMark.count}
          <p class="mark-flash mb-2 flex items-center gap-1 text-sm font-semibold text-emerald-300">
            <Check class="h-4 w-4" /> Saved {lastMark.frequency} Hz
          </p>
        {/key}
      {/if}
    </div>

    <button
      type="button"
      class="btn-tactile mb-3 w-full rounded-xl border-2 border-amber-500 bg-amber-500/15 py-4 text-lg font-bold text-amber-300"
      onclick={onSaveHeld}
    >
      Save {Math.round(sweepCurrentFreq)} Hz
    </button>
    <div class="flex gap-3">
      <button
        type="button"
        class="btn-tactile flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-emerald-600 bg-emerald-600/20 py-4 text-emerald-300"
        onclick={onResume}
      >
        <Play class="h-5 w-5" /> Resume
      </button>
      {@render stopButton()}
    </div>
  {/if}
</div>

<style>
  .mark-flash {
    animation: flash 0.6s ease-out;
  }
  @keyframes flash {
    from {
      transform: scale(1.25);
      opacity: 0.4;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
