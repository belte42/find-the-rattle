<script lang="ts">
  import {
    ArrowLeftRight,
    Cable,
    ChevronRight,
    Github,
    Layers,
    Puzzle,
    Repeat,
    Sticker,
    Timer,
    Wrench,
  } from 'lucide-svelte'
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
      text: "Press on panels until the noise stops. That's your culprit.",
    },
  ]

  const FIXES = [
    {
      icon: Sticker,
      title: 'Felt or foam tape',
      text: 'Stick anti-rattle felt tape where two hard parts touch.',
    },
    {
      icon: Puzzle,
      title: 'Replace broken clips',
      text: 'Pop the panel off with a plastic trim tool and swap any snapped clips.',
    },
    {
      icon: Wrench,
      title: 'Tighten screws',
      text: 'Check any screws holding the part that rattles.',
    },
    {
      icon: Cable,
      title: 'Tie down cables',
      text: 'Wrap loose wiring in fleece tape and secure it with cable ties.',
    },
    {
      icon: Layers,
      title: 'Deaden big panels',
      text: 'Sound-deadening pads stop large panels, like door skins, resonating.',
    },
    {
      icon: Repeat,
      title: 'Test again',
      text: 'Run the same sweep. If it stays quiet, mark the rattle fixed.',
    },
  ]

  const TIPS = [
    {
      icon: ArrowLeftRight,
      text: 'Pulse or left/right balance in Manual shows which side it’s on.',
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
    <h4 class="mb-3 text-body font-semibold text-ios-label">Fixing it</h4>
    <ul class="space-y-3">
      {#each FIXES as fix (fix.title)}
        <li class="flex gap-3">
          <fix.icon
            class="mt-0.5 h-5 w-5 shrink-0 text-ios-label3"
            aria-hidden="true"
          />
          <div class="min-w-0">
            <p class="font-semibold text-ios-label">{fix.title}</p>
            <p>{fix.text}</p>
          </div>
        </li>
      {/each}
    </ul>
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

  <a
    class="flex items-center justify-between gap-3 rounded-xl bg-ios-fill p-4 text-ios-label"
    href="/how-to-find-a-rattle-in-your-car/"
  >
    <span>
      <span class="block font-semibold">Read the full guide</span>
      <span class="text-footnote text-ios-label2"
        >Narrowing it down, more culprits, fixes and FAQ</span
      >
    </span>
    <ChevronRight class="h-5 w-5 shrink-0 text-ios-label3" aria-hidden="true" />
  </a>

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
