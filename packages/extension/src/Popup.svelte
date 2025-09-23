<script lang='ts'>
  import { Button } from '$lib/components/ui/button'
  import browser from 'webextension-polyfill'
  import '@unocss/reset/tailwind.css'
  import '@fontsource/ubuntu'
  import logo from '/public/icon.png'

  async function link() {
    const result = await browser.storage.local.get('authToken')
    if (!result.authToken) {
      console.error('No auth token found!')
      return
    }

    browser.tabs.create({
      url: `${import.meta.env.VITE_API_URL}/link#twAccess=${result.authToken}`,
    })
    window.close()
  }
</script>

<main class='m-4 flex flex-col gap-3 w-xs h-lg'>
  <div class='flex flex-row gap-4 justify-center items-center my-2'>
    <img src={logo} alt='Logo' class='size-12'>
    <h1 class='text-2xl font-bold'>MCSR PB Display</h1>
  </div>
  <Button onclick={link}>Link Minecraft Account</Button>
</main>
