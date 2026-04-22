<script lang="ts">
  import { useAuth } from '@mmailaender/convex-better-auth-svelte/svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';

  const auth = useAuth();

  let accessToken = $state<string | null>(null);
  let tokenLoading = $state(false);

  async function fetchToken() {
    tokenLoading = true;
    try {
      accessToken = await auth.fetchAccessToken({ forceRefreshToken: true });
    } catch (err) {
      console.error('Error fetching access token:', err);
      accessToken = 'Error fetching token';
    } finally {
      tokenLoading = false;
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Access token</Card.Title>
    <Card.Description>Debug helper — fetch the Convex JWT for this session.</Card.Description>
  </Card.Header>
  <Card.Content class="flex flex-col gap-3">
    <Button onclick={fetchToken} disabled={tokenLoading} size="sm" class="self-start">
      {tokenLoading ? 'Fetching…' : 'Fetch access token'}
    </Button>
    {#if accessToken}
      <pre
        class="max-h-48 overflow-auto rounded-md bg-muted p-3 font-mono text-xs break-all whitespace-pre-wrap text-foreground">{accessToken}</pre>
    {/if}
  </Card.Content>
</Card.Root>
