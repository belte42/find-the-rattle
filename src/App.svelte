<script lang="ts">
  import { onDestroy } from 'svelte'
  import {
    CircleAlert,
    SlidersHorizontal,
    TestTubes,
    Volume1,
  } from 'lucide-svelte'
  import { AudioEngine } from './lib/audioEngine'
  import * as wakeLock from './lib/wakeLock'
  import { load, save } from './lib/storage'
  import {
    DEFAULT_VOLUME,
    FREQ_MAX,
    FREQ_MIN,
    REACTION_TIME_S,
    clampFreq,
    type RattleRecord,
  } from './consts'
  import ManualPanel from './ManualPanel.svelte'
  import RattleTestPanel from './RattleTestPanel.svelte'

  const WARNING_KEY = 'rattle-finder-warning-dismissed'
  const RECORDS_KEY = 'rattle-finder-records'
  const VOLUME_KEY = 'rattle-finder-volume'

  const engine = new AudioEngine()

  let warningDismissed = $state(load<unknown>(WARNING_KEY, false) === true)
  const storedVolume = load<unknown>(VOLUME_KEY, DEFAULT_VOLUME)
  const initialVolume =
    typeof storedVolume === 'number' ? storedVolume : DEFAULT_VOLUME
  let volume = $state(initialVolume)

  // Manual mode
  let frequency = $state(100)
  let pulseEnabled = $state(false)
  let pan = $state(0)
  let audioActive = $state(false)
  /** True while the audio context is being started, to ignore repeat taps */
  let starting = $state(false)

  // Rattle Test mode
  let rattleTestMode = $state(false)
  let rattleTestActive = $state(false)
  let rangeMin = $state<number | null>(30)
  let rangeMax = $state<number | null>(150)
  let sweepSpeed = $state(2)
  let sweepCurrentFreq = $state(30)
  let rattleRecords = $state<RattleRecord[]>(loadRecords())
  let frameId = 0
  /** When playback last started, to ignore the second tap of a double tap */
  let startedAt = 0

  engine.setVolume(initialVolume)
  engine.onEnded = stopAll

  $effect(() => save(RECORDS_KEY, rattleRecords))
  $effect(() => save(VOLUME_KEY, volume))

  onDestroy(() => {
    stopAll()
    engine.destroy()
  })

  function loadRecords(): RattleRecord[] {
    const stored = load<unknown>(RECORDS_KEY, [])
    if (!Array.isArray(stored)) return []
    return stored.filter(
      (r): r is RattleRecord =>
        typeof r?.id === 'string' &&
        typeof r?.frequency === 'number' &&
        typeof r?.name === 'string'
    )
  }

  function newId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  const rangeError = $derived.by(() => {
    if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax))
      return 'Enter a start and end frequency.'
    if (rangeMin! < FREQ_MIN || rangeMax! > FREQ_MAX)
      return `Range must be within ${FREQ_MIN}–${FREQ_MAX} Hz.`
    if (rangeMin! >= rangeMax!) return '“From” must be lower than “To”.'
    return null
  })

  async function startManual() {
    if (starting || !warningDismissed) return
    starting = true
    engine.setFrequency(frequency)
    engine.setPan(pan)
    engine.enablePulse(pulseEnabled)
    const ok = await engine.start()
    starting = false
    if (ok) {
      audioActive = true
      startedAt = performance.now()
      wakeLock.acquire()
    }
  }

  function setFreq(hz: number) {
    frequency = Math.round(clampFreq(hz))
    engine.setFrequency(frequency)
  }

  function togglePulse() {
    pulseEnabled = !pulseEnabled
    if (!rattleTestActive) engine.enablePulse(pulseEnabled)
  }

  function setPan(value: number) {
    pan = value
    engine.setPan(pan)
  }

  function setVolume(value: number) {
    volume = value
    engine.setVolume(volume)
  }

  function selectRattle(r: RattleRecord) {
    setFreq(r.frequency)
  }

  function goToManualWithRattle(r: RattleRecord) {
    setRattleTestMode(false)
    setFreq(r.frequency)
  }

  function dismissWarning() {
    warningDismissed = true
    save(WARNING_KEY, true)
  }

  function setRattleTestMode(enable: boolean) {
    if (enable === rattleTestMode) return
    // Don't carry a playing tone over into the other mode
    stopAll()
    rattleTestMode = enable
  }

  async function startRattleTest() {
    if (starting || rattleTestActive || !warningDismissed || rangeError) return
    const min = rangeMin!
    const max = rangeMax!
    starting = true
    engine.enablePulse(false)
    engine.setPan(pan)
    const ok = await engine.startSweep(min, max, sweepSpeed)
    starting = false
    if (!ok) return
    rattleTestActive = true
    audioActive = true
    startedAt = performance.now()
    wakeLock.acquire()
    trackSweep()
  }

  /** Mirror the audio-clock sweep position into the UI */
  function trackSweep() {
    sweepCurrentFreq = engine.getSweepFrequency()
    frameId = requestAnimationFrame(trackSweep)
  }

  $effect(() => {
    // Apply speed changes to a running sweep
    const speed = sweepSpeed
    if (rattleTestActive) engine.setSweepSpeed(speed)
  })

  function stopAll() {
    cancelAnimationFrame(frameId)
    engine.stop()
    rattleTestActive = false
    audioActive = false
    wakeLock.release()
  }

  /** Stop button handler: the Start button turns into Stop, so ignore an immediate second tap */
  function stopFromButton() {
    if (performance.now() - startedAt < 400) return
    stopAll()
  }

  function onRattleClick() {
    if (!rattleTestActive) return
    // The tone that shook the rattle was playing a moment before the tap
    const lookback = REACTION_TIME_S + engine.outputLatency
    const freq = Math.round(engine.getSweepFrequency(lookback))
    rattleRecords.push({ id: newId(), frequency: freq, name: '' })
  }

  function clearRattleRecords() {
    if (confirm('Delete all recorded rattles?')) rattleRecords = []
  }

  function deleteRattle(id: string) {
    rattleRecords = rattleRecords.filter((r) => r.id !== id)
  }
