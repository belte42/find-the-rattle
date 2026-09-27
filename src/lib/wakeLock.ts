/**
 * Keeps the screen on while a tone is playing. The browser drops the lock
 * whenever the page is hidden, so it is re-acquired when the page is visible again.
 */

let sentinel: WakeLockSentinel | null = null
let wanted = false

async function request() {
  if (!wanted || sentinel || !('wakeLock' in navigator)) return
  try {
    sentinel = await navigator.wakeLock.request('screen')
    sentinel.addEventListener('release', () => {
      sentinel = null
    })
    if (!wanted) release()
  } catch {
    /* denied, e.g. battery saver - not critical */
  }
}

export function acquire() {
  wanted = true
  request()
}

export function release() {
  wanted = false
  sentinel?.release()
  sentinel = null
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') request()
})
