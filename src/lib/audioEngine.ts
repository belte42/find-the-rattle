/**
 * Find The Rattle - Web Audio API Engine
 *
 * Graph: oscillator -> envelope -> pulse -> volume -> panner -> destination
 *
 * All timing (sweeps, pulse gating, fades, auto-stop) is scheduled on the
 * audio clock rather than with JS timers, so it stays accurate when the page
 * is backgrounded or the screen locks.
 */

import { DEFAULT_VOLUME, clampFreq } from '../consts'

/** Fade length for click-free starts, stops and pulse edges (seconds) */
const RAMP = 0.015
/** Pulse cycle: first half on, second half off (seconds) */
const PULSE_PERIOD = 2
/** Time constant for smoothing parameter changes (seconds) */
const GLIDE = 0.01
/** How far ahead a looping sweep is scheduled; playback stops when it runs out */
const MAX_SCHEDULE_S = 3600
const MAX_LEGS = 5000
/** Stop time used to cancel a previously scheduled stop */
const NEVER_S = 1e7

export interface SweepOptions {
  lo: number
  hi: number
  /** Hz per second */
  speed: number
  /** Bounce between lo and hi instead of stopping at the end */
  loop: boolean
  /** Where to start (default `lo`) and which way to go (default up) */
  startFreq?: number
  direction?: 1 | -1
}

type SweepParams = Pick<SweepOptions, 'lo' | 'hi' | 'speed' | 'loop'>

/**
 * A sweep is modelled as a phase `p` moving at `speed` along a triangle wave:
 * p in [0, L) goes up from lo to hi, p in [L, 2L) goes back down (L = hi - lo).
 */
interface Sweep extends SweepParams {
  p0: number
  startTime: number
}

interface Nodes {
  osc: OscillatorNode
  env: GainNode
  pulse: GainNode
  volume: GainNode
  panner: StereoPannerNode
  gate: AudioBufferSourceNode | null
}

export interface Beep {
  /** performance.now() time at which the beep is expected to be heard */
  heardAt: number
  cancel(): void
}

function glide(param: AudioParam, value: number, now: number) {
  param.cancelScheduledValues(now)
  param.setValueAtTime(param.value, now)
  param.setTargetAtTime(value, now, GLIDE)
}

function freqAtPhase(s: SweepParams, p: number): number {
  const L = s.hi - s.lo
  const m = ((p % (2 * L)) + 2 * L) % (2 * L)
  return s.lo + (m <= L ? m : 2 * L - m)
}

/** Phase at which a one-way sweep ends (end of the leg it started on) */
function legEnd(s: Sweep): number {
  const L = s.hi - s.lo
  return (Math.floor(s.p0 / L) + 1) * L
}

