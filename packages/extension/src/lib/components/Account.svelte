<script lang='ts'>
  import * as Card from '$lib/components/ui/card'

  const {
    img,
    alt,
    children,
  }: {
    img: string
    alt: string
    children?: () => any
  } = $props()
</script>

<Card.Root
  class='w-full p-4'
  style='background-color: color-mix(in srgb, var(--color) 25%, transparent); border-color: var(--color);'
>
  <Card.Content class='w-full flex flex-row justify-between items-center text-xl font-bold text-right p-0 gap-6'>
    <img src={img} alt={alt} class='h-8'>
    <span class='font-["Ubuntu_Mono"] truncate'>
      {@render children?.()}
    </span>
  </Card.Content>
</Card.Root>
