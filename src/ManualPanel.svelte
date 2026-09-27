<script lang="ts">
  import { Plus, Minus, Power, HeartPulse } from 'lucide-svelte'
  import {
    FREQ_MIN,
    FREQ_MAX,
    MANUAL_FREQ_STEP,
    type RattleRecord,
  } from './consts'

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

  const panLabel = $derived(pan <= -0.5 ? 'L' : pan >= 0.5 ? 'R' : 'C')
</script>

<!-- Frequency display -->
<div class="mb-4 flex flex-1 flex-col items-center justify-center gap-2">
  <p class="text-sm uppercase tracking-wider text-slate-500">Frequency</p>
  <p class="text-5xl font-bold tabular-nums text-slate-50 sm:text-6xl">
    {frequency} Hz
  </p>
</div>

<!-- Frequency controls: -/+ around a slider -->
<div class="mb-6 flex items-center gap-3">
  <button
    type="button"
    class="btn-tactile flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-500 hover:bg-slate-700"
    onclick={() => setFreq(frequency - MANUAL_FREQ_STEP)}
    aria-label="Decrease frequency by {MANUAL_FREQ_STEP} Hz"
  >
    <Minus class="h-7 w-7" />
  </button>
  <div class="flex min-w-0 flex-1 flex-col gap-1">
    <input
      type="range"
      min={FREQ_MIN}
      max={FREQ_MAX}
      step="1"
      value={frequency}
      oninput={(e) => setFreq(Number(e.currentTarget.value))}
      class="w-full cursor-pointer accent-slate-400"
      aria-label="Frequency"
    />
    <div class="flex justify-between text-xs text-slate-500">
      <span>{FREQ_MIN}</span>
      <span>{FREQ_MAX}</span>
    </div>
  </div>
  <button
    type="button"
    class="btn-tactile flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-500 hover:bg-slate-700"
    onclick={() => setFreq(frequency + MANUAL_FREQ_STEP)}
    aria-label="Increase frequency by {MANUAL_FREQ_STEP} Hz"
  >
    <Plus class="h-7 w-7" />
  </button>
</div>

<!-- Pulse mode toggle -->
<div class="mb-6 flex justify-center">
  <button
    type="button"
    class="btn-tactile flex items-center gap-2 rounded-xl px-6 {pulseEnabled
      ? 'border-2 border-amber-500 bg-amber-500/20 text-amber-400'
      : 'border-2 border-slate-600 bg-slate-800 text-slate-400'}"
    aria-pressed={pulseEnabled}
    onclick={togglePulse}
  >
    <HeartPulse class="h-6 w-6" />
    <span>Pulse (1s on/off)</span>
  </button>
</div>

<!-- Panning -->
<div class="mb-6 px-2">
  <p class="mb-2 text-center text-sm text-slate-500">Pan: {panLabel}</p>
  <div class="flex items-center gap-2">
    <span class="text-xs text-slate-600">L</span>
    <input
      type="range"
      min="-1"
      max="1"
      step="0.01"
      value={pan}
      oninput={(e) => setPan(Number(e.currentTarget.value))}
      class="flex-1 cursor-pointer accent-slate-400"
      aria-label="Stereo pan"
    />
    <span class="text-xs text-slate-600">R</span>
  </div>
</div>

<!-- Saved rattles (from rattle test) -->
<div class="mb-6">
  <p class="mb-2 text-sm text-slate-500">Saved rattles</p>
  {#if rattleRecords.length === 0}
    <button
      type="button"
      class="btn-tactile w-full rounded-xl border-2 border-slate-600 bg-slate-800 px-4 py-3 text-center text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-700"
      onclick={onOpenRattleTest}
    >
      None yet — run a Rattle Test to find them
    </button>
  {:else}
    <div class="grid grid-cols-2 gap-3">
      {#each rattleRecords as r (r.id)}
        <button
          type="button"
          class="btn-tactile rounded-xl border-2 py-4 hover:border-slate-500 hover:bg-slate-700 {r.frequency ===
          frequency
            ? 'border-amber-500 bg-slate-800 text-amber-300'
            : 'border-slate-600 bg-slate-800 text-slate-200'}"
          onclick={() => onSelectRattle(r)}
        >
          <span class="font-semibold">{r.name.trim() || `${r.frequency} Hz`}</span>
          {#if r.name.trim()}
            <span class="block text-sm text-slate-500">{r.frequency} Hz</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<!-- Start / Stop -->
<button
  type="button"
  class="btn-tactile w-full rounded-xl border-2 py-4 disabled:opacity-50 {audioActive
    ? 'border-red-600 bg-red-600 text-white hover:border-red-500 hover:bg-red-500'
    : 'border-emerald-600 bg-emerald-600/20 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-500/30'}"
  onclick={audioActive ? onStop : onStart}
  disabled={!warningDismissed || starting}
>
  <Power class="mr-2 inline-block h-5 w-5" />
  {audioActive ? 'Stop' : 'Start'}
</button>
