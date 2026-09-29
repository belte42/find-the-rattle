<script lang="ts">
  import { Github } from 'lucide-svelte'
  import Culprits from './Culprits.svelte'

  interface Props {
    /** Open with what the app is for (the desktop page has its own intro) */
    intro?: boolean
  }

  let { intro = false }: Props = $props()
</script>

<div class="space-y-4 text-[15px] leading-relaxed text-ios-label2">
  {#if intro}
    <p>
      Most interior rattles and buzzes are resonances: a loose trim panel, clip,
      cable or bracket that vibrates at one particular frequency. Find The
      Rattle plays low-frequency test tones through your car's speakers, so you
      can make the rattle happen on demand while parked and track it down by
      hand.
    </p>
  {/if}
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
    <p class="mb-1 font-semibold text-ios-label">Common culprits</p>
    <Culprits />
  </div>
  <div>
    <p class="mb-1 font-semibold text-ios-label">Tips</p>
    <ul class="list-disc space-y-1 pl-5">
      <li>
        Use <strong class="text-ios-label">Manual</strong> mode with pulse or left/right
        pan to work out which side of the car it's on.
      </li>
      <li>
        Many car speakers produce little below about 35 Hz, so a rattle there
        may only show up in cars with a subwoofer.
      </li>
      <li>
        Measure your delay in Settings, through the car speakers, for more
        accurate results.
      </li>
    </ul>
  </div>
  <p class="text-footnote text-ios-label2">
    <a
      class="inline-flex items-center gap-1 align-bottom text-ios-blue"
      href="https://github.com/belte42/find-the-rattle"
      target="_blank"
      rel="noopener noreferrer"
      ><Github class="h-4 w-4" aria-hidden="true" /> GitHub</a
    >
    · Free and open source ·
    <a
      class="text-ios-blue"
      href="https://github.com/belte42/find-the-rattle/issues"
      target="_blank"
      rel="noopener noreferrer">Report a problem or suggest a feature</a
    >
  </p>
</div>
