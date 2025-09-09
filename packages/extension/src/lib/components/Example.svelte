<script lang='ts'>
  import type { App } from '@api'
  import { Button } from '$lib/components/ui/button'
  import { treaty } from '@elysiajs/eden'

  const client = treaty<App>(import.meta.env.VITE_API_URL!)

  let records = $state<string[]>([])
  listRecords()

  async function listRecords() {
    const { data } = await client.records.get()
    records = data?.map(r => r.text) || []
  }

  async function addRecord() {
    await client.records.post({ text: 'New record' })
    await listRecords()
  }

  async function clearRecords() {
    await client.records.purge.delete()
    records = []
  }
</script>

<div class='flex flex-row gap-2'>
  <Button onclick={addRecord}>
    Add record
  </Button>
  <Button onclick={clearRecords}>
    Clear records
  </Button>
</div>

{#each records as record}
  <div>{record}</div>
{/each}
