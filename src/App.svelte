<script lang="ts">
  import { onDestroy } from 'svelte'
  import {
    CircleAlert,
    Settings,
    SlidersHorizontal,
    TestTubes,
    Volume1,
  } from 'lucide-svelte'
  import { AudioEngine } from './lib/audioEngine'
  import * as wakeLock from './lib/wakeLock'
  import { load, num, save } from './lib/storage'
  import {
    AUTO_STOP_OPTIONS,
    DEFAULT_AUTO_STOP,
    DEFAULT_VOLUME,
    FREQ_MAX,
    FREQ_MIN,
    MAX_SWEEP_SPEED,
    MIN_SWEEP_SPEED,
    REACTION_TIME_S,
    REFINE_SPAN,
    REFINE_SPEED,
    clampFreq,
    type RattleRecord,
    type TestState,
  } from './consts'
  import ManualPanel from './ManualPanel.svelte'
  import RattleTestPanel from './RattleTestPanel.svelte'
  import SettingsSheet from './SettingsSheet.svelte'

  const WARNING_KEY = 'rattle-finder-warning-dismissed'
  const RECORDS_KEY = 'rattle-finder-records'
  const VOLUME_KEY = 'rattle-finder-volume'
  const SETTINGS_KEY = 'rattle-finder-settings'
  const TEST_KEY = 'rattle-finder-test'
  /** Taps this soon after starting are the second half of a double tap */
  const DOUBLE_TAP_MS = 400

  const engine = new AudioEngine()

  const storedSettings = load<Record<string, unknown>>(SETTINGS_KEY, {})
  const storedTest = load<Record<string, unknown>>(TEST_KEY, {})
  const initialVolume = num(load<unknown>(VOLUME_KEY, null), DEFAULT_VOLUME)

  let warningDismissed = $state(load<unknown>(WARNING_KEY, false) === true)
  let volume = $state(initialVolume)
  let settingsOpen = $state(false)
  let autoStopMin = $state(
    AUTO_STOP_OPTIONS.includes(storedSettings.autoStopMin as number)
      ? (storedSettings.autoStopMin as number)
      : DEFAULT_AUTO_STOP
  )
  let reactionMs = $state<number | null>(
    typeof storedSettings.reactionMs === 'number'
      ? storedSettings.reactionMs
      : null
  )

  // Manual mode
  let frequency = $state(100)
  let pulseEnabled = $state(false)
  let pan = $state(0)
  let audioActive = $state(false)
  /** True while the audio context is being started, to ignore repeat taps */
  let starting = $state(false)
  let remaining = $state<number | null>(null)

  // Rattle Test mode
  let rattleTestMode = $state(false)
  let testState = $state<TestState>('idle')
  let rangeMin = $state<number | null>(num(storedTest.rangeMin, 30))
  let rangeMax = $state<number | null>(num(storedTest.rangeMax, 150))
  let sweepSpeed = $state(
    Math.max(
      MIN_SWEEP_SPEED,
      Math.min(MAX_SWEEP_SPEED, num(storedTest.sweepSpeed, 2))
    )
  )
  let loop = $state(storedTest.loop === true)
  let sweepCurrentFreq = $state(30)
  let sweepDirection = $state<1 | -1 | 0>(0)
  let refine = $state<{ lo: number; hi: number; name: string } | null>(null)
  let lastMark = $state<{ frequency: number; count: number } | null>(null)
  let rattleRecords = $state<RattleRecord[]>(loadRecords())
  let frameId = 0
  let startedAt = 0
  /** Speed setting to restore after a refine sweep, which runs slower */
  let speedBeforeRefine = 0

  engine.setVolume(initialVolume)
  engine.onEnded = stopAll

  $effect(() => save(RECORDS_KEY, rattleRecords))
  $effect(() => save(VOLUME_KEY, volume))
  $effect(() => save(SETTINGS_KEY, { autoStopMin, reactionMs }))
  $effect(() => save(TEST_KEY, { rangeMin, rangeMax, sweepSpeed, loop }))
  $effect(() => engine.setAutoStop(autoStopMin ? autoStopMin * 60 : null))

  $effect(() => {
    // Apply speed changes to a running or held sweep
    const speed = sweepSpeed
    if (testState !== 'idle') engine.setSweepSpeed(speed)
  })

  $effect(() => {
    // Auto-stop countdown (display only; the stop itself is on the audio clock)
    if (!audioActive) return
    const tick = () => (remaining = engine.getRemainingTime())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  })

  onDestroy(() => {
    stopAll()
    engine.destroy()
  })

  function loadRecords(): RattleRecord[] {
    const stored = load<unknown>(RECORDS_KEY, [])
    if (!Array.isArray(stored)) return []
    return stored
      .filter(
        (r) =>
          typeof r?.id === 'string' &&
          typeof r?.frequency === 'number' &&
          typeof r?.name === 'string'
      )
      .map((r) => ({ ...r, fixed: r.fixed === true }))
  }

  function newId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  function formatTime(seconds: number) {
    const s = Math.ceil(seconds)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  const rangeError = $derived.by(() => {
    if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax))
      return 'Enter a start and end frequency.'
    if (rangeMin! < FREQ_MIN || rangeMax! > FREQ_MAX)
      return `Range must be within ${FREQ_MIN}–${FREQ_MAX} Hz.`
    if (rangeMin! >= rangeMax!) return '“From” must be lower than “To”.'
    return null
  })

  /** Ignore the second tap of a double tap on a button that just changed role */
  function justStarted() {
    return performance.now() - startedAt < DOUBLE_TAP_MS
  }

  function onStarted() {
    audioActive = true
    startedAt = performance.now()
    wakeLock.acquire()
  }

  async function startManual() {
    if (starting || !warningDismissed) return
    starting = true
    engine.setFrequency(frequency)
    engine.setPan(pan)
    engine.enablePulse(pulseEnabled)
    const ok = await engine.start()
    starting = false
    if (ok) onStarted()
  }

  function setFreq(hz: number) {
    frequency = Math.round(clampFreq(hz))
    engine.setFrequency(frequency)
  }

  function togglePulse() {
    pulseEnabled = !pulseEnabled
    if (testState === 'idle') engine.enablePulse(pulseEnabled)
  }

  function setPan(value: number) {
    pan = value
    engine.setPan(pan)
  }

  function setVolume(value: number) {
    volume = value
    engine.setVolume(volume)
  }

  function playInManual(r: RattleRecord) {
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

  async function beginSweep(
    lo: number,
    hi: number,
    speed: number,
    loopSweep: boolean
  ) {
    if (starting || testState !== 'idle' || !warningDismissed) return
    starting = true
    lastMark = null
    engine.enablePulse(false)
    engine.setPan(pan)
    const ok = await engine.startSweep({ lo, hi, speed, loop: loopSweep })
    starting = false
    if (!ok) return
    testState = 'running'
    onStarted()
    trackSweep()
  }

  function startRattleTest() {
    if (rangeError) return
    refine = null
    beginSweep(rangeMin!, rangeMax!, sweepSpeed, loop)
  }

  function refineRattle(r: RattleRecord) {
    const lo = Math.round(clampFreq(r.frequency - REFINE_SPAN))
    const hi = Math.round(clampFreq(r.frequency + REFINE_SPAN))
    refine = { lo, hi, name: r.name }
    speedBeforeRefine = sweepSpeed
    sweepSpeed = REFINE_SPEED
    beginSweep(lo, hi, REFINE_SPEED, true)
  }

  /** Mirror the audio-clock sweep position into the UI */
  function trackSweep() {
    sweepCurrentFreq = engine.getSweepFrequency()
    sweepDirection = engine.getSweepDirection()
    frameId = requestAnimationFrame(trackSweep)
  }

  function stopAll() {
    cancelAnimationFrame(frameId)
    engine.stop()
    if (refine) {
      sweepSpeed = speedBeforeRefine
      refine = null
    }
    testState = 'idle'
    audioActive = false
    remaining = null
    wakeLock.release()
  }

  function stopFromButton() {
    if (!justStarted()) stopAll()
  }

  function addRecord(freq: number) {
    rattleRecords.push({
      id: newId(),
      frequency: freq,
      name: refine?.name ?? '',
      fixed: false,
    })
    lastMark = { frequency: freq, count: (lastMark?.count ?? 0) + 1 }
    navigator.vibrate?.(30)
  }

  function markRattle() {
    if (testState !== 'running' || justStarted()) return
    // The tone that shook the rattle was playing a moment before the tap
    const reaction = reactionMs !== null ? reactionMs / 1000 : REACTION_TIME_S
    const lookback = reaction + engine.outputLatency
    addRecord(Math.round(engine.getSweepFrequency(lookback)))
  }

  function holdSweep() {
    if (testState !== 'running' || justStarted()) return
    sweepCurrentFreq = engine.holdSweep()
    lastMark = null
    testState = 'holding'
  }

  function nudge(delta: number) {
    const f = Math.round(
      clampFreq(Math.round(engine.getSweepFrequency()) + delta)
    )
    engine.setFrequency(f)
    sweepCurrentFreq = f
  }

  function saveHeld() {
    // The user tuned this by ear, so no reaction-time correction
    addRecord(Math.round(engine.getSweepFrequency()))
  }

  function resumeSweep() {
    engine.resumeSweep()
    lastMark = null
    testState = 'running'
  }

  function clearRattleRecords() {
    if (confirm('Delete all recorded rattles?')) rattleRecords = []
  }

  function deleteRattle(id: string) {
    rattleRecords = rattleRecords.filter((r) => r.id !== id)
  }

  function toggleFixed(id: string) {
    const r = rattleRecords.find((r) => r.id === id)
    if (r) r.fixed = !r.fixed
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

{#if settingsOpen}
  <SettingsSheet
    {engine}
    bind:autoStopMin
    bind:reactionMs
    onBeforeCalibrate={stopAll}
    onClose={() => (settingsOpen = false)}
  />
{/if}

<main
  class="app-main flex h-full flex-col overflow-y-auto bg-slate-950 p-4 text-slate-100"
>
  <!-- Header -->
  <header class="mb-3 flex items-center justify-between gap-2">
    <div class="min-w-0 text-left">
      <h1 class="text-2xl font-bold text-slate-100 sm:text-3xl">
        Rattle Finder
      </h1>
      <p class="mt-1 text-sm text-slate-400">
        Easiest way to find rattles in your vehicle
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <a
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
      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"
        onclick={() => (settingsOpen = true)}
        aria-label="Settings"
      >
        <Settings class="h-6 w-6" />
      </button>
    </div>
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
      bind:loop
      bind:rattleRecords
      {testState}
      {starting}
      {rangeError}
      {sweepCurrentFreq}
      {sweepDirection}
      {refine}
      {lastMark}
      onStart={startRattleTest}
      onStop={stopFromButton}
      onHold={holdSweep}
      onResume={resumeSweep}
      onNudge={nudge}
      onSaveHeld={saveHeld}
      onMark={markRattle}
      onClear={clearRattleRecords}
      onDelete={deleteRattle}
      onToggleFixed={toggleFixed}
      onRefine={refineRattle}
      onSelectForManual={playInManual}
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
      onSelectRattle={(r) => setFreq(r.frequency)}
      onStart={startManual}
      onStop={stopFromButton}
      onOpenRattleTest={() => setRattleTestMode(true)}
    />
  {/if}

  {#if remaining !== null}
    <p class="mt-2 text-center text-xs text-slate-500">
      Auto-stop in {formatTime(remaining)}
    </p>
  {/if}
</main>

<style>
  /* Keep content clear of the notch / home indicator in standalone mode */
  .app-main {
    padding-top: max(1rem, env(safe-area-inset-top));
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }
  .bmc-button-img {
    height: 36px !important;
    width: 130px !important;
  }
  @media (max-width: 400px) {
    .bmc-button-img {
      height: 30px !important;
      width: 109px !important;
    }
  }
</style>
