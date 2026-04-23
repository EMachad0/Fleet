<script lang="ts">
  import { resolve } from '$app/paths';
  import * as Card from '$lib/components/ui/card';
  import { TenantRow } from '../components/tenant-row';

  let { data } = $props();

  const tenants = $derived(data.tenants.data ?? []);
  const slug = $derived(data.currentMembership.tenant.slug);
</script>

<div class="flex flex-col gap-6">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-foreground">Tenants</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      {tenants.length} tenant{tenants.length === 1 ? '' : 's'} across the system.
    </p>
  </div>

  <div class="flex flex-col gap-3">
    {#each tenants as tenant (tenant._id)}
      <TenantRow
        name={tenant.name}
        detail="/{tenant.slug} &middot; {tenant.type.toUpperCase()} &middot; {tenant.memberCount} active / {tenant.totalMemberCount} total"
        href={resolve(`/app/admin/${slug}/tenants/${tenant._id}`)}
      />
    {:else}
      <Card.Root>
        <Card.Content class="py-8">
          <p class="text-center text-sm text-muted-foreground">No tenants found.</p>
        </Card.Content>
      </Card.Root>
    {/each}
  </div>
</div>
