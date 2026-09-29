<script lang="ts">
  interface Props {
    checked: boolean
    label: string
    onchange: (checked: boolean) => void
  }

  let { checked, label, onchange }: Props = $props()
</script>

<!-- iOS-style on/off switch (51×31pt) -->
<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  class="relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 {checked
    ? 'bg-ios-blue'
    : 'bg-[rgb(120_120_128/0.32)]'}"
  onclick={() => onchange(!checked)}
>
  <span
    class="absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)] transition-transform duration-200 {checked
      ? 'translate-x-[20px]'
      : ''}"
  ></span>
</button>
