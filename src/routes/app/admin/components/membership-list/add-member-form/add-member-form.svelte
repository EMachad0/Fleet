<script lang="ts">
  import { PlusIcon } from '@lucide/svelte';
  import { useMutation, useQuery } from '@mmailaender/convex-svelte';
  import { setError } from 'sveltekit-superforms';
  import { api } from '$convex/_generated/api';
  import type { Id } from '$convex/_generated/dataModel';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import * as Form from '$lib/components/ui/form';
  import { createForm } from '$lib/forms';
  import { addMemberSchema } from '$lib/schemas/membership';

  interface Props {
    tenantId: Id<'tenants'>;
  }

  let { tenantId }: Props = $props();

  let addOpen = $state(false);

  const addMembership = useMutation(api.admin.membership_dashboard.memberships.createMembership);

  const candidates = useQuery(api.admin.membership_dashboard.users.listUsersNotInTenant, () =>
    addOpen ? { targetTenantId: tenantId } : 'skip',
  );

  const form = createForm({
    schema: addMemberSchema,
    onUpdate: async ({ form: submitted }) => {
      if (!submitted.valid) return;
      try {
        await addMembership({
          userId: submitted.data.userId,
          targetTenantId: tenantId,
          role: submitted.data.role,
        });
        submitted.data.userId = '';
        submitted.data.role = 'member';
        addOpen = false;
      } catch (e: unknown) {
        const err = e as Record<string, string>;
        setError(submitted, '', err?.data ?? err?.message ?? 'Failed to add membership');
      }
    },
  });

  const { form: formStore, errors, enhance, submitting } = form;
</script>

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
        <form method="POST" use:enhance class="flex flex-col gap-3">
          {#if $errors._errors?.length}
            <p class="text-sm text-destructive" role="alert">{$errors._errors[0]}</p>
          {/if}

          <div class="flex items-end gap-3">
            <Form.Field {form} name="userId" class="flex-1">
              <Form.Control>
                {#snippet children({ props })}
                  <Form.Label>User</Form.Label>
                  <select
                    {...props}
                    bind:value={$formStore.userId}
                    class="h-9 w-full appearance-none rounded-3xl border border-transparent bg-input/50 py-1 pr-8 pl-3 text-sm transition-[color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                  >
                    <option value="" disabled>Select a user...</option>
                    {#each candidates.data ?? [] as user (user._id)}
                      <option value={user._id}>{user.name} ({user.email})</option>
                    {/each}
                  </select>
                {/snippet}
              </Form.Control>
              <Form.FieldErrors />
            </Form.Field>

            <Form.Field {form} name="role">
              <Form.Control>
                {#snippet children({ props })}
                  <Form.Label>Role</Form.Label>
                  <select
                    {...props}
                    bind:value={$formStore.role}
                    class="h-9 appearance-none rounded-3xl border border-transparent bg-input/50 py-1 pr-8 pl-3 text-sm transition-[color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                    <option value="owner">owner</option>
                  </select>
                {/snippet}
              </Form.Control>
              <Form.FieldErrors />
            </Form.Field>

            <Button type="submit" size="sm" disabled={$submitting || !$formStore.userId}>
              {$submitting ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </form>
      </Card.Content>
    </Collapsible.Content>
  </Card.Root>
</Collapsible.Root>
