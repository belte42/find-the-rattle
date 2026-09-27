export const FREQ_MIN = 20
export const FREQ_MAX = 500
export const MIN_SWEEP_SPEED = 2
export const MAX_SWEEP_SPEED = 20
export const MANUAL_FREQ_STEP = 5
export const DEFAULT_VOLUME = 0.3

/**
 * Approximate time between the tone exciting a rattle and the user tapping
 * "Rattle!" (hearing it + reacting). Subtracted when recording a frequency.
 */
export const REACTION_TIME_S = 0.4

export interface RattleRecord {
  id: string
  frequency: number
  name: string
}

export function clampFreq(hz: number): number {
  return Math.max(FREQ_MIN, Math.min(FREQ_MAX, hz))
}
