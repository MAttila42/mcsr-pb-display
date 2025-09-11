<script lang='ts'>
  import { useAuth } from '$lib/auth'
  import { Button } from '$lib/components/ui/button'

  const auth = useAuth()

  const redirectTo = `${import.meta.env.VITE_API_URL}/auth-success`
</script>

{#if auth.session?.user}
  <p>Welcome, {auth.session.user.name}!</p>
  <Button onclick={() => auth.signOut()}>Sign Out</Button>
{:else}
  <Button onclick={() => auth.signIn('microsoft', { redirectTo })}>Link Microsoft</Button>
{/if}
