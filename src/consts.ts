export const FREQ_MIN = 20
export const FREQ_MAX = 500
export const MIN_SWEEP_SPEED = 0.5
export const MAX_SWEEP_SPEED = 20
export const DEFAULT_VOLUME = 0.3

/**
 * Default time between the tone exciting a rattle and the user tapping
 * (hearing it + reacting). Replaced by a measured value after calibration.
 */
export const REACTION_TIME_S = 0.4

/** Refine: sweep this many Hz either side of a saved rattle, slowly, back and forth */
export const REFINE_SPAN = 8
export const REFINE_SPEED = 1

export const AUTO_STOP_OPTIONS = [0, 5, 10, 20] // minutes, 0 = off
export const DEFAULT_AUTO_STOP = 10

/** Below this, many car speakers produce very little output */
export const WEAK_BASS_HZ = 35

export interface RattleRecord {
  id: string
  frequency: number
  name: string
  fixed: boolean
}

export type TestState = 'idle' | 'running' | 'holding'

export function clampFreq(hz: number): number {
  return Math.max(FREQ_MIN, Math.min(FREQ_MAX, hz))
}

/** Position of `value` within [min, max] as a CSS percentage (for slider fills) */
export function percent(value: number, min: number, max: number): string {
  return `${((value - min) / (max - min)) * 100}%`
}
