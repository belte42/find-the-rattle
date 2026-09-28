<script lang="ts">
  import { onDestroy } from 'svelte'
  import { X } from 'lucide-svelte'
  import type { AudioEngine, Beep } from './lib/audioEngine'
  import { AUTO_STOP_OPTIONS, REACTION_TIME_S } from './consts'
  import { track } from './lib/analytics'

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

<div
  class="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 sm:items-center"
  role="presentation"
  onclick={(e) => e.target === e.currentTarget && close()}
>
  <div
    class="sheet w-full max-w-md rounded-t-2xl border border-slate-700 bg-slate-900 p-5 sm:rounded-2xl"
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
  >
    <div class="mb-4 flex items-center justify-between">
      <h2 id="settings-title" class="text-lg font-bold">Settings</h2>
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"
        onclick={close}
        aria-label="Close settings"
      >
        <X class="h-5 w-5" />
      </button>
    </div>

    {#if calibrating}
      <p class="mb-3 text-sm text-slate-400">
        Tap the pad as soon as you hear each beep ({results.length}/{TRIALS}).
      </p>
      <button
        type="button"
        class="mb-3 flex h-48 w-full select-none items-center justify-center rounded-2xl border-2 border-amber-500 bg-amber-500/15 text-xl font-bold text-amber-300"
        style="touch-action: none"
        onpointerdown={onTap}
      >
        {message}
      </button>
      <button
        type="button"
        class="btn-tactile w-full border border-slate-600 text-slate-300"
        onclick={cancelCalibration}
      >
        Cancel
      </button>
    {:else}
      <!-- Auto-stop -->
      <p class="mb-2 text-sm font-medium text-slate-300">Auto-stop</p>
      <div class="mb-1 grid grid-cols-4 gap-2">
        {#each AUTO_STOP_OPTIONS as min}
          <button
            type="button"
            class="rounded-lg border-2 py-2 text-sm font-semibold {autoStopMin ===
            min
              ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
              : 'border-slate-700 text-slate-400'}"
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
      <p class="mb-5 text-xs text-slate-500">
        Stops the tone automatically, in case you forget it's on.
      </p>

      <!-- Reaction time -->
      <p class="mb-1 text-sm font-medium text-slate-300">Reaction delay</p>
      <p class="mb-2 text-sm text-slate-400">
        {#if reactionMs !== null}
          {reactionMs} ms <span class="text-slate-500">(measured)</span>
        {:else}
          {REACTION_TIME_S * 1000} ms <span class="text-slate-500">(default estimate)</span>
        {/if}
      </p>
      <p class="mb-3 text-xs text-slate-500">
        Subtracted when you tap during a sweep, so the saved frequency matches
        what caused the rattle. Measure it in the car, through the same speakers
        or Bluetooth you'll test with.
      </p>
      {#if message}
        <p class="mb-3 text-sm text-emerald-400">{message}</p>
      {/if}
      <div class="flex gap-2">
        <button
          type="button"
          class="btn-tactile flex-1 border-2 border-amber-500 bg-amber-500/15 text-amber-300"
          onclick={startCalibration}
        >
          Measure
        </button>
        {#if reactionMs !== null}
          <button
            type="button"
            class="btn-tactile flex-1 border border-slate-600 text-slate-300"
            onclick={() => {
              reactionMs = null
              message = ''
            }}
          >
            Use default
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .sheet {
    padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
  }
</style>
