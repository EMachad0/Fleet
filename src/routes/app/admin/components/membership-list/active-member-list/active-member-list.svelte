<script lang="ts">
  import { SearchIcon, XIcon } from '@lucide/svelte';
  import { useMutation } from '@mmailaender/convex-svelte';
  import { api } from '$convex/_generated/api';
  import type { Id } from '$convex/_generated/dataModel';
  import * as Alert from '$lib/components/ui/alert';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { MembershipRow } from '../../membership-row';
  import type { Membership } from '../membership-list.svelte';

  interface Props {
    memberships: Membership[];
  }

  let { memberships }: Props = $props();

  const archiveMembership = useMutation(
    api.admin.membership_dashboard.memberships.archiveMembership,
  );
  const updateRole = useMutation(api.admin.membership_dashboard.memberships.updateMembershipRole);

  let searchOpen = $state(false);
  let searchQuery = $state('');
  let actionError = $state('');

  const filtered = $derived(() => {
    if (!searchQuery.trim()) return memberships;
    const q = searchQuery.toLowerCase();
    return memberships.filter(
      (m) =>
        m.user?.name.toLowerCase().includes(q) ||
        m.user?.email.toLowerCase().includes(q) ||
        m.userId.toLowerCase().includes(q),
    );
  });

  async function handleRoleChange(
    membershipId: Id<'memberships'>,
    role: 'owner' | 'admin' | 'member',
  ) {
    try {
      actionError = '';
      await updateRole({ membershipId, role });
    } catch (e: unknown) {
      const err = e as Record<string, string>;
      actionError = err?.data ?? err?.message ?? 'Failed to update role';
    }
  }

  async function handleArchive(membershipId: Id<'memberships'>) {
    try {
      actionError = '';
      await archiveMembership({ membershipId });
    } catch (e: unknown) {
      const err = e as Record<string, string>;
      actionError = err?.data ?? err?.message ?? 'Failed to archive membership';
    }
  }
</script>

{#if actionError}
  <Alert.Root variant="destructive">
    <Alert.Title>Action failed</Alert.Title>
    <Alert.Description>{actionError}</Alert.Description>
  </Alert.Root>
{/if}

<Card.Root>
  <Card.Header>
    <div class="flex items-center justify-between">
      <Card.Title>Members ({memberships.length})</Card.Title>
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
