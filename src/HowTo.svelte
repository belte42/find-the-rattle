<script lang="ts">
  import { ChevronDown } from 'lucide-svelte'

  interface Props {
    /** Desktop: always open, as a plain section (the page intro is shown separately) */
    expanded?: boolean
  }

  let { expanded = false }: Props = $props()
</script>

{#snippet guide()}
  <ol class="list-decimal space-y-2 pl-5">
    <li>
      Park somewhere quiet and connect your phone to the car stereo over
      Bluetooth or aux.
    </li>
    <li>
      Start with the volume low and raise it slowly until something starts to
      buzz. Loud isn't better.
    </li>
    <li>
      In <strong class="text-ios-label">Rattle Test</strong>, start a sweep and
      tap the big pad whenever you hear a rattle. The frequency is saved,
      corrected for your reaction time.
    </li>
    <li>
      Press <strong class="text-ios-label">Hold</strong> to keep the tone on that
      frequency and nudge it up or down until the rattle is loudest.
    </li>
    <li>
      Press on door cards, dash trim and panels until the noise stops — that's
      the culprit. Name it, then mark it fixed once it's sorted.
    </li>
  </ol>
  <div>
    <p class="mb-1 font-semibold text-ios-label">Tips</p>
    <ul class="list-disc space-y-1 pl-5">
      <li>
        Use <strong class="text-ios-label">Manual</strong> mode with pulse or left/right
        pan to work out which side of the car it's on.
      </li>
      <li>
        Common culprits: door cards, dashboard and A-pillar trim, seat belt
        buckles, sunglasses holders, the rear parcel shelf, number-plate frames
        and loose items in door pockets.
      </li>
      <li>
        Many car speakers produce little below about 35 Hz, so a rattle there
        may only show up in cars with a subwoofer.
      </li>
      <li>
        Measure your reaction time in Settings, through the car speakers, for
        more accurate results.
      </li>
    </ul>
  </div>
  <p class="text-footnote text-ios-label2">
    Free and open source ·
    <a
      class="text-ios-blue"
      href="https://github.com/belte42/find-the-rattle"
      target="_blank"
      rel="noopener noreferrer">Source code</a
    >
    ·
    <a
      class="text-ios-blue"
      href="https://github.com/belte42/find-the-rattle/issues"
      target="_blank"
      rel="noopener noreferrer">Report a problem or suggest a feature</a
    >
  </p>
{/snippet}

{#if expanded}
  <section class="space-y-4 text-[15px] leading-relaxed text-ios-label2">
    <h3 class="text-title3 font-semibold text-ios-label">
      How to find a rattle in your car
    </h3>
    {@render guide()}
  </section>
{:else}
  <details class="group ios-group mt-4">
    <summary
      class="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ios-label"
    >
      How to find a rattle in your car
      <ChevronDown
        class="h-5 w-5 text-ios-label3 transition-transform group-open:rotate-180"
      />
    </summary>
    <div class="space-y-4 px-4 pb-4 text-subhead text-ios-label2">
      <p>
        Most interior rattles and buzzes are resonances: a loose trim panel,
        clip, cable or bracket that vibrates at one particular frequency. Find
        The Rattle plays low-frequency test tones through your car's speakers,
        so you can make the rattle happen on demand while parked and track it
        down by hand.
      </p>
      {@render guide()}
    </div>
  </details>
{/if}
