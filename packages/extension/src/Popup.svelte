<script lang='ts'>
  import type { UserResponse } from '@api/types/user'
  import { api } from '$lib/api'
  import KoFi from '$lib/components/KoFi.svelte'
  import Ranked from '$lib/components/Ranked.svelte'
  import Search from '$lib/components/Search.svelte'
  import Twitch from '$lib/components/Twitch.svelte'
  import { userStore } from '$lib/stores/user.svelte'
  import { onMount } from 'svelte'
  import browser from 'webextension-polyfill'
  import '@unocss/reset/tailwind.css'
  import '@fontsource/ubuntu'
  import '@fontsource/ubuntu-mono'
  import logo from '/public/icon.png'

  interface StoredState {
    authToken?: string
    login?: string
  }

  let token: string | undefined = $state('')
  let login: string | undefined = $state('')
  let isLoaded: boolean = $state(false)
  let apiError: string | undefined = $state(undefined)
  let abortController: AbortController | null = null

  const TIMEOUT_MS = 30000

  async function fetchUserData(twLogin: string) {
    const normalizedLogin = twLogin.toLowerCase()
    abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      abortController?.abort()
    }, TIMEOUT_MS)

    try {
      const { data, status } = await api.user({ tw: normalizedLogin }).get({
        fetch: { signal: abortController.signal },
      })

      const userData = data as UserResponse | null

      if (userData) {
        await userStore.setUser(userData)
        userStore.setFetchStatus('loaded')
        apiError = undefined
      }
      else if (status === 404) {
        userStore.resetRuntime()
        userStore.setFetchStatus('error')
      // apiError = `Could not find Twitch user @${normalizedLogin}.`
      }
      else {
        userStore.setFetchStatus('error')
        apiError = 'Failed to fetch user data. Please try again later.'
      }
    }
    catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        userStore.setFetchStatus('error')
        apiError = 'Could not reach the API. Please check your connection and try again.'
      }
      else if (err instanceof Error && err.name !== 'AbortError') {
        userStore.setFetchStatus('error')
        apiError = 'Something went wrong. Please check your connection and try again.'
      }
    }
    finally {
      clearTimeout(timeoutId)
      abortController = null
    }
  }

  onMount(() => {
    (async () => {
      const raw = await browser.storage.local.get(['authToken', 'login'])
      const result = raw as StoredState
      token = result.authToken
      login = result.login?.toLowerCase()
      isLoaded = true
      apiError = undefined

      if (!login) {
        userStore.resetRuntime()
        return
      }

      userStore.setFetchStatus('loading')
      await userStore.hydrate(login)
      userStore.setFetchStatus('loading')
      await fetchUserData(login)
    })()

    return () => {
      if (abortController)
        abortController.abort()
    }
  })
</script>

<main class='m-4 h-max max-h-800 w-xs flex flex-col gap-6'>
  <div class='my-2 flex flex-row items-center justify-center gap-4'>
    <img src={logo} alt='Logo' class='size-12'>
    <h1 class='text-2xl font-bold'>MCSR PB Display</h1>
  </div>
  {#if apiError}
    <p class='border border-destructive/40 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive'>{apiError}</p>
  {/if}
  <Search />
  <div class='flex flex-col gap-3'>
    {#if isLoaded}
      <Twitch name={login} status={userStore.fetchStatus} />
      {#if login}
        <Ranked token={token!} />
      {/if}
    {:else}
      Loading...
    {/if}
  </div>
  <KoFi />
  <div class='flex flex-col text-sm'>
    <div class='flex flex-row items-center justify-center gap-2'>
      <span class='text-foreground/70'>Idea from</span>
      <a
        class='flex flex-row items-center gap-1'
        href='https://www.twitch.tv/couriway'
        target='_blank'
      >
        <span class='i-mdi:twitch size-5'></span>
        <span>Couriway</span>
      </a>
    </div>
    <div class='flex flex-row items-center justify-center gap-2'>
      <span class='text-foreground/70'>Source-code on</span>
      <a
        class='flex flex-row items-center gap-1'
        href='https://github.com/MAttila42/mcsr-pb-display'
        target='_blank'
      >
        <span class='i-mdi:github size-5'></span>
        <span>GitHub</span>
      </a>
    </div>
  </div>
</main>

<style>
  :global(a) {
    --uno: 'text-foreground/90 underline decoration-foreground/50 transition-200 hover:(text-foreground decoration-foreground)';
  }
</style>