</script>

{#if !warningDismissed}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6"
    role="dialog"
    aria-modal="true"
    aria-labelledby="warning-title"
  >
    <div
      class="max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl"
    >
      <CircleAlert class="mx-auto mb-4 h-16 w-16 text-amber-500" />
      <h2 id="warning-title" class="mb-2 text-xl font-bold text-slate-100">
        Volume Warning
      </h2>
      <p class="mb-6 text-slate-300">
        This app plays test tones for locating car rattles. Use responsibly.
        Start at low volume and avoid prolonged exposure at high levels. Park
        safely before using.
      </p>
      <button
        type="button"
        class="btn-tactile w-full bg-emerald-600 text-white hover:bg-emerald-500"
        onclick={dismissWarning}
      >
        I Understand
      </button>
    </div>
  </div>
{/if}

<main class="app-main flex h-full flex-col overflow-y-auto bg-slate-950 p-4 text-slate-100">
  <!-- Header -->
  <header class="mb-3 flex items-center justify-between gap-2">
    <div class="text-left">
      <h1 class="text-3xl font-bold text-slate-100">Rattle Finder</h1>
      <p class="mt-2 text-sm text-slate-400">
        Easiest way to find rattles in your vehicle
      </p>
    </div>
    <a
      class="shrink-0"
      href="https://www.buymeacoffee.com/rattle.finder"
      target="_blank"
      rel="noopener noreferrer"
    >
      <img
        src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
        alt="Buy Me A Coffee"
        class="bmc-button-img"
      />
    </a>
  </header>

  <!-- Mode toggle -->
  <div class="mb-4 flex rounded-lg border border-slate-700 bg-slate-900 p-1">
    <button
      type="button"
      class="btn-tactile flex flex-1 items-center justify-center gap-2 rounded-md py-2 {!rattleTestMode
        ? 'bg-slate-700 text-slate-100'
        : 'text-slate-500'}"
      aria-pressed={!rattleTestMode}
      onclick={() => setRattleTestMode(false)}
    >
      <SlidersHorizontal class="h-5 w-5" />
      <span>Manual</span>
    </button>
    <button
      type="button"
      class="btn-tactile flex flex-1 items-center justify-center gap-2 rounded-md py-2 {rattleTestMode
        ? 'bg-slate-700 text-slate-100'
        : 'text-slate-500'}"
      aria-pressed={rattleTestMode}
      onclick={() => setRattleTestMode(true)}
    >
      <TestTubes class="h-5 w-5" />
      <span>Rattle Test</span>
    </button>
  </div>

  <!-- Volume (shared by both modes) -->
  <div class="mb-4 flex items-center gap-3 px-2">
    <Volume1 class="h-5 w-5 shrink-0 text-slate-500" />
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={volume}
      oninput={(e) => setVolume(Number(e.currentTarget.value))}
      class="flex-1 cursor-pointer accent-slate-400"
      aria-label="Volume"
    />
    <span class="w-10 text-right text-xs tabular-nums text-slate-500">
      {Math.round(volume * 100)}%
    </span>
  </div>

  {#if rattleTestMode}
    <RattleTestPanel
      bind:rangeMin
      bind:rangeMax
      bind:sweepSpeed
      bind:rattleRecords
      {sweepCurrentFreq}
      {rattleTestActive}
      {starting}
      {rangeError}
      {startRattleTest}
      stopRattleTest={stopFromButton}
      {onRattleClick}
      {clearRattleRecords}
      onDeleteRattle={deleteRattle}
      onSelectRattleForManual={goToManualWithRattle}
    />
  {:else}
    <ManualPanel
      {frequency}
      {pulseEnabled}
      {pan}
      {audioActive}
      {starting}
      {warningDismissed}
      {rattleRecords}
      {setFreq}
      {togglePulse}
      {setPan}
      onSelectRattle={selectRattle}
      onStart={startManual}
      onStop={stopFromButton}
      onOpenRattleTest={() => setRattleTestMode(true)}
    />
  {/if}
</main>

<style>
  /* Keep content clear of the notch / home indicator in standalone mode */
  .app-main {
    padding-top: max(1rem, env(safe-area-inset-top));
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }
  .bmc-button-img {
    height: 40px !important;
    width: 145px !important;
  }
  @media (max-width: 400px) {
    .bmc-button-img {
      height: 30px !important;
      width: 109px !important;
    }
  }
</style>
