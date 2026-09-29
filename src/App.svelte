<script lang="ts">
  import { onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
  import {
    CircleHelp,
    Coffee,
    Settings,
    SlidersHorizontal,
    TestTubes,
    Volume,
    Volume2,
  } from 'lucide-svelte'
  import { AudioEngine } from './lib/audioEngine'
  import * as wakeLock from './lib/wakeLock'
  import { load, num, save } from './lib/storage'
  import { track } from './lib/analytics'
  import { motion } from './lib/motion'
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
    percent,
    type RattleRecord,
    type TestState,
  } from './consts'
  import ManualPanel from './ManualPanel.svelte'
  import RattleTestPanel from './RattleTestPanel.svelte'
  import SettingsSheet from './SettingsSheet.svelte'
  import Sheet from './Sheet.svelte'
  import HowTo from './HowTo.svelte'
  import DesktopIntro from './DesktopIntro.svelte'

  // Storage keys keep the old project name so existing users keep their data
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
  let helpOpen = $state(false)

  // Wide screens show the intro/guide column beside the app card
  const desktopQuery = window.matchMedia('(min-width: 1024px)')
  let isDesktop = $state(desktopQuery.matches)
  desktopQuery.addEventListener('change', (e) => (isDesktop = e.matches))
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
  let refine = $state<{
    id: string
    lo: number
    hi: number
    name: string
  } | null>(null)
  let lastMark = $state<{ frequency: number; count: number } | null>(null)
  let rattleRecords = $state<RattleRecord[]>(loadRecords())
  let frameId = 0
  let startedAt = 0
  /** Rattles marked since playback started (for analytics) */
  let sessionMarks = 0
  /** Speed setting to restore after a refine sweep, which runs slower */
  let speedBeforeRefine = 0

  engine.setVolume(initialVolume)
  engine.onEnded = () => {
    const elapsed = (performance.now() - startedAt) / 1000
    stopAll(
      autoStopMin && elapsed >= autoStopMin * 60 - 1 ? 'auto-stop' : 'finished'
    )
  }

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
    stopAll('closed')
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
    sessionMarks = 0
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
    if (!ok) return
    onStarted()
    track('manual-start', {
      frequency,
      pulse: pulseEnabled,
      pan: pan <= -0.5 ? 'left' : pan >= 0.5 ? 'right' : 'center',
    })
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
    track('warning-accepted')
  }

  function setRattleTestMode(enable: boolean) {
    if (enable === rattleTestMode) return
    // Don't carry a playing tone over into the other mode
    stopAll('mode-switch')
    rattleTestMode = enable
  }

  async function beginSweep(
    lo: number,
    hi: number,
    speed: number,
    loopSweep: boolean,
    mode: 'sweep' | 'loop' | 'refine',
    startFreq?: number
  ): Promise<boolean> {
    if (starting || testState !== 'idle' || !warningDismissed) return false
    starting = true
    lastMark = null
    engine.enablePulse(false)
    engine.setPan(pan)
    const ok = await engine.startSweep({
      lo,
      hi,
      speed,
      loop: loopSweep,
      startFreq,
    })
    starting = false
    if (!ok) return false
    testState = 'running'
    onStarted()
    trackSweep()
    track('test-start', { mode, from: lo, to: hi, speed })
    return true
  }

  function startRattleTest() {
    if (rangeError) return
    refine = null
    beginSweep(rangeMin!, rangeMax!, sweepSpeed, loop, loop ? 'loop' : 'sweep')
  }

  /** Hold the tone on a saved rattle to fine-tune it; Resume sweeps slowly around it */
  async function refineRattle(r: RattleRecord) {
    if (starting || testState !== 'idle') return
    const lo = Math.round(clampFreq(r.frequency - REFINE_SPAN))
    const hi = Math.round(clampFreq(r.frequency + REFINE_SPAN))
    refine = { id: r.id, lo, hi, name: r.name }
    speedBeforeRefine = sweepSpeed
    sweepSpeed = REFINE_SPEED
    if (
      !(await beginSweep(lo, hi, REFINE_SPEED, true, 'refine', r.frequency))
    ) {
      refine = null
      sweepSpeed = speedBeforeRefine
      return
    }
    sweepCurrentFreq = engine.holdSweep()
    testState = 'holding'
  }

  /** Mirror the audio-clock sweep position into the UI */
  function trackSweep() {
    sweepCurrentFreq = engine.getSweepFrequency()
    sweepDirection = engine.getSweepDirection()
    frameId = requestAnimationFrame(trackSweep)
  }

  function stopAll(reason = 'other') {
    if (audioActive) {
      track('tone-stop', {
        mode: testState === 'idle' ? 'manual' : refine ? 'refine' : 'test',
        reason,
        seconds: Math.round((performance.now() - startedAt) / 1000),
        marks: sessionMarks,
      })
    }
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
    if (!justStarted()) stopAll('user')
  }

  function addRecord(freq: number, source: 'tap' | 'hold') {
    // Refining updates the rattle being refined rather than adding a copy of it
    const refined = refine && rattleRecords.find((r) => r.id === refine!.id)
    if (refined) refined.frequency = freq
    else
      rattleRecords.push({
        id: newId(),
        frequency: freq,
        name: refine?.name ?? '',
        fixed: false,
      })
    lastMark = { frequency: freq, count: (lastMark?.count ?? 0) + 1 }
    navigator.vibrate?.(30)
    sessionMarks++
    track('rattle-mark', { frequency: freq, source })
  }

  function markRattle() {
    if (testState !== 'running' || justStarted()) return
    // The tone that shook the rattle was playing a moment before the tap
    const reaction = reactionMs !== null ? reactionMs / 1000 : REACTION_TIME_S
    const lookback = reaction + engine.outputLatency
    addRecord(Math.round(engine.getSweepFrequency(lookback)), 'tap')
  }

  function holdSweep() {
    if (testState !== 'running' || justStarted()) return
    sweepCurrentFreq = engine.holdSweep()
    lastMark = null
    testState = 'holding'
    track('hold', { frequency: sweepCurrentFreq })
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
    addRecord(Math.round(engine.getSweepFrequency()), 'hold')
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
    if (!r) return
    r.fixed = !r.fixed
    if (r.fixed) track('rattle-fixed', { frequency: r.frequency })
  }
