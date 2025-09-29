<script lang='ts'>
  import ranked from '$lib/assets/ranked.png'
  import { user } from '$lib/stores/user.svelte'
  import { formatTime } from '$lib/utils'
  import Box from './Box.svelte'
  import { Button } from './ui/button'

  const { token } = $props()
  let loading = $state(false)

  async function link() {
    browser.tabs.create({
      url: `${import.meta.env.VITE_API_URL}/link?profile=xbox#twAccess=${token}`,
    })
    window.close()
  }

  async function unlink() {
    loading = true
    await fetch(`${import.meta.env.VITE_API_URL}/unlink/ranked`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    loading = false
    user.rankedInfo = null
  }
</script>

{#snippet unlinkButton()}
  <Button
    class='size-8 p-0'
    variant='ghost'
    title='Unlink Ranked account'
    onclick={unlink}
    disabled={loading}
  >
    <div class='i-ic:round-link-off size-5'></div>
  </Button>
{/snippet}

<Box
  img={ranked}
  alt='Ranked Logo'
  secondary={user.rankedInfo ? unlinkButton : undefined}
  --color='#86ce34'
>
  {#if user.rankedInfo !== null}
    <span class='flex flex-col items-end'>
      <span>{user.rankedInfo.mcUsername}</span>
      <span>
        <span class='font-medium text-foreground/70 text-lg'>ELO:</span>
        {user.rankedInfo.elo ?? 'N/A'}
      </span>
      <span>
        <span class='font-medium text-foreground/70 text-lg'>PB:</span>
        {user.rankedInfo.pb !== null ? formatTime(user.rankedInfo.pb) : 'N/A'}
      </span>
    </span>
  {:else}
    <Button
      class='bg-#86ce34 text-background hover:bg-#86ce34/80 font-[Ubuntu] h-8'
      onclick={link}
    >Link</Button>
  {/if}
</Box>
