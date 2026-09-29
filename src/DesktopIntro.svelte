<script lang="ts">
  import { Smartphone } from 'lucide-svelte'
  import qrSvg from 'virtual:site-qr'
  import HowTo from './HowTo.svelte'
</script>

<!-- Desktop-only column beside the app: what it is, open-on-phone QR, and the guide -->
<aside class="max-w-xl py-4">
  <h2
    class="mb-4 text-4xl font-bold leading-tight tracking-tight text-ios-label xl:text-5xl"
  >
    Track down rattles and buzzes in your car
  </h2>
  <p class="mb-8 text-lg leading-relaxed text-ios-label2">
    Most rattles are a loose panel, clip or cable vibrating at one frequency.
    Find The Rattle sweeps test tones through your car's speakers, so you can
    make the rattle happen on demand and track it down by hand.
  </p>

  <div
    class="mb-10 flex items-center gap-5 rounded-2xl border border-ios-sep bg-ios-card p-5"
  >
    <div class="qr h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-white p-1">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- generated at build time -->
      {@html qrSvg}
    </div>
    <div>
      <p class="mb-1 flex items-center gap-2 font-semibold text-ios-label">
        <Smartphone class="h-5 w-5 text-ios-orange" /> Best used on your phone
      </p>
      <p class="text-sm leading-relaxed text-ios-label2">
        Scan with your phone's camera to open it, then connect the phone to your
        car stereo over Bluetooth or aux. Nothing to install.
      </p>
    </div>
  </div>

  <section>
    <h3 class="mb-4 text-title3 font-semibold text-ios-label">
      How to find a rattle in your car
    </h3>
    <HowTo />
  </section>
</aside>

<style>
  .qr :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
