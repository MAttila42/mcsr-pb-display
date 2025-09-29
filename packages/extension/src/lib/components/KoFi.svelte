<script lang='ts'>
  import kofi from '$lib/assets/kofi.png'
  import Box from '$lib/components/Box.svelte'

  function open() {
    browser.tabs.create({ url: 'https://ko-fi.com/menyhart/tip' })
    window.close()
  }
</script>

<button class='rounded-xl' onclick={open}>
  <Box
    img={kofi}
    alt='Ko-Fi logo'
    class='py-3'
    --color='#e3d6c6'
  >Buy me a coffee</Box>
</button>
