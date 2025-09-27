<script lang='ts'>
  import ranked from '$lib/assets/ranked.png'
  import { formatTime } from '$lib/utils'
  import Box from './Box.svelte'
  import { Button } from './ui/button'

  const {
    token,
    info,
  }: {
    token: string
    info: {
      mcUUID: string
      mcUsername: string
      pb: number | null
      elo: number | null
    } | null
  } = $props()

  async function link() {
    browser.tabs.create({
      url: `${import.meta.env.VITE_API_URL}/link?profile=xbox#twAccess=${token}`,
    })
    window.close()
  }
</script>

<Box
  img={ranked}
  alt='Ranked Logo'
  --color='#86ce34'
>
  {#if info}
    <span class='flex flex-col items-end'>
      <span>{info.mcUsername}</span>
      <span>
        <span class='font-medium text-foreground/70 text-lg'>ELO:</span>
        {info.elo ?? 'N/A'}
      </span>
      <span>
        <span class='font-medium text-foreground/70 text-lg'>PB:</span>
        {info.pb !== null ? formatTime(info.pb) : 'N/A'}
      </span>
    </span>
  {:else}
    <Button
      class='bg-#86ce34 text-background hover:bg-#86ce34/80 font-[Ubuntu]'
      onclick={link}
    >Link</Button>
  {/if}
</Box>
