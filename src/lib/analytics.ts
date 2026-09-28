/**
 * Custom events for Umami (cookieless analytics, loaded in index.html).
 * No-ops when the script is blocked, not loaded yet, or on other domains.
 */

type EventData = Record<string, string | number | boolean>

declare global {
  interface Window {
    umami?: { track(name: string, data?: EventData): void }
  }
}

export function track(name: string, data?: EventData): void {
  try {
    window.umami?.track(name, data)
  } catch {
    /* analytics must never break the app */
  }
}
