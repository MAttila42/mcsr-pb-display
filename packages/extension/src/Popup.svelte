<script lang='ts'>
  import Example from '$lib/components/Example.svelte'
  import { Button } from '$lib/components/ui/button'
  import browser from 'webextension-polyfill'
  import '@unocss/reset/tailwind.css'
  import '@fontsource/ubuntu'

  function openSettings() {
    browser.tabs.create({
      url: 'settings.html',
    })
  }
</script>

<main class='m-4 flex flex-col gap-4'>
  <h1 class='text-xl font-bold'>MCSR PB Display Extension</h1>
  <Button onclick={openSettings}>Settings</Button>
  <Example />
</main>
