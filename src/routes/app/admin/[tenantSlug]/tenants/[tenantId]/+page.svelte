<script lang="ts">
  import { resolve } from '$app/paths';
  import { useMutation } from '@mmailaender/convex-svelte';
  import { api } from '$convex/_generated/api';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { MembershipRow } from '../../components/membership-row';

  let { data } = $props();

  const tenant = $derived(data.tenant.data);
  const slug = $derived(data.currentMembership.tenant.slug);

  const archiveMembership = useMutation(api.admin.archiveMembership);
  const updateRole = useMutation(api.admin.updateMembershipRole);
  const addMembership = useMutation(api.admin.createMembership);

  let newUserId = $state('');
  let newRole = $state<'owner' | 'admin' | 'member'>('member');
  let actionError = $state('');

  async function handleArchive(membershipId: string) {
    try {
      actionError = '';
      await archiveMembership({ adminSlug: slug, membershipId: membershipId as any });
    } catch (e: any) {
      actionError = e?.data ?? e?.message ?? 'Failed to archive membership';
    }
  }

  async function handleRoleChange(membershipId: string, role: 'owner' | 'admin' | 'member') {
    try {
      actionError = '';
      await updateRole({ adminSlug: slug, membershipId: membershipId as any, role });
    } catch (e: any) {
      actionError = e?.data ?? e?.message ?? 'Failed to update role';
    }
  }

  async function handleAddMembership() {
    if (!tenant || !newUserId.trim()) return;
    try {
      actionError = '';
      await addMembership({
        adminSlug: slug,
        userId: newUserId.trim(),
        tenantId: tenant._id as any,
        role: newRole,
      });
      newUserId = '';
      newRole = 'member';
    } catch (e: any) {
      actionError = e?.data ?? e?.message ?? 'Failed to add membership';
    }
  }

  const activeMemberships = $derived(
    tenant?.memberships.filter((m) => m.archivedAt === undefined) ?? [],
  );
  const archivedMemberships = $derived(
    tenant?.memberships.filter((m) => m.archivedAt !== undefined) ?? [],
  );
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

    {#if actionError}
      <Alert.Root variant="destructive">
        <Alert.Title>Action failed</Alert.Title>
        <Alert.Description>{actionError}</Alert.Description>
      </Alert.Root>
    {/if}

    <Card.Root>
      <Card.Header>
        <Card.Title>Active memberships ({activeMemberships.length})</Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="flex flex-col gap-3">
          {#each activeMemberships as membership (membership._id)}
            <MembershipRow
              name={membership.user?.name ?? 'Unknown user'}
              detail={membership.user?.email ?? membership.userId}
              role={membership.role}
              onrolechange={(role) => handleRoleChange(membership._id, role)}
              onarchive={() => handleArchive(membership._id)}
            />
          {:else}
            <p class="py-2 text-center text-sm text-muted-foreground">No active memberships.</p>
          {/each}
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Add membership</Card.Title>
        <Card.Description>Grant a user access to this tenant.</Card.Description>
      </Card.Header>
      <Card.Content>
        <form
          class="flex items-end gap-3"
          onsubmit={(e) => {
            e.preventDefault();
            handleAddMembership();
          }}
        >
          <div class="flex-1">
            <Label for="userId">User ID</Label>
            <Input
              id="userId"
              type="text"
              bind:value={newUserId}
              placeholder="Paste the user's Convex ID"
            />
          </div>
          <div>
            <Label for="role">Role</Label>
            <select
              id="role"
              bind:value={newRole}
              class="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
              <option value="owner">owner</option>
            </select>
          </div>
          <Button type="submit" size="sm">Add</Button>
        </form>
      </Card.Content>
    </Card.Root>

    {#if archivedMemberships.length > 0}
      <Card.Root>
        <Card.Header>
          <Card.Title>Archived ({archivedMemberships.length})</Card.Title>
        </Card.Header>
        <Card.Content>
          <div class="flex flex-col gap-3">
            {#each archivedMemberships as membership (membership._id)}
              <MembershipRow
                name={membership.user?.name ?? 'Unknown user'}
                detail="{membership.user?.email ?? membership.userId} &middot; {membership.role}"
                role={membership.role}
                archived
              />
            {/each}
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
{/if}
