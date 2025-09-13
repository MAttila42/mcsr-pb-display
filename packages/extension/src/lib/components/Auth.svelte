<script lang='ts'>
  import { useAuth } from '$lib/auth'
  import { Button } from '$lib/components/ui/button'

  const auth = useAuth()
</script>

<Button onclick={() => auth.signIn('microsoft')}>Link Minecraft Account</Button>
