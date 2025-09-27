<script lang='ts'>
  import twitch from '$lib/assets/twitch.png'
  import * as Card from '$lib/components/ui/card'
  import Box from './Box.svelte'

  const {
    name,
  }: {
    name?: string
  } = $props()
</script>

{#if name}
  <Box
    img={twitch}
    alt='Twitch Logo'
    --color='#9244ff'
  >@{name}</Box>
{:else}
  <Card.Root class='b-#ff6f00 bg-#ff6f00/35'>
    <Card.Header>
      <Card.Title>Can't detect Twitch account!</Card.Title>
      <Card.Description class='text-foreground/70'>
        Please fully close Twitch and open again to see your account settings.
      </Card.Description>
    </Card.Header>
  </Card.Root>
{/if}
