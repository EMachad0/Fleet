<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { useMutation } from '@mmailaender/convex-svelte';
  import { ConvexError } from 'convex/values';
  import { setError } from 'sveltekit-superforms';
  import { api } from '$convex/_generated/api';
  import { authClient } from '$lib/auth-client';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { createForm } from '$lib/forms';
  import { selectMembershipSchema, type TenantType } from '$lib/schemas/auth';
  import { groupMembershipsByType } from './memberships';

  let { data } = $props();

  // `data.memberships` and `data.user` come from `convexLoad` in
  // `+page.ts`. Grouping lives in the colocated `./memberships`
  // helper so it's unit-tested without a browser and Convex stays
  // presentation-agnostic.
  const groups = $derived(groupMembershipsByType(data.memberships.data ?? []));
  const currentUser = $derived(data.user.data);

  const selectMembership = useMutation(api.memberships.selectMembership);

  const form = createForm({
    schema: selectMembershipSchema,
    onUpdate: async ({ form: submitted }) => {
      if (!submitted.valid) return;

      try {
        const membership = await selectMembership({
          membershipId: submitted.data.membershipId,
        });
        await authClient.updateSession({
          tenantId: membership.tenant._id,
          tenantType: membership.tenant.type,
          tenantName: membership.tenant.name,
        } as Record<string, string>);
        const target = `/app/${membership.tenant.type}/${membership.tenant.slug}`;
        // eslint-disable-next-line svelte/no-navigation-without-resolve
        await goto(target, { invalidateAll: true });
      } catch (err) {
        const message =
          err instanceof ConvexError ? (err.data as string) : 'Could not select that workspace.';
        setError(submitted, 'membershipId', message);
      }
    },
  });

  const { form: formStore, submitting, enhance } = form;

  const typeLabels: Record<TenantType, string> = {
    consumer: 'Consumer',
    contractor: 'Contractor',
    admin: 'Admin',
  };
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Choose a workspace</Card.Title>
    <Card.Description>Pick where you'd like to work today.</Card.Description>
    {#if currentUser}
      <p class="mt-2 text-xs text-muted-foreground">
        Signed in as
        <span class="font-medium text-foreground">{currentUser.name}</span>
        · {currentUser.email}
      </p>
    {/if}
  </Card.Header>
  <Card.Content>
    {#if groups.length === 0}
      <p class="text-sm text-muted-foreground">
        Your account isn't part of any workspace yet. Ask your administrator to add you.
      </p>
    {:else}
      <form method="POST" use:enhance class="flex flex-col gap-5">
        {#each groups as group (group.type)}
          <fieldset class="flex flex-col gap-2">
            <legend
              class="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {typeLabels[group.type]}
            </legend>
            {#each group.memberships as membership (membership._id)}
              <label
                class="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="membershipId"
                  value={membership._id}
                  bind:group={$formStore.membershipId}
                  class="size-4 text-primary focus:ring-primary"
                />
                <span class="flex-1">
                  <span class="block text-sm font-medium text-foreground"
                    >{membership.tenant.name}</span
                  >
                  <span class="block text-xs text-muted-foreground capitalize"
                    >{membership.role}</span
                  >
                </span>
              </label>
            {/each}
          </fieldset>
        {/each}

        <Button type="submit" disabled={$submitting || !$formStore.membershipId}>
          {$submitting ? 'Entering…' : 'Continue'}
        </Button>
      </form>
    {/if}
  </Card.Content>
  <Card.Footer class="justify-center">
    <a
      href={resolve('/auth/logout')}
      class="text-sm text-muted-foreground underline-offset-4 hover:underline"
      data-sveltekit-preload-data="off"
    >
      Sign out instead
    </a>
  </Card.Footer>
</Card.Root>
