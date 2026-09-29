<script lang="ts">
  import type { Snippet } from 'svelte'
  import { cubicOut } from 'svelte/easing'
  import { fade } from 'svelte/transition'
  import { motion } from './lib/motion'

  interface Props {
    title: string
    onClose: () => void
    children: Snippet
  }

  let { title, onClose, children }: Props = $props()

  const titleId = $props.id()
  /** Drag further than this share of the sheet's height, or flick down, to close */
  const CLOSE_FRACTION = 0.3
  const CLOSE_VELOCITY = 0.5 // px/ms
  /** A finger held still this long before letting go isn't a flick */
  const FLICK_MS = 100

  let sheet = $state<HTMLDivElement>()
  let dragY = $state(0)
  let dragging = $state(false)
  let startY = 0
  let lastY = 0
  let lastT = 0
  let velocity = 0

  const backdropOpacity = $derived(
    sheet && dragY > 0 ? Math.max(0, 1 - dragY / sheet.offsetHeight) : 1
  )

  /** Slide up from below the screen (and back down from wherever it was dragged to) */
  function rise(node: HTMLElement, { duration }: { duration: number }) {
    const base = getComputedStyle(node).transform
    const from = base === 'none' ? '' : base
    return {
      duration: motion(duration),
      easing: cubicOut,
      css: (_t: number, u: number) =>
        `transform: ${from} translateY(${u * 100}%)`,
    }
  }

  function dragStart(y: number) {
    dragging = true
    startY = y
    lastY = y
    lastT = performance.now()
    velocity = 0
  }

  function dragMove(y: number) {
    const now = performance.now()
    velocity = (y - lastY) / Math.max(1, now - lastT)
    lastY = y
    lastT = now
    const dy = y - startY
    // Upwards it only gives a little, like iOS
    dragY = dy > 0 ? dy : -Math.sqrt(-dy)
  }

  function dragEnd() {
    if (!dragging) return
    dragging = false
    const flick =
      velocity > CLOSE_VELOCITY && performance.now() - lastT < FLICK_MS
    if (dragY > sheet!.offsetHeight * CLOSE_FRACTION || flick) onClose()
    else dragY = 0
  }

  // Header: drag with any pointer (touch or mouse), tracked on the window so
  // the drag continues wherever the pointer goes
  function onHeaderDown(e: PointerEvent) {
    if (e.button !== 0 || (e.target as Element).closest('button')) return
    const id = e.pointerId
    const move = (ev: PointerEvent) =>
      ev.pointerId === id && dragMove(ev.clientY)
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      dragEnd()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    dragStart(e.clientY)
  }

  /** Body: pulling down while scrolled to the top drags the sheet instead of scrolling */
  function pullToClose(node: HTMLElement) {
    let tracking = false
    let active = false
    let y0 = 0
    const start = (e: TouchEvent) => {
      const target = e.target as Element
      tracking =
        node.scrollTop <= 0 &&
        !target.closest('[data-no-drag], input[type="range"]')
      active = false
      y0 = e.touches[0].clientY
    }
    const move = (e: TouchEvent) => {
      if (!tracking) return
      const y = e.touches[0].clientY
      if (!active) {
        if (y <= y0) {
          tracking = false // scrolling up: leave it to the browser
          return
        }
        active = true
        dragStart(y0)
      }
      e.preventDefault()
      dragMove(y)
    }
    const end = () => {
      if (active) dragEnd()
      tracking = active = false
    }
    node.addEventListener('touchstart', start, { passive: true })
    node.addEventListener('touchmove', move, { passive: false })
    node.addEventListener('touchend', end)
    node.addEventListener('touchcancel', end)
    return {
      destroy() {
        node.removeEventListener('touchstart', start)
        node.removeEventListener('touchmove', move)
        node.removeEventListener('touchend', end)
        node.removeEventListener('touchcancel', end)
      },
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<div
  class="fixed inset-0 z-40 flex items-end justify-center md:absolute"
  role="presentation"
>
  <div
    class="absolute inset-0 bg-black/50"
    style="opacity: {backdropOpacity}"
    role="presentation"
    onclick={onClose}
    transition:fade={{ duration: motion(250) }}
  ></div>
  <div
    bind:this={sheet}
    class="sheet relative flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-[14px] bg-ios-card md:max-h-[92%]"
    class:settle={!dragging}
    style="transform: translateY({dragY}px)"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    in:rise={{ duration: 420 }}
    out:rise={{ duration: 280 }}
  >
    <!-- Grabber + navigation bar: drag down to close -->
    <div
      class="shrink-0 cursor-grab touch-none px-4 pt-2 select-none active:cursor-grabbing"
      role="presentation"
      onpointerdown={onHeaderDown}
    >
      <div class="mx-auto mb-1 h-[5px] w-9 rounded-full bg-ios-label3"></div>
      <div class="relative mb-2 flex h-11 items-center justify-center">
        <h2 id={titleId} class="text-body font-semibold">{title}</h2>
        <button
          type="button"
          class="absolute right-0 px-1 py-2 text-body font-semibold text-ios-blue active:opacity-50"
          onclick={onClose}
        >
          Done
        </button>
      </div>
    </div>
    <div
      class="sheet-body overflow-y-auto overscroll-contain px-4 pt-2"
      use:pullToClose
    >
      {@render children()}
    </div>
  </div>
</div>

<style>
  /* Spring back after a drag that didn't close the sheet */
  .settle {
    transition: transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1);
  }
  .sheet-body {
    padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
  }
  @media (prefers-reduced-motion: reduce) {
    .settle {
      transition: none;
    }
  }
</style>
