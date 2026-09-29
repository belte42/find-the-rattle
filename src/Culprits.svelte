<script lang="ts">
  import { ExternalLink } from 'lucide-svelte'
  import { fade, slide } from 'svelte/transition'
  import { motion } from './lib/motion'

  type Part =
    | 'door-cards'
    | 'dashboard'
    | 'a-pillar'
    | 'buckles'
    | 'sunglasses'
    | 'parcel-shelf'
    | 'number-plate'
    | 'door-pockets'

  interface Culprit {
    id: Part
    name: string
    what: string
    check: string
    /** Image search for real-life photos */
    search: string
  }

  const CULPRITS: Culprit[] = [
    {
      id: 'door-cards',
      name: 'Door cards',
      what: 'The trim panels on the inside of each door, with the armrest, handle and speaker grille. They hang on plastic clips that loosen over time, and the door speaker sits right behind them.',
      check:
        'Press a flat hand on different spots of the panel, and around the speaker grille and window switches.',
      search: 'car door card interior trim panel',
    },
    {
      id: 'dashboard',
      name: 'Dashboard',
      what: 'The large moulded panel under the windscreen, with the vents, screens and glovebox. It is made of many pieces that meet at clipped seams.',
      check:
        'Press along the seams, around the vents and instrument cluster, and on the glovebox lid.',
      search: 'car dashboard trim panels',
    },
    {
      id: 'a-pillar',
      name: 'A-pillar trim',
      what: 'The plastic covers on the pillars either side of the windscreen. They often hide wiring or an airbag, and can buzz against the windscreen or dashboard.',
      check: 'Press along the pillar, from the dashboard up to the roof.',
      search: 'car A-pillar trim',
    },
    {
      id: 'buckles',
      name: 'Seat belt buckles',
      what: 'The metal latches beside each seat. An unused buckle can tap against the seat frame or nearby trim.',
      check: 'Hold the buckle still, or plug it in if nobody sits there.',
      search: 'car seat belt buckle',
    },
    {
      id: 'sunglasses',
      name: 'Sunglasses holder',
      what: 'The flip-down compartment in the roof console, near the rear-view mirror. The lid, or whatever is inside it, can buzz.',
      check: 'Empty it, then press the lid shut.',
      search: 'car overhead sunglasses holder',
    },
    {
      id: 'parcel-shelf',
      name: 'Rear parcel shelf',
      what: 'The removable shelf or cover behind the back seats, under the rear window. In a hatchback it lifts with the boot lid. It only rests on its supports and is often near the rear speakers, so it rattles easily.',
      check: 'Press it down, or lift it out and test again.',
      search: 'car rear parcel shelf',
    },
    {
      id: 'number-plate',
      name: 'Number-plate frames',
      what: 'The plastic surround that holds the number plate on the outside of the car. Loose screws let it tap against the bumper or boot lid.',
      check: 'Press the plate against the car, or tighten its screws.',
      search: 'car number plate frame',
    },
    {
      id: 'door-pockets',
      name: 'Loose items',
      what: 'Coins, keys, bottles and cables in the door pockets, cup holders and glovebox. The easiest rattle to fix.',
      check: 'Empty the pockets and holders before you test.',
      search: 'car door pocket storage',
    },
  ]

  let openId = $state<Part | null>(null)
  const current = $derived(CULPRITS.find((c) => c.id === openId))

  /** Parts inside the cabin are drawn from the driver's seat instead */
  const INTERIOR: Part[] = ['dashboard', 'sunglasses', 'door-pockets']
  const view = $derived(
    openId && INTERIOR.includes(openId) ? 'interior' : 'exterior'
  )

  function toggle(id: Part) {
    openId = openId === id ? null : id
  }
</script>

