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
  import { fade, slide } from 'svelte/transition'
  import { autoRepeat } from './lib/autoRepeat'
  import { motion } from './lib/motion'
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
    refine: { id: string; lo: number; hi: number; name: string } | null
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

  /** Label rows on the map; labels that would overlap go on a higher row */
  const MAP_LANES = 3
  const LANE_PX = 28
  /** Width a frequency label needs, in px */
  const LABEL_PX = 58
  let mapWidth = $state(0)

  const ticks = $derived.by(() => {
    const step = [5, 10, 20, 50, 100].find((s) => axis.span / s <= 6) ?? 100
    const out: number[] = []
    for (let f = Math.ceil(axis.min / step) * step; f <= axis.max; f += step)
      out.push(f)
    return out
  })

  const lanes = $derived.by(() => {
    const lastX: number[] = Array(MAP_LANES).fill(-Infinity)
    const out = new Map<string, number>()
    const sorted = [...rattleRecords].sort((a, b) => a.frequency - b.frequency)
    for (const r of sorted) {
      const x = (mapPosition(r.frequency) / 100) * mapWidth
      let lane = lastX.findIndex((last) => x - last >= LABEL_PX)
      // All rows crowded: use the one whose last label is furthest away
      if (lane === -1) lane = lastX.indexOf(Math.min(...lastX))
      lastX[lane] = x
      out.set(r.id, lane)
    }
    return out
  })

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

<!-- Fade between idle / sweeping / holding -->
{#key testState}
  <div class="flex flex-1 flex-col" in:fade={{ duration: motion(180) }}>
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
        <p class="ios-section-footer text-ios-red!" role="alert">
          {rangeError}
        </p>
      {:else if (rangeMin ?? 0) < WEAK_BASS_HZ}
        <p class="ios-section-footer">
          Many car speakers produce little below ~{WEAK_BASS_HZ} Hz, so rattles there
          may not show up.
        </p>
      {/if}

      <button
        type="button"
        class="ios-btn mt-6 w-full bg-ios-blue text-white"
        onclick={onStart}
        disabled={starting || rangeError !== null}
      >
        <Play class="h-5 w-5 fill-current" /> Start Test
      </button>

      <!-- Rattle map -->
      <div class="mt-8 mb-1.5 flex items-baseline justify-between px-4">
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
      <div class="ios-group">
        {#if rattleRecords.length === 0}
          <p class="ios-row text-ios-label2">
            No rattles yet. Start a test and tap the pad when something rattles.
          </p>
        {:else}
          <!-- Frequency chart: a stem and label per rattle above a Hz scale; inset so end labels stay whole -->
          <div class="ios-row block pt-4 pb-3">
            <div
              class="relative mx-5 h-[116px] tabular-nums"
              bind:clientWidth={mapWidth}
            >
              {#each ticks as t (t)}
                <div
                  class="absolute top-0 bottom-5 w-px bg-ios-sep/50"
                  style="left: {mapPosition(t)}%"
                ></div>
                <span
                  class="absolute bottom-0 -translate-x-1/2 text-caption text-ios-label3"
                  style="left: {mapPosition(t)}%">{t}</span
                >
              {/each}
              <div
                class="absolute inset-x-0 bottom-5 h-0.5 rounded-full bg-ios-card3"
              ></div>
              {#each rattleRecords as r (r.id)}
                {@const lane = lanes.get(r.id) ?? 0}
                {@const left = mapPosition(r.frequency)}
                <div
                  class="map-move pointer-events-none absolute bottom-5 w-0.5 -translate-x-1/2 {r.fixed
                    ? 'bg-ios-green/60'
                    : 'bg-ios-orange/60'}"
                  style="left: {left}%; height: {16 + lane * LANE_PX}px"
                ></div>
                <div
                  class="map-move pointer-events-none absolute bottom-5 h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full {r.fixed
                    ? 'bg-ios-green'
                    : 'bg-ios-orange'}"
                  style="left: {left}%"
                ></div>
              {/each}
              <!-- Labels after all stems, so no stem crosses a label -->
              {#each rattleRecords as r (r.id)}
                {@const lane = lanes.get(r.id) ?? 0}
                {@const left = mapPosition(r.frequency)}
                <button
                  type="button"
                  class="map-move absolute -translate-x-1/2 rounded-full px-2 py-0.5 text-caption font-semibold whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-ios-blue active:opacity-60 {r.fixed
                    ? 'bg-ios-card3 text-ios-green'
                    : 'bg-ios-orange text-black'}"
                  style="left: {left}%; bottom: {36 + lane * LANE_PX}px"
                  title={r.name
                    ? `${r.frequency} Hz – ${r.name}`
                    : `${r.frequency} Hz`}
                  onclick={() => onSelectForManual(r)}
                  aria-label="Open {r.frequency} Hz{r.name
                    ? ` (${r.name})`
                    : ''} in Manual"
                >
                  {r.frequency} Hz
                </button>
              {/each}
            </div>
          </div>
          <!-- List -->
          {#each rattleRecords as r (r.id)}
            <div
              class="ios-row block py-3"
              transition:slide={{ duration: motion(220) }}
            >
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
              <div class="-mx-2 mt-2 flex gap-1 text-subhead">
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
        class="mb-4 flex min-h-40 flex-1 cursor-pointer flex-col items-center justify-center rounded-[20px] bg-ios-orange/15 p-4 text-center transition-colors select-none hover:bg-ios-orange/20 active:bg-ios-orange/30"
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
          {@render bigReadout(
            refine ? `Refining ${refine.name.trim() || 'rattle'}` : 'Holding',
            'text-ios-blue'
          )}
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
        {refine ? 'Update to' : 'Save'}
        {Math.round(sweepCurrentFreq)} Hz
      </button>
      <div class="flex gap-3">
        <button
          type="button"
          class="ios-btn flex-1 bg-ios-blue/15 text-ios-blue"
          onclick={onResume}
        >
          <Play class="h-5 w-5 fill-current" /> Resume
        </button>
        {@render stopButton()}
      </div>
    {/if}
  </div>
{/key}

<style>
  /* Chart stems and labels glide when a rattle is re-tuned or re-stacked */
  .map-move {
    transition:
      left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1),
      bottom 0.3s cubic-bezier(0.25, 0.8, 0.25, 1),
      height 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  }
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
