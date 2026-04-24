<script lang="ts">
  import { resolve } from '$app/paths';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Tabs from '$lib/components/ui/tabs';
  import { MembershipList } from '../../components/membership-list';
  import { TenantDashboard } from '../../components/tenant-dashboard';

  let { data } = $props();

  const tenant = $derived(data.tenant.data);
  const slug = $derived(data.currentMembership.data!.tenant.slug);

  const memberCounts = $derived(() => {
    if (!tenant) return { owners: 0, admins: 0, members: 0, archived: 0 };
    const active = tenant.memberships.filter((m) => m.archivedAt === undefined);
    return {
      owners: active.filter((m) => m.role === 'owner').length,
      admins: active.filter((m) => m.role === 'admin').length,
      members: active.filter((m) => m.role === 'member').length,
      archived: tenant.memberships.filter((m) => m.archivedAt !== undefined).length,
    };
  });
</script>

{#if !tenant}
  <Card.Root>
    <Card.Content class="py-8">
      <p class="text-center text-sm text-muted-foreground">Tenant not found.</p>
    </Card.Content>
    <Card.Footer class="justify-center">
      <Button href={resolve(`/app/admin/${slug}/tenants`)} variant="outline" size="sm">
        Back to tenants
      </Button>
    </Card.Footer>
  </Card.Root>
{:else}
  <div class="flex flex-col gap-6">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">{tenant.name}</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          /{tenant.slug} &middot; <span class="uppercase">{tenant.type}</span>
        </p>
      </div>
      <Button href={resolve(`/app/admin/${slug}/tenants`)} variant="outline" size="sm">
        Back to tenants
      </Button>
    </div>

    <Tabs.Root value="dashboard">
      <Tabs.List>
        <Tabs.Trigger value="dashboard">Dashboard</Tabs.Trigger>
        <Tabs.Trigger value="memberships">Memberships</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="dashboard" class="pt-4">
        <TenantDashboard
          name={tenant.name}
          slug={tenant.slug}
          type={tenant.type}
          createdAt={tenant._creationTime}
          memberCounts={memberCounts()}
        />
      </Tabs.Content>

      <Tabs.Content value="memberships" class="pt-4">
        <MembershipList adminSlug={slug} tenantId={tenant._id} memberships={tenant.memberships} />
      </Tabs.Content>
    </Tabs.Root>
  </div>
{/if}
