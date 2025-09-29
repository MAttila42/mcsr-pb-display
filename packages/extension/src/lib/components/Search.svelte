<script lang='ts'>
  import type { UserResponse } from '@api/types/user'
  import rankedLogo from '$lib/assets/ranked.png'
  import twitchLogo from '$lib/assets/twitch.png'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { formatTime } from '$lib/utils'

  let lookupName: string = $state('')
  let lookupResult: UserResponse | null = $state(null)
  let lookupError: string | undefined = $state(undefined)
  let lookupLoading: boolean = $state(false)

  async function lookupUser(event: SubmitEvent) {
    event.preventDefault()
    const trimmed = lookupName.trim()
    lookupError = undefined
    lookupResult = null

    if (!trimmed) {
      lookupError = 'Enter a Twitch username to search.'
      return
    }

    lookupLoading = true
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/user/${trimmed}`)
      if (res.ok)
        lookupResult = await res.json()
      else if (res.status === 404)
        lookupError = `No data found for @${trimmed}.`
      else
        lookupError = 'Failed to fetch user data. Please try again later.'
    }
    catch (error) {
      console.error('Lookup failed', error)
      lookupError = 'Something went wrong. Please check your connection and try again.'
    }
    finally {
      lookupLoading = false
    }
  }
</script>

<Card.Root class='p-3'>
  <Card.Content class='space-y-3 p-0'>
    <form class='flex items-center gap-2' onsubmit={lookupUser}>
      <input
        class='flex-1 rounded-lg border border-foreground/15 bg-background/80 px-3 py-2 text-sm font-[Ubuntu] text-foreground placeholder:text-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40'
        placeholder='Check Twitch user'
        bind:value={lookupName}
        aria-label='Twitch username search input'
        autocomplete='off'
        name='lookup'
      >
      <Button
        class='font-[Ubuntu] px-4'
        type='submit'
        disabled={lookupLoading}
      >
        <div class='i-fluent:search-12-filled size-4'></div>
      </Button>
    </form>
    {#if lookupError}
      <p class='rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>{lookupError}</p>
    {:else if lookupResult}
      <Card.Root class='py-3 text-sm bg-background'>
        <Card.Content class='px-4'>
          <div class='space-y-3'>
            <div class='flex items-center justify-between gap-3'>
              <div class='flex items-center gap-3'>
                <div class='w-6'>
                  <img src={twitchLogo} alt='Twitch logo' class='h-6'>
                </div>
                <span class='font-medium uppercase tracking-wide text-xs text-foreground/60'>Twitch</span>
              </div>
              <a
                href={`https://www.twitch.tv/${lookupResult.twLogin}`}
                class='font-semibold text-base leading-tight truncate'
              >{lookupResult.twLogin}</a>
            </div>
            <div class='h-px bg-foreground/10'></div>
            <div class='space-y-2'>
              <div class='flex items-center gap-3 text-foreground/70'>
                <img src={rankedLogo} alt='Ranked logo' class='h-6'>
                <span class='font-medium uppercase tracking-wide text-xs text-foreground/60'>Ranked</span>
              </div>
              {#if lookupResult.rankedInfo}
                <div class='flex flex-row justify-between'>
                  <span class='font-medium'>IGN</span>
                  <a class='truncate' href={`https://mcsrranked.com/stats/${lookupResult.rankedInfo.mcUsername}`}>{lookupResult.rankedInfo.mcUsername}</a>
                </div>
                <div class='flex flex-row justify-between'>
                  <span class='font-medium'>ELO</span>
                  <span>{lookupResult.rankedInfo.elo ?? 'N/A'}</span>
                </div>
                <div class='flex flex-row justify-between'>
                  <span class='font-medium'>PB</span>
                  <span>{lookupResult.rankedInfo.pb !== null ? formatTime(lookupResult.rankedInfo.pb) : 'N/A'}</span>
                </div>
              {:else}
                <p class='text-foreground/70'>No ranked account linked yet.</p>
              {/if}
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  </Card.Content>
</Card.Root>
