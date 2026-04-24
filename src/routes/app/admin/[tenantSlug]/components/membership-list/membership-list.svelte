<script lang="ts">
  import { PlusIcon, SearchIcon, XIcon } from '@lucide/svelte';
  import { useMutation, useQuery } from '@mmailaender/convex-svelte';
  import { api } from '$convex/_generated/api';
  import type { Id } from '$convex/_generated/dataModel';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { MembershipRow } from '../membership-row';

  interface Membership {
    _id: Id<'memberships'>;
    userId: string;
    role: 'owner' | 'admin' | 'member';
    archivedAt?: number;
    user: { name: string; email: string } | null;
  }

  interface Props {
    adminSlug: string;
    tenantId: Id<'tenants'>;
    memberships: Membership[];
  }

  let { adminSlug, tenantId, memberships }: Props = $props();

  const archiveMembership = useMutation(api.admin.archiveMembership);
  const updateRole = useMutation(api.admin.updateMembershipRole);
  const addMembership = useMutation(api.admin.createMembership);

  let searchOpen = $state(false);
  let searchQuery = $state('');
  let addOpen = $state(false);
  let selectedUserId = $state('');
  let selectedRole = $state<'owner' | 'admin' | 'member'>('member');
  let actionError = $state('');

  const candidates = useQuery(api.admin.listUsersNotInTenant, () =>
    addOpen ? { adminSlug, tenantId } : 'skip',
  );

  const active = $derived(memberships.filter((m) => m.archivedAt === undefined));
  const archived = $derived(memberships.filter((m) => m.archivedAt !== undefined));

  const filtered = $derived(() => {
    if (!searchQuery.trim()) return active;
    const q = searchQuery.toLowerCase();
    return active.filter(
      (m) =>
        m.user?.name.toLowerCase().includes(q) ||
        m.user?.email.toLowerCase().includes(q) ||
        m.userId.toLowerCase().includes(q),
    );
  });

  async function handleAdd() {
    if (!selectedUserId) return;
    try {
      actionError = '';
      await addMembership({ adminSlug, userId: selectedUserId, tenantId, role: selectedRole });
      selectedUserId = '';
      selectedRole = 'member';
      addOpen = false;
    } catch (e: any) {
      actionError = e?.data ?? e?.message ?? 'Failed to add membership';
    }
  }

  async function handleRoleChange(
    membershipId: Id<'memberships'>,
    role: 'owner' | 'admin' | 'member',
  ) {
    try {
      actionError = '';
      await updateRole({ adminSlug, membershipId, role });
    } catch (e: any) {
      actionError = e?.data ?? e?.message ?? 'Failed to update role';
    }
  }

  async function handleArchive(membershipId: Id<'memberships'>) {
    try {
      actionError = '';
      await archiveMembership({ adminSlug, membershipId });
    } catch (e: any) {
      actionError = e?.data ?? e?.message ?? 'Failed to archive membership';
    }
  }
</script>

<div class="flex flex-col gap-4">
  {#if actionError}
    <Alert.Root variant="destructive">
      <Alert.Title>Action failed</Alert.Title>
      <Alert.Description>{actionError}</Alert.Description>
    </Alert.Root>
  {/if}

  <Card.Root>
    <Card.Header>
      <div class="flex items-center justify-between">
        <Card.Title>Members ({active.length})</Card.Title>
        <button
          class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onclick={() => {
            searchOpen = !searchOpen;
            if (!searchOpen) searchQuery = '';
          }}
        >
          {#if searchOpen}
            <XIcon class="size-4" />
          {:else}
            <SearchIcon class="size-4" />
          {/if}
        </button>
      </div>
      {#if searchOpen}
        <Input type="text" placeholder="Search by name or email..." bind:value={searchQuery} />
      {/if}
    </Card.Header>
    <Card.Content>
      <div class="flex flex-col gap-2">
        {#each filtered() as membership (membership._id)}
          <MembershipRow
            name={membership.user?.name ?? 'Unknown user'}
            detail={membership.user?.email ?? membership.userId}
            role={membership.role}
            onrolechange={(role) => handleRoleChange(membership._id, role)}
            onarchive={() => handleArchive(membership._id)}
          />
        {:else}
          <p class="py-4 text-center text-sm text-muted-foreground">
            {searchQuery ? 'No members match your search.' : 'No active members.'}
          </p>
        {/each}
      </div>
    </Card.Content>
  </Card.Root>

  <Collapsible.Root bind:open={addOpen}>
    <Card.Root>
      <Card.Header>
        <Collapsible.Trigger class="flex w-full items-center justify-between">
          <Card.Title>Add member</Card.Title>
          <PlusIcon
            class="size-4 text-muted-foreground transition-transform {addOpen ? 'rotate-45' : ''}"
          />
        </Collapsible.Trigger>
      </Card.Header>
      <Collapsible.Content>
        <Card.Content>
          <form
            class="flex items-end gap-3"
            onsubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
          >
            <div class="flex-1">
              <Label for="add-user">User</Label>
              <select
                id="add-user"
                bind:value={selectedUserId}
                class="h-9 w-full appearance-none rounded-3xl border border-transparent bg-input/50 py-1 pr-8 pl-3 text-sm transition-[color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <option value="" disabled>Select a user...</option>
                {#each candidates.data ?? [] as user (user._id)}
                  <option value={user._id}>{user.name} ({user.email})</option>
                {/each}
              </select>
            </div>
            <div>
              <Label for="add-role">Role</Label>
              <select
                id="add-role"
                bind:value={selectedRole}
                class="h-9 appearance-none rounded-3xl border border-transparent bg-input/50 py-1 pr-8 pl-3 text-sm transition-[color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
                <option value="owner">owner</option>
              </select>
            </div>
            <Button type="submit" size="sm" disabled={!selectedUserId}>Add</Button>
          </form>
        </Card.Content>
      </Collapsible.Content>
    </Card.Root>
  </Collapsible.Root>

  {#if archived.length > 0}
    <Card.Root>
      <Card.Header>
        <Card.Title>Archived ({archived.length})</Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="flex flex-col gap-2">
          {#each archived as membership (membership._id)}
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
