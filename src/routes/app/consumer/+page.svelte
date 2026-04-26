<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { TokenViewer } from '$lib/components/app/token-viewer';

  let { data } = $props();
  const { tenant, user, role } = $derived(data.currentMembership.data!);
</script>

<div class="flex flex-col gap-6">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-foreground">
      Welcome to {tenant.name}
    </h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Consumer workspace · signed in as
      <span class="font-medium text-foreground">{user.name}</span>
      ({role})
    </p>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>Consumer placeholder</Card.Title>
      <Card.Description>
        Your consumer-specific routes will live here (orders, deliveries, tracking, etc.).
      </Card.Description>
    </Card.Header>
  </Card.Root>

  <TokenViewer />
</div>
