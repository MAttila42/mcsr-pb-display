<script lang='ts'>
  import Auth from '$lib/components/Auth.svelte'
  import AuthProvider from '@rttnd/gau/client/svelte/AuthProvider.svelte'
  import '@unocss/reset/tailwind.css'
  import '@fontsource/ubuntu'
</script>

<main class='m-4 flex flex-col gap-4'>
  <AuthProvider baseUrl={`${import.meta.env.VITE_API_URL}/auth`}>
    <h1 class='text-xl font-bold'>MCSR PB Display Extension</h1>
    <Auth />
  </AuthProvider>
</main>
