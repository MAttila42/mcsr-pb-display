<script lang='ts'>
  import twitch from '$lib/assets/twitch.png'
  import * as Card from '$lib/components/ui/card'
  import Account from './Account.svelte'

  const {
    name,
  }: {
    name?: string
  } = $props()
</script>

{#if name}
  <Account
    img={twitch}
    alt='Twitch Logo'
    --color='#9244ff'
  >{name}</Account>
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
