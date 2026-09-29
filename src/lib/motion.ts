/** Animation helpers that respect the system "reduce motion" setting */

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

/** Duration to use for an animation: `ms`, or 0 when motion is reduced */
export function motion(ms: number): number {
  return reduceQuery.matches ? 0 : ms
}
