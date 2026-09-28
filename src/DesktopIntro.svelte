<script lang="ts">
  import { Smartphone } from 'lucide-svelte'
  import qrSvg from 'virtual:site-qr'
  import HowTo from './HowTo.svelte'
</script>

<!-- Desktop-only column beside the app: what it is, open-on-phone QR, and the guide -->
<aside class="max-w-xl py-4">
  <p
    class="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300"
  >
    Free · open source · nothing to install
  </p>
  <h2
    class="mb-4 text-4xl font-bold leading-tight tracking-tight text-slate-50 xl:text-5xl"
  >
    Track down rattles and buzzes in your car
  </h2>
  <p class="mb-8 text-lg leading-relaxed text-slate-400">
    Most interior rattles are a loose panel, clip or cable vibrating at one
    particular frequency. Find The Rattle sweeps test tones through your car's
    own speakers, so you can make the rattle happen on demand while parked and
    track it down by hand.
  </p>

  <div
    class="mb-10 flex items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
  >
    <div class="qr h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-white p-1">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- generated at build time -->
      {@html qrSvg}
    </div>
    <div>
      <p class="mb-1 flex items-center gap-2 font-semibold text-slate-200">
        <Smartphone class="h-5 w-5 text-amber-400" /> Best used on your phone
      </p>
      <p class="text-sm leading-relaxed text-slate-400">
        Scan to open it in the car, connect to the stereo over Bluetooth or aux,
        and add it to your home screen. It works offline too.
      </p>
    </div>
  </div>

  <HowTo expanded />
</aside>

<style>
  .qr :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
