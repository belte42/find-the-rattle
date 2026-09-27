import type { Action } from 'svelte/action'

/**
 * Runs `fn` on press, then repeatedly (speeding up) while the button is held.
 * Fires on pointerdown so it reacts instantly on touch screens.
 */
export const autoRepeat: Action<HTMLElement, () => void> = (node, fn) => {
  let callback = fn
  let timer: ReturnType<typeof setTimeout> | undefined

  const stop = () => {
    clearTimeout(timer)
    timer = undefined
  }
  const tick = (delay: number) => {
    callback()
    timer = setTimeout(() => tick(Math.max(40, delay * 0.85)), delay)
  }
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    node.setPointerCapture(e.pointerId)
    stop()
    callback()
    timer = setTimeout(() => tick(120), 400)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      callback()
    }
  }
  const noMenu = (e: Event) => e.preventDefault()
  const ends = ['pointerup', 'pointercancel', 'lostpointercapture'] as const

  node.addEventListener('pointerdown', onDown)
  node.addEventListener('keydown', onKey)
  node.addEventListener('contextmenu', noMenu)
  ends.forEach((ev) => node.addEventListener(ev, stop))

  return {
    update(fn) {
      callback = fn
    },
    destroy() {
      stop()
      node.removeEventListener('pointerdown', onDown)
      node.removeEventListener('keydown', onKey)
      node.removeEventListener('contextmenu', noMenu)
      ends.forEach((ev) => node.removeEventListener(ev, stop))
    },
  }
}
