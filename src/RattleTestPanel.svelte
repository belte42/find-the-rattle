<script lang="ts">
  import {
    ArrowDown,
    ArrowUp,
    Check,
    Minus,
    Pause,
    Play,
    Plus,
    Square,
  } from 'lucide-svelte'
  import { autoRepeat } from './lib/autoRepeat'
  import IosSwitch from './IosSwitch.svelte'
  import {
    FREQ_MIN,
    FREQ_MAX,
    MIN_SWEEP_SPEED,
    MAX_SWEEP_SPEED,
    WEAK_BASS_HZ,
    clampFreq,
    percent,
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
  <div>
    <div class="flex items-baseline justify-between">
      <label for="sweep-speed">Speed</label>
      <span class="text-ios-label2 tabular-nums">{sweepSpeed} Hz/s</span>
    </div>
    <input
      id="sweep-speed"
      type="range"
      min={MIN_SWEEP_SPEED}
      max={MAX_SWEEP_SPEED}
      step="0.5"
      bind:value={sweepSpeed}
      class="ios-range"
      style="--pct: {percent(sweepSpeed, MIN_SWEEP_SPEED, MAX_SWEEP_SPEED)}"
    />
  </div>
{/snippet}

{#snippet bigReadout(caption: string, captionClass = 'text-ios-label2')}
  <div class="flex flex-col items-center">
    <p class="flex items-center gap-1 text-footnote {captionClass}">
      {caption}
      {#if testState === 'running' && sweepDirection === 1}
        <ArrowUp class="h-4 w-4" aria-label="going up" />
      {:else if testState === 'running' && sweepDirection === -1}
        <ArrowDown class="h-4 w-4" aria-label="going down" />
      {/if}
    </p>
    <p
      class="font-rounded text-[56px] leading-[64px] font-bold tabular-nums tracking-tight"
    >
      {Math.round(sweepCurrentFreq)}<span
        class="ml-1 text-[26px] font-semibold text-ios-label2">Hz</span
      >
    </p>
  </div>
{/snippet}

{#snippet stopButton()}
  <button
    type="button"
    class="ios-btn flex-1 bg-ios-red text-white"
    onclick={onStop}
  >
    <Square class="h-5 w-5 fill-current" /> Stop
  </button>
{/snippet}

<div class="flex min-h-0 flex-1 flex-col">
  {#if testState === 'idle'}
    <!-- Sweep settings -->
    <p class="ios-section-header mt-4">Sweep</p>
    <div class="ios-group">
      <label class="ios-row">
        <span class="flex-1">From</span>
        <input
          type="number"
          inputmode="numeric"
          min={FREQ_MIN}
          max={FREQ_MAX}
          bind:value={rangeMin}
          class="w-20 bg-transparent text-right text-ios-label2 tabular-nums outline-none"
        />
        <span class="text-ios-label2">Hz</span>
      </label>
      <label class="ios-row">
        <span class="flex-1">To</span>
        <input
          type="number"
          inputmode="numeric"
          min={FREQ_MIN}
          max={FREQ_MAX}
          bind:value={rangeMax}
          class="w-20 bg-transparent text-right text-ios-label2 tabular-nums outline-none"
        />
        <span class="text-ios-label2">Hz</span>
      </label>
      <div class="ios-row block">
        {@render speedSlider()}
      </div>
      <div class="ios-row">
        <div class="min-w-0 flex-1">
          <p>Loop</p>
          <p class="text-footnote text-ios-label2">Sweep up and back down</p>
        </div>
        <IosSwitch checked={loop} label="Loop" onchange={(v) => (loop = v)} />
      </div>
    </div>
    {#if rangeError}
      <p class="ios-section-footer text-ios-red!" role="alert">{rangeError}</p>
    {:else if (rangeMin ?? 0) < WEAK_BASS_HZ}
      <p class="ios-section-footer">
        Many car speakers produce little below ~{WEAK_BASS_HZ} Hz, so rattles there
        may not show up.
      </p>
    {/if}

    <!-- Rattle map -->
    <div class="mt-6 mb-1.5 flex items-baseline justify-between px-4">
      <p class="text-footnote text-ios-label2 uppercase">Rattle map</p>
      {#if rattleRecords.length > 0}
        <button
          type="button"
          class="text-subhead text-ios-blue active:opacity-50"
          onclick={onClear}
        >
          Clear
        </button>
      {/if}
    </div>
    <div class="ios-group mb-6 min-h-28 flex-1 overflow-auto">
      {#if rattleRecords.length === 0}
        <p class="ios-row text-ios-label2">
          No rattles yet. Start a test and tap the pad when something rattles.
        </p>
      {:else}
        <!-- Visual frequency axis -->
        <div class="ios-row block">
          <div class="relative h-8 w-full rounded-lg bg-ios-card2">
            {#each rattleRecords as r (r.id)}
              <button
                type="button"
                class="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ios-blue {r.fixed
                  ? 'bg-ios-green'
                  : 'bg-ios-orange'}"
                style="left: {mapPosition(r.frequency)}%"
                title={r.name
                  ? `${r.frequency} Hz – ${r.name}`
                  : `${r.frequency} Hz`}
                onclick={() => onSelectForManual(r)}
                aria-label="Open {r.frequency} Hz{r.name
                  ? ` (${r.name})`
                  : ''} in Manual"
              ></button>
            {/each}
            <div
              class="pointer-events-none absolute right-0 bottom-0 left-0 flex justify-between px-1.5 text-[10px] text-ios-label3"
            >
              <span>{axis.min}</span>
              <span>{axis.max} Hz</span>
            </div>
          </div>
        </div>
        <!-- List -->
        {#each rattleRecords as r (r.id)}
          <div class="ios-row block">
            <div class="flex items-center gap-3">
              <span
                class="w-16 shrink-0 font-rounded font-semibold tabular-nums {r.fixed
                  ? 'text-ios-green line-through'
                  : 'text-ios-orange'}"
              >
                {r.frequency} Hz
              </span>
              <input
                type="text"
                bind:value={r.name}
                placeholder="Where? e.g. left door"
                class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ios-label3 {r.fixed
                  ? 'text-ios-label2'
                  : ''}"
                aria-label="Name for rattle at {r.frequency} Hz"
              />
            </div>
            <div class="-ml-2 mt-1 flex text-subhead">
              <button
                type="button"
                class="rounded-lg px-2 py-1.5 text-ios-blue active:opacity-50"
                onclick={() => onRefine(r)}>Refine</button
              >
              <button
                type="button"
                class="rounded-lg px-2 py-1.5 text-ios-blue active:opacity-50"
                onclick={() => onSelectForManual(r)}>Play</button
              >
              <button
                type="button"
                class="flex items-center gap-1 rounded-lg px-2 py-1.5 active:opacity-50 {r.fixed
                  ? 'text-ios-green'
                  : 'text-ios-blue'}"
                aria-pressed={r.fixed}
                onclick={() => onToggleFixed(r.id)}
              >
                {#if r.fixed}<Check class="h-4 w-4" /> Fixed{:else}Mark fixed{/if}
              </button>
              <button
                type="button"
                class="ml-auto rounded-lg px-2 py-1.5 text-ios-red active:opacity-50"
                onclick={() => onDelete(r.id)}>Delete</button
              >
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <button
      type="button"
      class="ios-btn w-full bg-ios-green text-black"
      onclick={onStart}
      disabled={starting || rangeError !== null}
    >
      <Play class="h-5 w-5 fill-current" /> Start Test
    </button>
  {:else if testState === 'running'}
    <div class="mb-3">
      {@render bigReadout(
        refine ? `Refining ${refine.lo}–${refine.hi} Hz` : 'Sweeping'
      )}
    </div>

    <div class="mb-4 px-1">
      {@render speedSlider()}
    </div>

    <!-- Big tap pad: easy to hit while leaning into the car -->
    <div
      class="mb-4 flex min-h-40 flex-1 cursor-pointer flex-col items-center justify-center rounded-[20px] bg-ios-orange/15 p-4 text-center transition-colors select-none active:bg-ios-orange/30"
      style="touch-action: none"
      role="button"
      tabindex="0"
      aria-label="Mark rattle at current frequency"
      onpointerdown={onMark}
      onkeydown={onMarkKey}
    >
      <p class="text-[28px] leading-[34px] font-bold text-ios-orange">
        Rattle!
      </p>
      <p class="mt-1 text-subhead text-ios-orange/70">
        Tap anywhere here when something rattles
      </p>
      {#if lastMark}
        {#key lastMark.count}
          <p
            class="mark-flash mt-3 flex items-center gap-1 text-subhead font-semibold text-ios-green"
          >
            <Check class="h-4 w-4" /> Marked {lastMark.frequency} Hz
          </p>
        {/key}
      {/if}
    </div>

    <div class="flex gap-3">
      <button
        type="button"
        class="ios-btn flex-1 bg-ios-blue/15 text-ios-blue"
        onclick={onHold}
      >
        <Pause class="h-5 w-5 fill-current" /> Hold
      </button>
      {@render stopButton()}
    </div>
  {:else}
    <!-- Holding: fine-tune around the frozen frequency -->
    <div class="flex flex-1 flex-col items-center justify-center">
      <div class="mb-4 flex w-full items-center justify-between gap-3">
        <button
          type="button"
          class="ios-icon-btn h-[72px] w-[72px] shrink-0 rounded-[18px]"
          use:autoRepeat={() => onNudge(-1)}
          aria-label="Down 1 Hz"
        >
          <Minus class="h-8 w-8" />
        </button>
        {@render bigReadout('Holding', 'text-ios-blue')}
        <button
          type="button"
          class="ios-icon-btn h-[72px] w-[72px] shrink-0 rounded-[18px]"
          use:autoRepeat={() => onNudge(1)}
          aria-label="Up 1 Hz"
        >
          <Plus class="h-8 w-8" />
        </button>
      </div>
      <p class="mb-4 text-center text-subhead text-ios-label2">
        Nudge until the rattle is loudest, then press on panels to find it.
      </p>
      {#if lastMark}
        {#key lastMark.count}
          <p
            class="mark-flash mb-2 flex items-center gap-1 text-subhead font-semibold text-ios-green"
          >
            <Check class="h-4 w-4" /> Saved {lastMark.frequency} Hz
          </p>
        {/key}
      {/if}
    </div>

    <button
      type="button"
      class="ios-btn mb-3 w-full bg-ios-orange/15 text-ios-orange"
      onclick={onSaveHeld}
    >
      Save {Math.round(sweepCurrentFreq)} Hz
    </button>
    <div class="flex gap-3">
      <button
        type="button"
        class="ios-btn flex-1 bg-ios-green/15 text-ios-green"
        onclick={onResume}
      >
        <Play class="h-5 w-5 fill-current" /> Resume
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
