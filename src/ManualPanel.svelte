<script lang="ts">
  import { Plus, Minus, Play, Square, Check, ChevronRight } from 'lucide-svelte'
  import { autoRepeat } from './lib/autoRepeat'
  import IosSwitch from './IosSwitch.svelte'
  import { FREQ_MIN, FREQ_MAX, percent, type RattleRecord } from './consts'

  interface Props {
    frequency: number
    pulseEnabled: boolean
    pan: number
    audioActive: boolean
    starting: boolean
    warningDismissed: boolean
    rattleRecords: RattleRecord[]
    setFreq: (hz: number) => void
    togglePulse: () => void
    setPan: (value: number) => void
    onSelectRattle: (r: RattleRecord) => void
    onStart: () => void
    onStop: () => void
    onOpenRattleTest: () => void
  }

  let {
    frequency,
    pulseEnabled,
    pan,
    audioActive,
    starting,
    warningDismissed,
    rattleRecords,
    setFreq,
    togglePulse,
    setPan,
    onSelectRattle,
    onStart,
    onStop,
    onOpenRattleTest,
  }: Props = $props()

  const panLabel = $derived(
    pan <= -0.5 ? 'Left' : pan >= 0.5 ? 'Right' : 'Centre'
  )
</script>

<!-- Frequency readout -->
<div class="flex min-h-28 flex-1 flex-col items-center justify-center">
  <p class="text-footnote text-ios-label2">Frequency</p>
  <p
    class="font-rounded text-[64px] leading-[72px] font-bold tabular-nums tracking-tight"
  >
    {frequency}<span class="ml-1 text-[28px] font-semibold text-ios-label2"
      >Hz</span
    >
  </p>
</div>

<!-- Stepper around a slider -->
<div class="mb-6 flex items-center gap-3">
  <button
    type="button"
    class="ios-icon-btn h-14 w-14 shrink-0"
    use:autoRepeat={() => setFreq(frequency - 1)}
    aria-label="Down 1 Hz (hold to repeat)"
  >
    <Minus class="h-6 w-6" />
  </button>
  <div class="min-w-0 flex-1">
    <input
      type="range"
      min={FREQ_MIN}
      max={FREQ_MAX}
      step="1"
      value={frequency}
      oninput={(e) => setFreq(Number(e.currentTarget.value))}
      class="ios-range"
      style="--pct: {percent(frequency, FREQ_MIN, FREQ_MAX)}"
      aria-label="Frequency"
    />
    <div class="flex justify-between text-caption text-ios-label3">
      <span>{FREQ_MIN}</span>
      <span>{FREQ_MAX}</span>
    </div>
  </div>
  <button
    type="button"
    class="ios-icon-btn h-14 w-14 shrink-0"
    use:autoRepeat={() => setFreq(frequency + 1)}
    aria-label="Up 1 Hz (hold to repeat)"
  >
    <Plus class="h-6 w-6" />
  </button>
</div>

<!-- Options -->
<div class="ios-group mb-6">
  <div class="ios-row">
    <div class="min-w-0 flex-1">
      <p>Pulse</p>
      <p class="text-footnote text-ios-label2">1 s on, 1 s off</p>
    </div>
    <IosSwitch
      checked={pulseEnabled}
      label="Pulse"
      onchange={() => togglePulse()}
    />
  </div>
  <div class="ios-row">
    <p class="shrink-0">Balance</p>
    <span class="text-footnote text-ios-label2">L</span>
    <input
      type="range"
      min="-1"
      max="1"
      step="0.01"
      value={pan}
      oninput={(e) => setPan(Number(e.currentTarget.value))}
      class="ios-range ios-range-plain min-w-0 flex-1"
      aria-label="Left/right balance"
      aria-valuetext={panLabel}
    />
    <span class="text-footnote text-ios-label2">R</span>
  </div>
</div>

<!-- Saved rattles (from rattle test) -->
<p class="ios-section-header">Saved rattles</p>
<div class="ios-group mb-6">
  {#if rattleRecords.length === 0}
    <button
      type="button"
      class="ios-row w-full text-left text-ios-blue"
      onclick={onOpenRattleTest}
    >
      <span class="flex-1">Run a Rattle Test to find them</span>
      <ChevronRight class="h-5 w-5 text-ios-label3" />
    </button>
  {:else}
    {#each rattleRecords as r (r.id)}
      <button
        type="button"
        class="ios-row w-full text-left"
        onclick={() => onSelectRattle(r)}
      >
        <span
          class="min-w-0 flex-1 truncate {r.fixed ? 'text-ios-label3' : ''}"
        >
          {r.name.trim() || `${r.frequency} Hz`}
        </span>
        {#if r.fixed}
          <span class="text-footnote text-ios-green">Fixed</span>
        {/if}
        {#if r.name.trim()}
          <span class="text-ios-label2 tabular-nums">{r.frequency} Hz</span>
        {/if}
        <Check
          class="h-5 w-5 shrink-0 text-ios-blue {r.frequency === frequency
            ? ''
            : 'invisible'}"
          aria-hidden="true"
        />
      </button>
    {/each}
  {/if}
</div>

<!-- Start / Stop -->
<button
  type="button"
  class="ios-btn w-full {audioActive
    ? 'bg-ios-red text-white'
    : 'bg-ios-green text-black'}"
  onclick={audioActive ? onStop : onStart}
  disabled={!warningDismissed || starting}
>
  {#if audioActive}
    <Square class="h-5 w-5 fill-current" /> Stop
  {:else}
    <Play class="h-5 w-5 fill-current" /> Start
  {/if}
</button>
