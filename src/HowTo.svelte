<script lang="ts">
  import { ArrowLeftRight, Github, Speaker, Timer } from 'lucide-svelte'
  import Culprits from './Culprits.svelte'

  interface Props {
    /** Open with what the app is for (the desktop page has its own intro) */
    intro?: boolean
  }

  let { intro = false }: Props = $props()

  const STEPS = [
    {
      title: 'Connect to the car',
      text: 'Park somewhere quiet and connect your phone over Bluetooth or aux.',
    },
    {
      title: 'Start quiet',
      text: "Raise the volume slowly until something buzzes. Loud isn't better.",
    },
    {
      title: 'Run a Rattle Test',
      text: 'Start a sweep and tap the big pad whenever you hear a rattle.',
    },
    {
      title: 'Hold the tone',
      text: 'Nudge it up or down until the rattle is loudest.',
    },
    {
      title: 'Find it by hand',
      text: 'Press on panels until the noise stops. Name it, then mark it fixed.',
    },
  ]

  const TIPS = [
    {
      icon: ArrowLeftRight,
      text: 'Pulse or left/right balance in Manual shows which side it’s on.',
    },
    {
      icon: Speaker,
      text: 'Most car speakers are weak below about 35 Hz, so rattles there may need a subwoofer.',
    },
    {
      icon: Timer,
      text: 'Measure your delay in Settings for more accurate marks.',
    },
  ]
</script>

<div class="space-y-7 text-subhead text-ios-label2">
  {#if intro}
    <p class="text-body text-ios-label">
      Most rattles are a loose panel or clip that vibrates at one frequency.
      Play that tone to make it rattle on demand, then find it by hand.
    </p>
  {/if}

  <ol class="space-y-4">
    {#each STEPS as step, i (step.title)}
      <li class="flex gap-3">
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ios-blue/15 text-footnote font-semibold text-ios-blue"
          aria-hidden="true">{i + 1}</span
        >
        <div class="min-w-0">
          <p class="text-body font-semibold text-ios-label">{step.title}</p>
          <p>{step.text}</p>
        </div>
      </li>
    {/each}
  </ol>

  <section>
    <h4 class="mb-1 text-body font-semibold text-ios-label">Common culprits</h4>
    <Culprits />
  </section>

  <section>
    <h4 class="mb-3 text-body font-semibold text-ios-label">Tips</h4>
    <ul class="space-y-3">
      {#each TIPS as tip (tip.text)}
        <li class="flex gap-3">
          <tip.icon
            class="mt-0.5 h-5 w-5 shrink-0 text-ios-label3"
            aria-hidden="true"
          />
          <span>{tip.text}</span>
        </li>
      {/each}
    </ul>
  </section>

  <p class="text-footnote">
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
