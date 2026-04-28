<script lang="ts">
  import { resolve } from '$app/paths';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { TenantRow } from './components/tenant-row';

  let { data } = $props();

  const tenants = $derived(data.tenants.data ?? []);

  const consumerCount = $derived(tenants.filter((t) => t.type === 'consumer').length);
  const contractorCount = $derived(tenants.filter((t) => t.type === 'contractor').length);
  const totalMembers = $derived(tenants.reduce((sum, t) => sum + t.memberCount, 0));
</script>

<div class="flex flex-col gap-6">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-foreground">Admin Dashboard</h1>
    <p class="mt-1 text-sm text-muted-foreground">System overview and administrative tools.</p>
  </div>

  <div class="grid gap-4 sm:grid-cols-3">
    <Card.Root>
      <Card.Header>
        <Card.Description>Consumer tenants</Card.Description>
        <Card.Title class="text-3xl tabular-nums">{consumerCount}</Card.Title>
      </Card.Header>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Description>Contractor tenants</Card.Description>
        <Card.Title class="text-3xl tabular-nums">{contractorCount}</Card.Title>
      </Card.Header>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Description>Active memberships</Card.Description>
        <Card.Title class="text-3xl tabular-nums">{totalMembers}</Card.Title>
      </Card.Header>
    </Card.Root>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>Tenants</Card.Title>
      <Card.Description>All tenants across the system.</Card.Description>
    </Card.Header>
    <Card.Content>
      <div class="flex flex-col gap-3">
        {#each tenants as tenant (tenant._id)}
          <TenantRow
            name={tenant.name}
            detail="{tenant.type.toUpperCase()} &middot; {tenant.memberCount} active member{tenant.memberCount ===
            1
              ? ''
              : 's'}"
            href={resolve(`/app/admin/tenants/${tenant._id}`)}
          />
        {:else}
          <p class="py-4 text-center text-sm text-muted-foreground">No tenants found.</p>
        {/each}
      </div>
    </Card.Content>
    <Card.Footer>
      <Button href={resolve('/app/admin/tenants')} variant="ghost" size="sm">
        View all tenants
      </Button>
    </Card.Footer>
  </Card.Root>
</div>
