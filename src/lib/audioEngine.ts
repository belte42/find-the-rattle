/**
 * Car Rattle Finder - Web Audio API Engine
 *
 * Graph: oscillator -> envelope -> pulse -> volume -> panner -> destination
 *
 * All timing (sweeps, pulse gating, fades) is scheduled on the audio clock
 * rather than with JS timers, so it stays accurate when the page is
 * backgrounded or the screen locks.
 */

import { DEFAULT_VOLUME, clampFreq } from '../consts'

/** Fade length for click-free starts, stops and pulse edges (seconds) */
const RAMP = 0.015
/** Pulse cycle: first half on, second half off (seconds) */
const PULSE_PERIOD = 2
/** Time constant for smoothing parameter changes (seconds) */
const GLIDE = 0.01

interface Sweep {
  from: number
  to: number
  speed: number
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

function glide(param: AudioParam, value: number, now: number) {
  param.cancelScheduledValues(now)
  param.setValueAtTime(param.value, now)
  param.setTargetAtTime(value, now, GLIDE)
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private nodes: Nodes | null = null
  private sweep: Sweep | null = null
  private gateBuffer: AudioBuffer | null = null
  private startPromise: Promise<boolean> | null = null
  /** Bumped on every stop so an in-flight start knows it was cancelled */
  private generation = 0

  private frequency = 100
  private pan = 0
  private volume = DEFAULT_VOLUME
  private pulseEnabled = false

  /** Called when playback ends by itself: sweep finished or the OS interrupted audio */
  onEnded: (() => void) | null = null

  get running(): boolean {
    return this.nodes !== null
  }

  /** Output delay of the device (e.g. Bluetooth), where the browser reports it */
  get outputLatency(): number {
    if (!this.ctx) return 0
    return (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0)
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

  /** Start the tone. Must be called from a user gesture. Concurrent calls share one start. */
  start(): Promise<boolean> {
    if (this.nodes) return Promise.resolve(true)
    this.startPromise ??= this._start().finally(() => {
      this.startPromise = null
    })
    return this.startPromise
  }

  private async _start(): Promise<boolean> {
    const ctx = this.getContext()
    if (!ctx) return false
    const generation = this.generation
    if (ctx.state !== 'running') {
      try {
        await ctx.resume()
      } catch {
        return false
      }
    }
    if (ctx.state !== 'running' || generation !== this.generation) return false
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
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(1, now + RAMP)

    osc.connect(env).connect(pulse).connect(volume).connect(panner)
    panner.connect(ctx.destination)

    const nodes: Nodes = { osc, env, pulse, volume, panner, gate: null }
    osc.onended = () => {
      panner.disconnect()
      // Ended on schedule (sweep finished) rather than via stop()
      if (this.nodes === nodes) {
        this.nodes = null
        this.sweep = null
        this.onEnded?.()
      }
    }
    osc.start(now)
    this.nodes = nodes
    if (this.pulseEnabled) this.startGate()
    return true
  }

  /** Stop playback with a short fade */
  stop(): void {
    this.generation++
    this.sweep = null
    const nodes = this.nodes
    this.nodes = null
    if (!nodes || !this.ctx) return
    const now = this.ctx.currentTime
    const env = nodes.env.gain
    env.cancelScheduledValues(now)
    env.setValueAtTime(env.value, now)
    env.linearRampToValueAtTime(0, now + RAMP)
    try {
      // Replaces any earlier scheduled stop (end of sweep)
      nodes.osc.stop(now + RAMP)
      nodes.gate?.stop(now + RAMP)
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

  /** Sweep linearly from `from` to `to` at `speed` Hz/sec, then stop */
  async startSweep(from: number, to: number, speed: number): Promise<boolean> {
    this.frequency = clampFreq(from)
    if (!(await this.start())) return false
    this.scheduleSweep(clampFreq(from), clampFreq(to), speed)
    return true
  }

  /** Change the speed of the running sweep, continuing from the current frequency */
  setSweepSpeed(speed: number): void {
    if (!this.sweep) return
    this.scheduleSweep(this.getSweepFrequency(), this.sweep.to, speed)
  }

  /**
   * Frequency the sweep was playing `lookbackSec` seconds ago
   * (or the manual frequency when no sweep is running).
   */
  getSweepFrequency(lookbackSec = 0): number {
    if (!this.sweep || !this.ctx) return this.frequency
    const { from, to, speed, startTime } = this.sweep
    const elapsed = Math.max(0, this.ctx.currentTime - lookbackSec - startTime)
    return Math.min(to, from + speed * elapsed)
  }

  private scheduleSweep(from: number, to: number, speed: number): void {
    if (!this.nodes || !this.ctx) return
    const now = this.ctx.currentTime
    const end = now + Math.max(0, to - from) / speed
    this.sweep = { from, to, speed, startTime: now }

    const freq = this.nodes.osc.frequency
    freq.cancelScheduledValues(now)
    freq.setValueAtTime(from, now)
    freq.linearRampToValueAtTime(to, end)

    // Keep any fade-in that is still running, then fade out at the end
    const env = this.nodes.env.gain
    env.cancelScheduledValues(now)
    env.setValueAtTime(env.value, now)
    env.linearRampToValueAtTime(1, Math.min(now + RAMP, end - RAMP))
    env.setValueAtTime(1, end - RAMP)
    env.linearRampToValueAtTime(0, end)
    try {
      this.nodes.osc.stop(end)
    } catch {
      /* already ended */
    }
  }

  private getGateBuffer(ctx: AudioContext): AudioBuffer {
    if (this.gateBuffer) return this.gateBuffer
    const length = Math.round(PULSE_PERIOD * ctx.sampleRate)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    const on = Math.floor(length / 2)
    const ramp = Math.round(RAMP * ctx.sampleRate)
    for (let i = 0; i < on; i++) data[i] = Math.min(1, i / ramp, (on - i) / ramp)
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
