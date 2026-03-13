<script lang='ts'>
  import { api } from '$lib/api'
  import ranked from '$lib/assets/ranked.png'
  import { user, userStore } from '$lib/stores/user.svelte'
  import { formatTime } from '$lib/utils'
  import Box from './Box.svelte'
  import { Button } from './ui/button'

  const { token } = $props()
  let loading = $state(false)
  let mcUsername = $state('')
  let linkError = $state<string | undefined>(undefined)
  let linkLoading = $state(false)

  const isLoading = $derived(userStore.fetchStatus === 'loading')
  const hasLinkedAccount = $derived(user.rankedInfo !== null)
  const showLinkForm = $derived(userStore.fetchStatus === 'loaded' && user.rankedInfo === null)
  const rankedInfo = $derived(hasLinkedAccount ? user.rankedInfo : null)

  async function link() {
    browser.tabs.create({
      url: `${import.meta.env.VITE_API_URL}/link?profile=xbox#twAccess=${token}`,
    })
    window.close()
  }

  async function unlink() {
    loading = true
    try {
      await api.unlink({ account: 'ranked' }).post(null, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      await userStore.setUnlinked(user.twLogin)
      userStore.setFetchStatus('loaded')
    }
    finally {
      loading = false
    }
  }

  async function submitLink(event: SubmitEvent) {
    event.preventDefault()
    const trimmed = mcUsername.trim()
    if (!trimmed) {
      linkError = 'Enter your Minecraft username.'
      return
    }

    linkLoading = true
    linkError = undefined

    try {
      const { data } = await api.user.link.ranked.post(
        { mcUsername: trimmed },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      if (data?.outcome === 'success' && data.rankedInfo) {
        await userStore.setUser({
          twLogin: user.twLogin,
          rankedInfo: data.rankedInfo,
        })
        userStore.setFetchStatus('loaded')
        mcUsername = ''
      }
      else if (data?.outcome === 'fallback') {
        linkError = data.message
        link()
      }
      else {
        linkError = 'Failed to link account. Redirecting to Microsoft login...'
        link()
      }
    }
    catch {
      linkError = 'Failed to link account. Redirecting to Microsoft login...'
      link()
    }
    finally {
      linkLoading = false
    }
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
  secondary={hasLinkedAccount ? unlinkButton : undefined}
  --color='#86ce34'
>
  {#if hasLinkedAccount}
    <span class='flex flex-col items-end'>
      <span class='flex items-center justify-end gap-2'>
        {#if isLoading}
          <div class='i-fluent:spinner-ios-16-filled size-5 animate-spin text-foreground/60'></div>
        {/if}
        <span>{rankedInfo!.mcUsername}</span>
      </span>
      <span>
        <span class='text-lg text-foreground/70 font-medium'>ELO:</span>
        {rankedInfo!.elo ?? 'N/A'}
      </span>
      <span>
        <span class='text-lg text-foreground/70 font-medium'>PB:</span>
        {rankedInfo!.pb !== null ? formatTime(rankedInfo!.pb) : 'N/A'}
      </span>
    </span>
  {:else if isLoading}
    <span class='flex items-center gap-2'>
      <div class='i-fluent:spinner-ios-16-filled size-5 animate-spin'></div>
      <span class='text-foreground/50'>Loading...</span>
    </span>
  {:else if showLinkForm}
    <form class='flex items-center gap-2' onsubmit={submitLink}>
      <input
        class='h-8 w-full flex-1 border rounded-lg bg-background/80 px-3 py-2 text-sm font-[Ubuntu] focus:border-#86ce34 focus:shadow-none focus:outline-none focus:ring-none'
        placeholder='Minecraft username'
        bind:value={mcUsername}
        aria-label='Minecraft username'
        autocomplete='off'
        disabled={linkLoading}
      >
      <Button
        class='h-8 w-8 bg-#86ce34 p-0 text-background font-[Ubuntu] hover:bg-#86ce34/80'
        type='submit'
        disabled={linkLoading}
      >
        {#if linkLoading}
          <div class='i-fluent:spinner-ios-16-filled size-4 animate-spin'></div>
        {:else}
          <div class='i-fluent:arrow-right-24-filled size-4'></div>
        {/if}
      </Button>
    </form>
    {#if linkError}
      <p class='truncate text-xs text-orange'>{linkError}</p>
    {/if}
  {:else}
    <span class='text-foreground/50'>Unavailable</span>
  {/if}
</Box>