</script>

<!-- Phones: the app fills the screen. Larger screens: a phone-sized card, plus an intro column on desktop -->
<div
  class="page flex justify-center md:h-full md:items-center md:overflow-y-auto md:p-8 lg:items-start lg:gap-16 xl:gap-24"
>
  {#if isDesktop}
    <div class="max-w-xl min-w-0 flex-1 pt-6">
      <DesktopIntro />
    </div>
  {/if}

  <!-- The phone: on larger screens a card, which also frames the app's alert and sheets -->
  <div
    class="relative w-full md:h-[min(880px,calc(100dvh-4rem))] md:w-[420px] md:shrink-0 md:overflow-hidden md:rounded-[2.5rem] md:border md:border-ios-sep md:shadow-2xl md:shadow-black lg:sticky lg:top-0"
  >
    <main
      class="app-main flex min-h-dvh w-full flex-col bg-ios-bg px-4 md:h-full md:min-h-0 md:overflow-y-auto"
    >
      <!-- Large title with trailing icon buttons -->
      <header class="mb-4">
        <div class="flex items-center justify-between gap-2">
          <h1 class="text-large-title min-w-0 truncate">Find The Rattle</h1>
          <div class="-mr-2 flex shrink-0">
            <a
              class="flex h-11 w-11 items-center justify-center rounded-full text-ios-blue active:opacity-50"
              href="https://buymeacoffee.com/find.the.rattle"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Buy me a coffee"
              title="Buy me a coffee"
            >
              <Coffee class="h-6 w-6" />
            </a>
            <button
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-full text-ios-blue active:opacity-50"
              onclick={() => (settingsOpen = true)}
              aria-label="Settings"
            >
              <Settings class="h-6 w-6" />
            </button>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-x-3">
          <p class="text-subhead text-ios-label2">
            Find rattles and buzzes in your car
          </p>
          <!-- On desktop the guide is in the side column -->
          {#if !isDesktop}
            <button
              type="button"
              class="-my-2 flex items-center gap-1 py-2 text-subhead text-ios-blue active:opacity-50"
              onclick={() => {
                helpOpen = true
                track('help-open')
              }}
            >
              <CircleHelp class="h-4 w-4" /> How it works
            </button>
          {/if}
        </div>
      </header>

      <!-- Mode -->
      <div class="ios-seg mb-3" style="--n: 2; --i: {rattleTestMode ? 1 : 0}">
        <button
          type="button"
          class="min-h-9! text-subhead!"
          aria-pressed={!rattleTestMode}
          onclick={() => setRattleTestMode(false)}
        >
          <SlidersHorizontal class="h-4 w-4" /> Manual
        </button>
        <button
          type="button"
          class="min-h-9! text-subhead!"
          aria-pressed={rattleTestMode}
          onclick={() => setRattleTestMode(true)}
        >
          <TestTubes class="h-4 w-4" /> Rattle Test
        </button>
      </div>

      <!-- Volume (shared by both modes) -->
      <div class="mb-2 flex items-center gap-3 px-1">
        <Volume class="h-5 w-5 shrink-0 text-ios-label2" aria-hidden="true" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          oninput={(e) => setVolume(Number(e.currentTarget.value))}
          class="ios-range min-w-0 flex-1"
          style="--pct: {percent(volume, 0, 1)}"
          aria-label="Volume"
          aria-valuetext="{Math.round(volume * 100)}%"
        />
        <Volume2 class="h-5 w-5 shrink-0 text-ios-label2" aria-hidden="true" />
      </div>

      {#if rattleTestMode}
        <div class="flex flex-1 flex-col" in:fade={{ duration: motion(180) }}>
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
        </div>
      {:else}
        <div class="flex flex-1 flex-col" in:fade={{ duration: motion(180) }}>
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
        </div>
      {/if}

      <!-- Always rendered (fixed height) so the Start/Stop button doesn't jump when playback starts -->
      <p class="mt-2 h-4 text-center text-caption text-ios-label2">
        {remaining !== null ? `Auto-stop in ${formatTime(remaining)}` : ''}
      </p>
    </main>

    {#if !warningDismissed}
      <!-- iOS-style alert (inside the phone card on larger screens) -->
      <div
        class="alert-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 md:absolute"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="warning-title"
        aria-describedby="warning-text"
        out:fade={{ duration: motion(200) }}
      >
        <div
          class="alert w-full max-w-[300px] overflow-hidden rounded-[14px] bg-[rgb(44_44_46/0.92)] text-center backdrop-blur-xl"
        >
          <div class="px-4 pt-5 pb-4">
            <h2 id="warning-title" class="mb-1 text-body font-semibold">
              Mind the volume
            </h2>
            <p id="warning-text" class="text-footnote">
              This app plays test tones for locating rattles. Start at a low
              volume and avoid long exposure at high levels. Only use it while
              parked.
            </p>
          </div>
          <button
            type="button"
            class="h-11 w-full border-t-[0.5px] border-ios-sep text-body font-semibold text-ios-blue transition-colors hover:bg-white/5 hover:opacity-100 active:bg-white/10"
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
        onBeforeCalibrate={() => stopAll('calibration')}
        onClose={() => (settingsOpen = false)}
      />
    {/if}

    {#if helpOpen}
      <Sheet title="How to Find a Rattle" onClose={() => (helpOpen = false)}>
        <HowTo intro />
      </Sheet>
    {/if}
  </div>
</div>

<style>
  @media (min-width: 768px) {
    .page {
      background: radial-gradient(ellipse at top, #1c1c1e 0%, #000 60%);
    }
  }
  /* Keep content clear of the notch / home indicator in standalone mode */
  .app-main {
    padding-top: max(0.75rem, env(safe-area-inset-top));
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }
  @media (min-width: 768px) {
    .app-main {
      padding-top: 1.25rem;
    }
  }
  /* iOS alerts fade in and settle from slightly larger */
  .alert-backdrop {
    animation: fade-in 0.2s ease-out;
  }
  .alert {
    animation: alert-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.15);
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
  @keyframes alert-in {
    from {
      opacity: 0;
      transform: scale(1.12);
    }
  }
</style>
