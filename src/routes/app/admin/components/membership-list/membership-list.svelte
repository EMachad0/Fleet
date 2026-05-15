<script lang="ts" module>
  import type { Id } from '$convex/_generated/dataModel';

  export interface Membership {
    _id: Id<'memberships'>;
    userId: string;
    role: 'owner' | 'admin' | 'member';
    archivedAt?: number;
    user: { name: string; email: string } | null;
  }
</script>

<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { MembershipRow } from '../membership-row';
  import { ActiveMemberList } from './active-member-list';
  import { AddMemberForm } from './add-member-form';

  interface Props {
    tenantId: Id<'tenants'>;
    memberships: Membership[];
  }

  let { tenantId, memberships }: Props = $props();

  const active = $derived(memberships.filter((m) => m.archivedAt === undefined));
  const archived = $derived(memberships.filter((m) => m.archivedAt !== undefined));
</script>

<div class="flex flex-col gap-4">
  <ActiveMemberList memberships={active} />

  <AddMemberForm {tenantId} />

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