<div>
  <p class="mb-2">Tap one to see where it is and how to check it.</p>
  <div class="flex flex-wrap gap-2">
    {#each CULPRITS as c (c.id)}
      <button
        type="button"
        class="rounded-full px-3 py-1.5 text-subhead transition-colors {openId ===
        c.id
          ? 'bg-ios-blue text-white'
          : 'bg-ios-fill text-ios-label'}"
        aria-expanded={openId === c.id}
        aria-controls="culprit-detail"
        onclick={() => toggle(c.id)}
      >
        {c.name}
      </button>
    {/each}
  </div>

  {#if current}
    <div
      id="culprit-detail"
      class="mt-3 rounded-2xl bg-ios-card2 p-4"
      transition:slide={{ duration: motion(220) }}
    >
      <!-- Cabin parts show from the driver's seat, the rest from the side -->
      {#key view}
        {#if view === 'interior'}
          <svg
            class="car mx-auto mb-3 block h-auto w-full max-w-sm"
            viewBox="0 0 320 128"
            role="img"
            aria-label="Where to find the {current.name.toLowerCase()} inside a car"
            in:fade={{ duration: motion(200) }}
          >
            <rect class="trim" x="0" y="0" width="320" height="22" />
            <path class="glass" d="M58 22 H262 L296 72 H24 Z" />
            <path
              class="trim"
              d="M0 22 H58 L24 72 H0 Z M320 22 H262 L296 72 H320 Z"
            />
            <rect
              class="part"
              class:on={current.id === 'sunglasses'}
              x="138"
              y="6"
              width="44"
              height="11"
              rx="3"
            />
            <path class="line" d="M160 22 V26" />
            <rect class="trim" x="144" y="26" width="32" height="9" rx="3" />
            <path
              class="part solid"
              class:on={current.id === 'dashboard'}
              d="M0 74 Q160 60 320 74 V104 H0 Z"
            />
            <rect class="detail" x="40" y="77" width="26" height="6" rx="2" />
            <rect class="detail" x="254" y="77" width="26" height="6" rx="2" />
            <rect class="detail" x="134" y="70" width="52" height="22" rx="3" />
            <g class="part" class:on={current.id === 'door-pockets'}>
              <rect x="214" y="86" width="62" height="14" rx="3" />
            </g>
            <path class="trim" d="M128 104 H192 L200 128 H120 Z" />
            <path
              class="trim"
              d="M0 74 L20 76 L28 128 H0 Z M320 74 L300 76 L292 128 H320 Z"
            />
            <g class="part" class:on={current.id === 'door-pockets'}>
              <path d="M2 110 L23 110 L26 124 L2 124 Z" />
              <path d="M318 110 L297 110 L294 124 L318 124 Z" />
              <circle cx="148" cy="116" r="6" />
              <circle cx="172" cy="116" r="6" />
            </g>
            <circle class="rim" cx="86" cy="110" r="30" />
            <path class="rim spoke" d="M58 110 H114 M86 110 V140" />
            <circle class="hub" cx="86" cy="110" r="8" />
          </svg>
        {:else}
          <!-- Side view, front to the left -->
          <svg
            class="car mx-auto mb-3 block h-auto w-full max-w-sm"
            viewBox="0 0 320 128"
            role="img"
            aria-label="Where to find the {current.name.toLowerCase()} on a car"
            in:fade={{ duration: motion(200) }}
          >
            <path
              class="body"
              d="M20 110 L16 92 Q17 84 26 82 L92 74 L134 42 Q138 39 144 39 L218 39 Q224 39 228 43 L262 70 L292 74 Q300 76 301 84 L302 104 Q302 110 296 110 L265 110 A20 20 0 0 0 225 110 L92 110 A20 20 0 0 0 52 110 Z"
            />
            <path class="glass" d="M104 72 L137 45 L168 45 L168 72 Z" />
            <path
              class="glass"
              d="M173 72 L173 45 L216 45 Q221 45 224 48 L252 70 Z"
            />
            <path class="line" d="M100 74 V106 M170 74 V106 M232 74 V106" />
            <circle class="wheel" cx="72" cy="110" r="15" />
            <circle class="wheel" cx="245" cy="110" r="15" />
            <path
              class="seat"
              d="M150 72 L146 52 Q146 47 151 47 L156 47 Q160 47 160 52 L162 72 Z"
            />
            <path
              class="seat"
              d="M205 72 L201 54 Q201 50 205 50 L210 50 Q214 50 214 54 L216 72 Z"
            />
            <g class="part" class:on={current.id === 'door-cards'}>
              <rect x="104" y="76" width="62" height="28" rx="4" />
              <rect x="175" y="76" width="53" height="28" rx="4" />
            </g>
            <path
              class="part pillar"
              class:on={current.id === 'a-pillar'}
              d="M94 73 L135 41"
            />
            <g class="part" class:on={current.id === 'buckles'}>
              <rect x="163" y="63" width="4" height="9" rx="1" />
              <rect x="217" y="63" width="4" height="9" rx="1" />
            </g>
            <path
              class="part"
              class:on={current.id === 'parcel-shelf'}
              d="M218 66 L248 67 L254 71 L222 71 Z"
            />
            <!-- Front and rear plates -->
            <g class="part" class:on={current.id === 'number-plate'}>
              <rect x="11" y="88" width="5" height="12" rx="1" />
              <rect x="299" y="86" width="5" height="12" rx="1" />
            </g>
          </svg>
        {/if}
      {/key}

      <p class="mb-1 font-semibold text-ios-label">{current.name}</p>
      <p class="mb-2">{current.what}</p>
      <p class="mb-3">
        <span class="text-ios-label">How to check:</span>
        {current.check}
      </p>
      <a
        class="inline-flex items-center gap-1 text-ios-blue"
        href="https://www.google.com/search?tbm=isch&q={encodeURIComponent(
          current.search
        )}"
        target="_blank"
        rel="noopener noreferrer"
      >
        See photos <ExternalLink class="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  {/if}
</div>

<style>
  .car :global(*) {
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .body {
    fill: var(--color-ios-card);
    stroke: var(--color-ios-label2);
    stroke-width: 1.5;
  }
  .glass {
    fill: rgb(255 255 255 / 0.06);
    stroke: var(--color-ios-label3);
  }
  .line {
    fill: none;
    stroke: var(--color-ios-label3);
  }
  .wheel {
    fill: var(--color-ios-card3);
    stroke: var(--color-ios-label2);
    stroke-width: 1.5;
  }
  .seat {
    fill: var(--color-ios-card3);
    stroke: var(--color-ios-label3);
  }
  .part {
    fill: transparent;
    stroke: var(--color-ios-label3);
    transition:
      fill 0.25s,
      stroke 0.25s;
  }
  .part.on,
  .part.on > * {
    fill: var(--color-ios-orange);
    stroke: var(--color-ios-orange);
  }
  .trim {
    fill: var(--color-ios-card3);
    stroke: var(--color-ios-label3);
  }
  .detail {
    fill: var(--color-ios-card);
    stroke: var(--color-ios-label3);
  }
  .rim {
    fill: none;
    stroke: var(--color-ios-label2);
    stroke-width: 5;
  }
  .spoke {
    stroke-width: 4;
  }
  .hub {
    fill: var(--color-ios-card3);
    stroke: var(--color-ios-label2);
    stroke-width: 1.5;
  }
  /* Parts that are a solid surface even when not highlighted */
  .part.solid:not(.on) {
    fill: var(--color-ios-card3);
  }
  .pillar {
    fill: none;
    stroke-width: 3;
  }
  .pillar.on {
    fill: none;
    stroke-width: 5;
  }
  .part > * {
    fill: inherit;
    stroke: inherit;
  }
</style>
