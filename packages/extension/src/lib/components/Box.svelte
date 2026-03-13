<script lang='ts'>
  import * as Card from '$lib/components/ui/card'

  const {
    img,
    alt,
    class: className,
    secondary,
    children,
  }: {
    img: string
    alt: string
    class?: string
    secondary?: () => any
    children?: () => any
  } = $props()
</script>

<Card.Root
  class={`w-full p-4 ${className}`}
  style='background-color: color-mix(in srgb, var(--color) 25%, transparent); border-color: var(--color);'
>
  <Card.Content class='w-full flex flex-row justify-between gap-6 p-0 text-right text-xl font-bold'>
    <div class='flex flex-col justify-between gap-3'>
      <div class='size-8'>
        <img src={img} alt={alt} class='h-8'>
      </div>
      {#if secondary}
        {@render secondary?.()}
      {/if}
    </div>
    <div class='min-h-8 flex flex-col justify-center truncate font-["Ubuntu_Mono"]'>
      {@render children?.()}
    </div>
  </Card.Content>
</Card.Root>
