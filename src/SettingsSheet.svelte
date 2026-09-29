<script lang="ts">
  import { onDestroy } from 'svelte'
  import type { AudioEngine, Beep } from './lib/audioEngine'
  import { AUTO_STOP_OPTIONS, REACTION_TIME_S } from './consts'
  import { track } from './lib/analytics'
  import Sheet from './Sheet.svelte'

  interface Props {
    engine: AudioEngine
    autoStopMin: number
    reactionMs: number | null
    onBeforeCalibrate: () => void
    onClose: () => void
  }

  let {
    engine,
    autoStopMin = $bindable(),
    reactionMs = $bindable(),
    onBeforeCalibrate,
    onClose,
  }: Props = $props()

  const TRIALS = 5
  /** Taps faster than this after the beep are anticipation, not reaction */
  const MIN_REACTION_MS = 80
  const MAX_REACTION_MS = 1500

  let calibrating = $state(false)
  let results = $state<number[]>([])
  let message = $state('')
  let beep: Beep | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  onDestroy(cancelCalibration)

  async function startCalibration() {
    onBeforeCalibrate()
    if (!(await engine.prepare())) {
      message = 'Audio is not available.'
      return
    }
    results = []
    calibrating = true
    nextTrial()
  }

  function nextTrial(note = 'Wait for the beep…') {
    clearTimeout(timer)
    beep?.cancel()
    message = note
    const delay = 1.5 + Math.random() * 2
    beep = engine.beep(delay)
    timer = setTimeout(
      () => nextTrial('Missed it — try again.'),
      delay * 1000 + MAX_REACTION_MS + 500
    )
  }

  function onTap() {
    if (!calibrating || !beep) return
    const ms = performance.now() - beep.heardAt
    if (ms < MIN_REACTION_MS) {
      nextTrial('Too early — wait for the beep.')
      return
    }
    if (ms > MAX_REACTION_MS) return
    clearTimeout(timer)
    beep = null
    results = [...results, ms]
    navigator.vibrate?.(20)
    if (results.length < TRIALS) {
      message = `${Math.round(ms)} ms`
      timer = setTimeout(() => nextTrial(), 700)
      return
    }
    const sorted = [...results].sort((a, b) => a - b)
    reactionMs = Math.round(sorted[Math.floor(sorted.length / 2)])
    track('calibration-done', { ms: reactionMs })
    calibrating = false
    message = `Saved: ${reactionMs} ms`
  }

  function cancelCalibration() {
    clearTimeout(timer)
    beep?.cancel()
    beep = null
    calibrating = false
  }

  function close() {
    cancelCalibration()
    onClose()
  }
</script>

<Sheet title="Settings" onClose={close}>
  {#if calibrating}
    <p class="mb-3 text-center text-subhead text-ios-label2">
      Tap the pad as soon as you hear each beep ({results.length}/{TRIALS}).
    </p>
    <button
      type="button"
      class="mb-3 flex h-52 w-full items-center justify-center rounded-[20px] bg-ios-orange/15 text-title3 font-semibold text-ios-orange select-none hover:bg-ios-orange/20 hover:opacity-100 active:bg-ios-orange/30"
      style="touch-action: none"
      data-no-drag
      onpointerdown={onTap}
    >
      {message}
    </button>
    <button
      type="button"
      class="ios-btn w-full text-ios-blue"
      onclick={cancelCalibration}
    >
      Cancel
    </button>
  {:else}
    <!-- Auto-stop -->
    <p class="ios-section-header">Auto-stop</p>
    <div
      class="ios-seg"
      style="--n: {AUTO_STOP_OPTIONS.length}; --i: {AUTO_STOP_OPTIONS.indexOf(
        autoStopMin
      )}"
    >
      {#each AUTO_STOP_OPTIONS as min}
        <button
          type="button"
          aria-pressed={autoStopMin === min}
          onclick={() => {
            autoStopMin = min
            track('auto-stop-set', { minutes: min })
          }}
        >
          {min === 0 ? 'Off' : `${min} min`}
        </button>
      {/each}
    </div>
    <p class="ios-section-footer mb-6">
      Stops the tone automatically, in case you forget it's on.
    </p>

    <!-- Reaction time -->
    <p class="ios-section-header">Reaction delay</p>
    <div class="ios-group bg-ios-card2!">
      <div class="ios-row">
        <span class="flex-1">Delay</span>
        <span class="text-ios-label2 tabular-nums">
          {reactionMs ?? REACTION_TIME_S * 1000} ms · {reactionMs !== null
            ? 'measured'
            : 'default'}
        </span>
      </div>
      <button
        type="button"
        class="ios-row w-full text-left text-ios-blue"
        onclick={startCalibration}
      >
        Measure delay
      </button>
      {#if reactionMs !== null}
        <button
          type="button"
          class="ios-row w-full text-left text-ios-red"
          onclick={() => {
            reactionMs = null
            message = ''
          }}
        >
          Reset to default
        </button>
      {/if}
    </div>
    {#if message}
      <p class="ios-section-footer text-ios-green!">{message}</p>
    {/if}
    <p class="ios-section-footer">
      Subtracted when you tap during a sweep, so the saved frequency matches
      what caused the rattle. Measure it in the car, through the same speakers
      or Bluetooth you'll test with.
    </p>
  {/if}
</Sheet>
