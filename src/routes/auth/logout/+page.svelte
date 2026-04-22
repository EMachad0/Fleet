<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { authClient } from '$lib/auth-client';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';

  let signingOut = $state(false);

  async function handleSignOut() {
    signingOut = true;
    try {
      await authClient.signOut();
      await goto(resolve('/auth/login'), { invalidateAll: true });
    } finally {
      signingOut = false;
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Sign out</Card.Title>
    <Card.Description>End your current session.</Card.Description>
  </Card.Header>
  <Card.Content class="flex flex-col gap-3">
    <Button onclick={handleSignOut} disabled={signingOut} variant="destructive" class="w-full">
      {signingOut ? 'Signing out…' : 'Sign out'}
    </Button>
    <Button href={resolve('/app')} variant="ghost" class="w-full" disabled={signingOut}>
      Cancel
    </Button>
  </Card.Content>
</Card.Root>
