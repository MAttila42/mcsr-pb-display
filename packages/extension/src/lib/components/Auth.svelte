<script lang='ts'>
  import { useAuth } from '$lib/auth'
  import { Button } from '$lib/components/ui/button'

  const auth = useAuth()
</script>

{#if auth.session?.user}
  <p>Welcome, {auth.session.user.name}!</p>
  <Button onclick={() => auth.signOut()}>Sign Out</Button>
{:else}
  <Button onclick={() => auth.signIn('github')}>Sign in with GitHub</Button>
{/if}
