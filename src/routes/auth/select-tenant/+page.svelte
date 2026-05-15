<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import type { TenantType } from '$lib/schemas/tenant';
  import { groupMembershipsByType } from './memberships';

  let { data } = $props();

  const groups = $derived(groupMembershipsByType(data.memberships.data ?? []));
  const currentUser = $derived(data.user.data);

  let selectedId = $state('');

  const typeLabels: Record<TenantType, string> = {
    consumer: 'Consumer',
    contractor: 'Contractor',
    admin: 'Admin',
  };

  const actionError = $derived(page.form?.error as string | undefined);
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
      <form method="POST" class="flex flex-col gap-5">
        {#if actionError}
          <p class="text-sm text-destructive" role="alert">{actionError}</p>
        {/if}

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
                  bind:group={selectedId}
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

        <Button type="submit" disabled={!selectedId}>Continue</Button>
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