function phaseAt(s: Sweep, time: number): number {
  const p = s.p0 + s.speed * Math.max(0, time - s.startTime)
  return s.loop ? p : Math.min(p, legEnd(s))
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private nodes: Nodes | null = null
  private sweep: Sweep | null = null
  /** Sweep paused by holdSweep(), to continue with resumeSweep() */
  private held: (SweepParams & { direction: 1 | -1 }) | null = null
  private gateBuffer: AudioBuffer | null = null
  private startPromise: Promise<boolean> | null = null
  /** Bumped on every stop so an in-flight start knows it was cancelled */
  private generation = 0

  private frequency = 100
  private pan = 0
  private volume = DEFAULT_VOLUME
  private pulseEnabled = false
  private autoStopSeconds: number | null = null
  private playStart = 0

  /** Called when playback ends by itself: sweep finished, auto-stop, or OS interruption */
  onEnded: (() => void) | null = null

  get running(): boolean {
    return this.nodes !== null
  }

  /** Output delay of the device (e.g. Bluetooth), where the browser reports it */
  get outputLatency(): number {
    if (!this.ctx) return 0
    return (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0)
  }

  private get autoStopAt(): number | null {
    return this.autoStopSeconds === null
      ? null
      : this.playStart + this.autoStopSeconds
  }

  private getContext(): AudioContext | null {
    if (this.ctx) return this.ctx
    try {
      // iOS: keep playing when the ringer switch is set to silent
      const nav = navigator as Navigator & { audioSession?: { type: string } }
      if (nav.audioSession) nav.audioSession.type = 'playback'

      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      this.ctx = new Ctx()
      this.ctx.addEventListener('statechange', () => {
        // Suspended/interrupted by the OS (phone call, backgrounding on iOS)
        if (this.ctx?.state !== 'running' && this.nodes) {
          this.stop()
          this.onEnded?.()
        }
      })
      return this.ctx
    } catch (e) {
      console.error('Web Audio API not supported:', e)
      return null
    }
  }

  /** Create/resume the audio context. Must be called from a user gesture. */
  async prepare(): Promise<boolean> {
    const ctx = this.getContext()
    if (!ctx) return false
    if (ctx.state !== 'running') {
      try {
        await ctx.resume()
      } catch {
        return false
      }
    }
    return ctx.state === 'running'
  }

  /** Start the tone. Must be called from a user gesture. Concurrent calls share one start. */
  start(): Promise<boolean> {
    if (this.nodes) return Promise.resolve(true)
    this.startPromise ??= this._start().finally(() => {
      this.startPromise = null
    })
    return this.startPromise
  }

  private async _start(): Promise<boolean> {
    const generation = this.generation
    if (!(await this.prepare())) return false
    const ctx = this.ctx!
    if (generation !== this.generation) return false
    if (this.nodes) return true

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    const pulse = ctx.createGain()
    const volume = ctx.createGain()
    const panner = ctx.createStereoPanner()

    osc.frequency.value = this.frequency
    volume.gain.value = this.volume
    panner.pan.value = this.pan
    env.gain.value = 0

    osc.connect(env).connect(pulse).connect(volume).connect(panner)
    panner.connect(ctx.destination)

    const nodes: Nodes = { osc, env, pulse, volume, panner, gate: null }
    osc.onended = () => {
      nodes.gate?.stop()
      panner.disconnect()
      // Ended on schedule (sweep end / auto-stop) rather than via stop()
      if (this.nodes === nodes) {
        this.nodes = null
        this.sweep = null
        this.held = null
        this.onEnded?.()
      }
    }
    osc.start(now)
    this.nodes = nodes
    this.playStart = now
    if (this.pulseEnabled) this.startGate()
    this.reschedule()
    return true
  }

  /** Stop playback with a short fade */
  stop(): void {
    this.generation++
    this.sweep = null
    this.held = null
    const nodes = this.nodes
    this.nodes = null
    if (!nodes || !this.ctx) return
    const now = this.ctx.currentTime
    const env = nodes.env.gain
    env.cancelScheduledValues(now)
    env.setValueAtTime(env.value, now)
    env.linearRampToValueAtTime(0, now + RAMP)
    try {
      // Replaces any earlier scheduled stop
      nodes.osc.stop(now + RAMP)
    } catch {
      /* already ended */
    }
  }

  /** Set frequency (clamped to 20–500 Hz). Ignored while a sweep is running. */
  setFrequency(hz: number): void {
    this.frequency = clampFreq(hz)
    if (this.nodes && this.ctx && !this.sweep) {
      glide(this.nodes.osc.frequency, this.frequency, this.ctx.currentTime)
    }
  }

  /** Set stereo pan (-1 = left, 1 = right) */
  setPan(value: number): void {
    this.pan = Math.max(-1, Math.min(1, value))
    if (this.nodes && this.ctx) {
      glide(this.nodes.panner.pan, this.pan, this.ctx.currentTime)
    }
  }

  /** Set master volume (0–1) */
  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value))
    if (this.nodes && this.ctx) {
      glide(this.nodes.volume.gain, this.volume, this.ctx.currentTime)
    }
  }

  /** Toggle pulse mode (1s on / 1s off) */
  enablePulse(enabled: boolean): void {
    this.pulseEnabled = enabled
    if (!this.nodes) return
    if (enabled) this.startGate()
    else this.stopGate()
  }

  /** Stop playback automatically this many seconds after it starts (null = never) */
  setAutoStop(seconds: number | null): void {
    this.autoStopSeconds = seconds
    this.reschedule()
  }

  /** Seconds until auto-stop, or null if it's off / nothing is playing */
  getRemainingTime(): number | null {
    const at = this.autoStopAt
    if (at === null || !this.nodes || !this.ctx) return null
    return Math.max(0, at - this.ctx.currentTime)
  }

  /** Sweep between two frequencies. Stops at the end unless `loop` is set. */
  async startSweep(opts: SweepOptions): Promise<boolean> {
    const lo = clampFreq(Math.min(opts.lo, opts.hi))
    const hi = clampFreq(Math.max(opts.lo, opts.hi))
    if (hi <= lo || opts.speed <= 0) return false
    const startFreq = Math.max(lo, Math.min(hi, opts.startFreq ?? lo))
    this.frequency = startFreq
    this.held = null
    if (!(await this.start())) return false
    const { speed, loop } = opts
    this.beginSweep({ lo, hi, speed, loop }, startFreq, opts.direction ?? 1)
    return true
  }

  /** Freeze the sweep at the current (rounded) frequency. Returns that frequency. */
  holdSweep(): number {
    const s = this.sweep
    if (!s || !this.nodes || !this.ctx) return this.frequency
    const f = Math.round(this.getSweepFrequency())
    const direction = this.getSweepDirection() || 1
    this.held = { lo: s.lo, hi: s.hi, speed: s.speed, loop: s.loop, direction }
    this.sweep = null
    this.frequency = f
    const now = this.ctx.currentTime
    const freq = this.nodes.osc.frequency
    freq.cancelScheduledValues(now)
    freq.setValueAtTime(f, now)
    this.reschedule()
    return f
  }

  /** Continue a held sweep from the current frequency, in the direction it was going */
  resumeSweep(): void {
    const h = this.held
    if (!h || !this.nodes) return
    this.held = null
    const from = Math.max(h.lo, Math.min(h.hi, this.frequency))
    this.beginSweep(h, from, h.direction)
  }

  /** Change the speed of the running (or held) sweep */
  setSweepSpeed(speed: number): void {
    if (this.held) this.held.speed = speed
    const s = this.sweep
    if (!s) return
    const direction = this.getSweepDirection()
    if (direction === 0) return
    this.beginSweep({ ...s, speed }, this.getSweepFrequency(), direction)
  }

  /**
   * Frequency the sweep was playing `lookbackSec` seconds ago
   * (or the fixed frequency when no sweep is running).
   */
  getSweepFrequency(lookbackSec = 0): number {
    if (!this.sweep || !this.ctx) return this.frequency
    return freqAtPhase(
      this.sweep,
      phaseAt(this.sweep, this.ctx.currentTime - lookbackSec)
    )
  }

  /** 1 = sweeping up, -1 = down, 0 = not sweeping / finished */
  getSweepDirection(): 1 | -1 | 0 {
    const s = this.sweep
    if (!s || !this.ctx) return 0
    const p = phaseAt(s, this.ctx.currentTime)
    if (!s.loop && p >= legEnd(s)) return 0
    const L = s.hi - s.lo
    return ((p % (2 * L)) + 2 * L) % (2 * L) < L ? 1 : -1
  }

  private beginSweep(params: SweepParams, startFreq: number, dir: 1 | -1) {
    if (!this.ctx) return
    const L = params.hi - params.lo
    const x = startFreq - params.lo
    this.sweep = {
      lo: params.lo,
      hi: params.hi,
      speed: params.speed,
      loop: params.loop,
      p0: dir > 0 ? x : 2 * L - x,
      startTime: this.ctx.currentTime,
    }
    this.reschedule()
  }

  /** Schedule the sweep's frequency ramps from now. Returns when the schedule ends. */
  private scheduleSweepRamps(s: Sweep, freq: AudioParam, now: number): number {
    const L = s.hi - s.lo
    const endP = s.loop ? Infinity : legEnd(s)
    const horizon = Math.min(this.autoStopAt ?? Infinity, now + MAX_SCHEDULE_S)
    let p = phaseAt(s, now)
    let t = now
    freq.cancelScheduledValues(now)
    freq.setValueAtTime(freqAtPhase(s, p), now)
    for (let i = 0; i < MAX_LEGS && p < endP && t < horizon; i++) {
      const next = Math.min((Math.floor(p / L) + 1) * L, endP)
      t += (next - p) / s.speed
      p = next
      freq.linearRampToValueAtTime(freqAtPhase(s, p), t)
    }
    return t
  }

  /**
   * Re-plan everything scheduled on the audio clock: sweep ramps, fade-in,
   * and the fade-out + stop at the end of the sweep or auto-stop time.
   */
  private reschedule(): void {
    const ctx = this.ctx
    const nodes = this.nodes
    if (!ctx || !nodes) return
    const now = ctx.currentTime
    let stopAt = this.autoStopAt ?? Infinity
    if (this.sweep) {
      const sweepEnd = this.scheduleSweepRamps(
        this.sweep,
        nodes.osc.frequency,
        now
      )
      stopAt = Math.min(stopAt, sweepEnd)
    }

    const env = nodes.env.gain
    const fadeInEnd = Math.min(now + RAMP, stopAt)
    env.cancelScheduledValues(now)
    env.setValueAtTime(env.value, now)
    env.linearRampToValueAtTime(1, fadeInEnd)
    if (Number.isFinite(stopAt)) {
      env.setValueAtTime(1, Math.max(fadeInEnd, stopAt - RAMP))
      env.linearRampToValueAtTime(0, stopAt)
    }
    try {
      nodes.osc.stop(Number.isFinite(stopAt) ? stopAt : now + NEVER_S)
    } catch {
      /* already ended */
    }
  }

  /**
   * Play a short beep after `delaySec` (for reaction-time calibration).
   * Call prepare() first.
   */
  beep(delaySec: number): Beep {
    const ctx = this.ctx
    if (!ctx) return { heardAt: performance.now(), cancel() {} }
    const t = ctx.currentTime + delaySec
    const level = Math.max(this.volume, 0.1)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 440
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(level, t + 0.005)
    gain.gain.setValueAtTime(level, t + 0.14)
    gain.gain.linearRampToValueAtTime(0, t + 0.15)
    osc.connect(gain).connect(ctx.destination)
    osc.onended = () => gain.disconnect()
    osc.start(t)
    osc.stop(t + 0.16)

    // Map audio-clock time to performance.now(), including reported output latency
    const ts = ctx.getOutputTimestamp?.()
    const heardAt =
      ts?.performanceTime && ts.contextTime !== undefined
        ? ts.performanceTime + (t - ts.contextTime) * 1000
        : performance.now() + (delaySec + this.outputLatency) * 1000
    return {
      heardAt,
      cancel() {
        try {
          osc.stop()
        } catch {
          /* already ended */
        }
      },
    }
  }

  private getGateBuffer(ctx: AudioContext): AudioBuffer {
    if (this.gateBuffer) return this.gateBuffer
    const length = Math.round(PULSE_PERIOD * ctx.sampleRate)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    const on = Math.floor(length / 2)
    const ramp = Math.round(RAMP * ctx.sampleRate)
    for (let i = 0; i < on; i++)
      data[i] = Math.min(1, i / ramp, (on - i) / ramp)
    this.gateBuffer = buffer
    return buffer
  }

  /** Drive the pulse gain with a looping on/off envelope */
  private startGate(): void {
    if (!this.nodes || !this.ctx || this.nodes.gate) return
    const gate = this.ctx.createBufferSource()
    gate.buffer = this.getGateBuffer(this.ctx)
    gate.loop = true
    this.nodes.pulse.gain.value = 0
    gate.connect(this.nodes.pulse.gain)
    gate.start()
    this.nodes.gate = gate
  }

  private stopGate(): void {
    if (!this.nodes?.gate) return
    this.nodes.gate.stop()
    this.nodes.gate.disconnect()
    this.nodes.gate = null
    this.nodes.pulse.gain.value = 1
  }

  /** Stop playback and release the audio device */
  destroy(): void {
    this.stop()
    this.ctx?.close()
    this.ctx = null
  }
}
