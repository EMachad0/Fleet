<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { PlusIcon, SearchIcon, XIcon } from '@lucide/svelte';
  import { useAction } from '@mmailaender/convex-svelte';
  import { api } from '$convex/_generated/api';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  let { data } = $props();

  const users = $derived(data.users.data ?? []);
  const slug = $derived(data.currentMembership.data!.tenant.slug);

  const createUser = useAction(api.admin.createUser);

  let searchOpen = $state(false);
  let searchQuery = $state('');
  let addOpen = $state(false);
  let newName = $state('');
  let newEmail = $state('');
  let newPassword = $state('');
  let actionError = $state('');
  let creating = $state(false);

  const filtered = $derived(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  });

  async function handleCreate() {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) return;
    try {
      actionError = '';
      creating = true;
      await createUser({
        adminSlug: slug,
        email: newEmail.trim(),
        name: newName.trim(),
        password: newPassword.trim(),
      });
      newName = '';
      newEmail = '';
      newPassword = '';
      addOpen = false;
      await invalidateAll();
    } catch (e: unknown) {
      const err = e as Record<string, string>;
      actionError = err?.data ?? err?.message ?? 'Failed to create user';
    } finally {
      creating = false;
    }
  }
</script>

<div class="flex flex-col gap-6">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-foreground">Users</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      {users.length} registered user{users.length === 1 ? '' : 's'}.
    </p>
  </div>

  {#if actionError}
    <Alert.Root variant="destructive">
      <Alert.Title>Action failed</Alert.Title>
      <Alert.Description>{actionError}</Alert.Description>
    </Alert.Root>
  {/if}

  <Card.Root>
    <Card.Header>
      <div class="flex items-center justify-between">
        <Card.Title>All users</Card.Title>
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
        {#each filtered() as user (user._id)}
          <div class="flex items-center justify-between rounded-md border border-border px-4 py-3">
            <div>
              <p class="text-sm font-medium text-foreground">{user.name}</p>
              <p class="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <span class="text-xs text-muted-foreground">
              {user.membershipCount} membership{user.membershipCount === 1 ? '' : 's'}
            </span>
          </div>
        {:else}
          <p class="py-4 text-center text-sm text-muted-foreground">
            {searchQuery ? 'No users match your search.' : 'No users found.'}
          </p>
        {/each}
      </div>
    </Card.Content>
  </Card.Root>

  <Collapsible.Root bind:open={addOpen}>
    <Card.Root>
      <Card.Header>
        <Collapsible.Trigger class="flex w-full items-center justify-between">
          <Card.Title>Add user</Card.Title>
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
              <Label for="new-name">Name</Label>
              <Input id="new-name" type="text" bind:value={newName} placeholder="Jane Doe" />
            </div>
            <div>
              <Label for="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                bind:value={newEmail}
                placeholder="jane@company.com"
              />
            </div>
            <div>
              <Label for="new-password">Password</Label>
              <Input
                id="new-password"
                type="password"
                bind:value={newPassword}
                placeholder="At least 8 characters"
              />
            </div>
            <Button type="submit" size="sm" disabled={creating}>
              {creating ? 'Creating...' : 'Create user'}
            </Button>
          </form>
        </Card.Content>
      </Collapsible.Content>
    </Card.Root>
  </Collapsible.Root>
</div>
