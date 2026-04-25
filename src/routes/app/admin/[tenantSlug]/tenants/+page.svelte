<script lang="ts">
  import { resolve } from '$app/paths';
  import { PlusIcon } from '@lucide/svelte';
  import { useMutation } from '@mmailaender/convex-svelte';
  import { api } from '$convex/_generated/api';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { TenantRow } from '../components/tenant-row';

  let { data } = $props();

  const tenants = $derived(data.tenants.data ?? []);
  const slug = $derived(data.currentMembership.data!.tenant.slug);

  const createTenant = useMutation(api.admin.createTenant);

  let addOpen = $state(false);
  let newName = $state('');
  let newSlug = $state('');
  let newType = $state<'consumer' | 'contractor'>('consumer');
  let actionError = $state('');

  const derivedSlug = $derived(
    newSlug ||
      newName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
  );

  async function handleCreate() {
    if (!newName.trim() || !derivedSlug) return;
    try {
      actionError = '';
      await createTenant({
        adminSlug: slug,
        name: newName.trim(),
        slug: derivedSlug,
        type: newType,
      });
      newName = '';
      newSlug = '';
      newType = 'consumer';
      addOpen = false;
    } catch (e: unknown) {
      const err = e as Record<string, string>;
      actionError = err?.data ?? err?.message ?? 'Failed to create tenant';
    }
  }
</script>

<div class="flex flex-col gap-6">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-foreground">Tenants</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      {tenants.length} tenant{tenants.length === 1 ? '' : 's'} across the system.
    </p>
  </div>

  {#if actionError}
    <Alert.Root variant="destructive">
      <Alert.Title>Action failed</Alert.Title>
      <Alert.Description>{actionError}</Alert.Description>
    </Alert.Root>
  {/if}

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

  <Collapsible.Root bind:open={addOpen}>
    <Card.Root>
      <Card.Header>
        <Collapsible.Trigger class="flex w-full items-center justify-between">
          <Card.Title>Add tenant</Card.Title>
          <PlusIcon
            class="size-4 text-muted-foreground transition-transform {addOpen ? 'rotate-45' : ''}"
          />
        </Collapsible.Trigger>
      </Card.Header>
      <Collapsible.Content>
        <Card.Content>
          <form
            class="flex flex-col gap-4"
            onsubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
          >
            <div>
              <Label for="tenant-name">Name</Label>
              <Input id="tenant-name" type="text" bind:value={newName} placeholder="Acme Corp" />
            </div>
            <div>
              <Label for="tenant-slug">Slug</Label>
              <Input
                id="tenant-slug"
                type="text"
                bind:value={newSlug}
                placeholder={derivedSlug || 'auto-generated-from-name'}
              />
              {#if derivedSlug}
                <p class="mt-1 text-xs text-muted-foreground">
                  Will be accessible at <span class="font-mono">/{derivedSlug}</span>
                </p>
              {/if}
            </div>
            <div>
              <Label for="tenant-type">Type</Label>
              <select
                id="tenant-type"
                bind:value={newType}
                class="h-9 w-full appearance-none rounded-3xl border border-transparent bg-input/50 py-1 pr-8 pl-3 text-sm transition-[color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <option value="consumer">Consumer</option>
                <option value="contractor">Contractor</option>
              </select>
            </div>
            <Button type="submit" size="sm">Create tenant</Button>
          </form>
        </Card.Content>
      </Collapsible.Content>
    </Card.Root>
  </Collapsible.Root>
</div>
