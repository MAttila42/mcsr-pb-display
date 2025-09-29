<script lang='ts'>
  import * as Card from '$lib/components/ui/card'

  const {
    img,
    alt,
    secondary,
    children,
  }: {
    img: string
    alt: string
    secondary?: () => any
    children?: () => any
  } = $props()
</script>

<Card.Root
  class='w-full p-4'
  style='background-color: color-mix(in srgb, var(--color) 25%, transparent); border-color: var(--color);'
>
  <Card.Content class='w-full flex flex-row justify-between text-xl font-bold text-right p-0 gap-6'>
    <div class='flex flex-col justify-between gap-3'>
      <div class='size-8'>
        <img src={img} alt={alt} class='h-8'>
      </div>
      {#if secondary}
        {@render secondary?.()}
      {/if}
    </div>
    <div class='flex flex-col justify-center font-["Ubuntu_Mono"] truncate min-h-8'>
      {@render children?.()}
    </div>
  </Card.Content>
</Card.Root>
