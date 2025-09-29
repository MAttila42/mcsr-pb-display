<script lang='ts'>
  import Ranked from '$lib/components/Ranked.svelte'
  import Search from '$lib/components/Search.svelte'
  import Twitch from '$lib/components/Twitch.svelte'
  import * as Card from '$lib/components/ui/card'
  import { user } from '$lib/stores/user.svelte'
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

  onMount(async () => {
    const raw = await browser.storage.local.get(['authToken', 'login'])
    const result = raw as StoredState
    token = result.authToken
    login = result.login
    isLoaded = true

    if (login) {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/user/${login}`)
      if (res.ok) {
        const userData = await res.json()
        user.twLogin = userData.twLogin
        user.rankedInfo = userData.rankedInfo
      }
      else {
        console.error('Failed to fetch user data')
      }
    }
  })

</script>

<main class='m-4 h-max w-xs flex flex-col gap-4 max-h-800'>
  <div class='my-2 flex flex-row items-center justify-center gap-4'>
    <img src={logo} alt='Logo' class='size-12'>
    <h1 class='text-2xl font-bold'>MCSR PB Display</h1>
  </div>
  <Search />
  <div class='flex flex-col gap-3'>
    {#if isLoaded}
      <h1 class='font-bold'>Your accounts:</h1>
      <Twitch name={login} />
      {#if login}
        <Ranked token={token!} />
      {/if}
    {:else}
      <Card.Root>
        <Card.Header>
          <Card.Title>Loading...</Card.Title>
        </Card.Header>
      </Card.Root>
    {/if}
  </div>
</main>
