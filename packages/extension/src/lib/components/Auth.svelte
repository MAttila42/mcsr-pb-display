<script lang='ts'>
  import { useAuth } from '$lib/auth'
  import { Button } from '$lib/components/ui/button'

  const auth = useAuth()

  const redirectTo = `${import.meta.env.VITE_API_URL}/auth-success`
</script>

<Button onclick={() => auth.signIn('microsoft', { redirectTo })}>Link Minecraft Account</Button>
