/**
 * "Install app" support. Chromium browsers fire beforeinstallprompt once, often
 * before Settings is opened, so it's caught here at startup and replayed later.
 * iOS has no prompt: people add it from the Share menu instead.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null

export const install = $state({
  /** The browser can show its own install prompt */
  canPrompt: false,
  /** Running as the installed app (home screen / desktop window) */
  installed:
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
})

/** iPhone/iPad, where installing means Share > Add to Home Screen */
export const isIos =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  install.canPrompt = true
})

window.addEventListener('appinstalled', () => {
  deferred = null
  install.canPrompt = false
  install.installed = true
})

/** Show the browser's install prompt. Resolves to whether it was accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const event = deferred
  deferred = null
  install.canPrompt = false
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome === 'accepted'
}
