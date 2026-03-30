<script lang='ts'>
  import type { ExtensionVersionSupportResponse } from '@api/types/extension'
  import type { UserResponse } from '@api/types/user'
  import { api } from '$lib/api'
  import KoFi from '$lib/components/KoFi.svelte'
  import Ranked from '$lib/components/Ranked.svelte'
  import Search from '$lib/components/Search.svelte'
  import Twitch from '$lib/components/Twitch.svelte'
  import { fetchWithTimeout } from '$lib/fetch'
  import { userStore } from '$lib/stores/user.svelte'
  import { isVersionAtLeast } from '$lib/utils/version'
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

  type CompatibilityStatus = 'loading' | 'supported' | 'unsupported' | 'error'

  let token: string | undefined = $state('')
  let login: string | undefined = $state('')
  let isLoaded: boolean = $state(false)
  let apiError: string | undefined = $state(undefined)
  let extensionVersion: string = $state('0.0.0')
  let minimumSupportedVersion: string | undefined = $state(undefined)
  let compatibilityStatus: CompatibilityStatus = $state('loading')
  let compatibilityError: string | undefined = $state(undefined)
  let abortController: AbortController | null = null

  const TIMEOUT_MS = 30000

  async function fetchExtensionSupport() {
    try {
      const response = await fetchWithTimeout(`${import.meta.env.VITE_API_URL}/extension/version`, {}, TIMEOUT_MS)

      if (!response.ok) {
        compatibilityStatus = 'error'
        compatibilityError = 'Failed to verify extension compatibility. Please try again later.'
        return
      }

      const data = await response.json() as Partial<ExtensionVersionSupportResponse>
      if (typeof data.minimumSupportedVersion !== 'string') {
        compatibilityStatus = 'error'
        compatibilityError = 'Failed to verify extension compatibility. Please try again later.'
        return
      }

      minimumSupportedVersion = data.minimumSupportedVersion

      if (!isVersionAtLeast(extensionVersion, data.minimumSupportedVersion)) {
        compatibilityStatus = 'unsupported'
        return
      }

      compatibilityStatus = 'supported'
    }
    catch (err) {
      compatibilityStatus = 'error'

      if (err instanceof Error && err.name === 'AbortError')
        compatibilityError = 'Timed out while verifying extension compatibility. Please try again later.'
      else
        compatibilityError = 'Failed to verify extension compatibility. Please try again later.'
    }
  }

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
      extensionVersion = browser.runtime.getManifest().version
      await fetchExtensionSupport()

      if (compatibilityStatus !== 'supported') {
        userStore.resetRuntime()
        isLoaded = true
        return
      }

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
  {#if compatibilityStatus === 'error' && compatibilityError}
    <p class='border border-destructive/40 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive'>{compatibilityError}</p>
  {/if}

  {#if compatibilityStatus === 'supported'}
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
  {:else if compatibilityStatus === 'unsupported'}
    <div class='flex flex-col gap-1 border border-destructive/40 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive'>
      <p>
        This extension version is no longer supported. Please update to
        {#if minimumSupportedVersion}
          v{minimumSupportedVersion}
        {:else}
          the latest version
        {/if}
        or newer.
      </p>
      <a href='https://github.com/MAttila42/mcsr-pb-display/?tab=readme-ov-file#download' target='_blank' class='w-max'>
        Download latest
      </a>
    </div>
  {:else if compatibilityStatus === 'loading'}
    <p class='text-center text-sm text-foreground/70'>Checking extension compatibility...</p>
  {/if}

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
    <div class='mt-1 flex flex-row items-center justify-center gap-2 text-xs text-foreground/70'>
      <span class='font-["Ubuntu_Mono"]'>v{extensionVersion}</span>
    </div>
  </div>
</main>

<style>
  :global(a) {
    --uno: 'text-foreground/90 underline decoration-foreground/50 transition-200 hover:(text-foreground decoration-foreground)';
  }
</style>
