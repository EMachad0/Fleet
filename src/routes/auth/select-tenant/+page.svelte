<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { useMutation } from '@mmailaender/convex-svelte';
  import { ConvexError } from 'convex/values';
  import { setError } from 'sveltekit-superforms';
  import { api } from '$convex/_generated/api';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { createForm } from '$lib/forms';
  import { selectTenantSchema, type TenantType } from '$lib/schemas/auth';

  let { data } = $props();

  const selectTenant = useMutation(api.tenants.selectTenant);

  const form = createForm({
    schema: selectTenantSchema,
    onUpdate: async ({ form: submitted }) => {
      if (!submitted.valid) return;

      try {
        const landing = await selectTenant({ tenantId: submitted.data.tenantId });
        const target = `/app/${landing.type}/${landing.slug}`;
        // `landing.type` / `landing.slug` come from the validated Convex
        // response; ESLint can't see that check.
        // eslint-disable-next-line svelte/no-navigation-without-resolve
        await goto(target, { invalidateAll: true });
      } catch (err) {
        const message =
          err instanceof ConvexError ? (err.data as string) : 'Could not select that workspace.';
        setError(submitted, 'tenantId', message);
      }
    },
  });

  const { form: formStore, submitting, enhance } = form;

  const typeLabels: Record<TenantType, string> = {
    consumer: 'Consumer',
    contractor: 'Contractor',
  };
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Choose a workspace</Card.Title>
    <Card.Description>Pick where you'd like to work today.</Card.Description>
  </Card.Header>
  <Card.Content>
    {#if data.groups.length === 0}
      <p class="text-sm text-muted-foreground">
        Your account isn't part of any workspace yet. Ask your administrator to add you.
      </p>
    {:else}
      <form method="POST" use:enhance class="flex flex-col gap-5">
        {#each data.groups as group (group.type)}
          <fieldset class="flex flex-col gap-2">
            <legend
              class="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {typeLabels[group.type]}
            </legend>
            {#each group.tenants as tenant (tenant._id)}
              <label
                class="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="tenantId"
                  value={tenant._id}
                  bind:group={$formStore.tenantId}
                  class="size-4 text-primary focus:ring-primary"
                />
                <span class="flex-1">
                  <span class="block text-sm font-medium text-foreground">{tenant.name}</span>
                  <span class="block text-xs text-muted-foreground capitalize">{tenant.role}</span>
                </span>
              </label>
            {/each}
          </fieldset>
        {/each}

        <Button type="submit" disabled={$submitting || !$formStore.tenantId}>
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
