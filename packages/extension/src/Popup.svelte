<script lang='ts'>
  import Example from '$lib/components/Example.svelte'
  import { Button } from '$lib/components/ui/button'
  import AuthProvider from '@rttnd/gau/client/svelte/AuthProvider.svelte'
  import browser from 'webextension-polyfill'
  import '@unocss/reset/tailwind.css'
  import '@fontsource/ubuntu'
  import logo from '/public/icon.png'

  function open(url: string) {
    browser.tabs.create({ url })
    window.close()
  }
</script>

<main class='m-4 flex flex-col gap-3 w-xs h-lg'>
  <AuthProvider baseUrl={`${import.meta.env.VITE_API_URL}/auth`}>
    <div class='flex flex-row gap-4 justify-center items-center my-2'>
      <img src={logo} alt='Logo' class='size-12'>
      <h1 class='text-2xl font-bold'>MCSR PB Display</h1>
    </div>
    <Button
      onclick={() => open(
        `${import.meta.env.VITE_API_URL}/auth/microsoft?profile=xbox`,
      )}>Link Minecraft Account</Button>
    <Example />
  </AuthProvider>
</main>
