<script lang="ts">
  import * as Card from '$lib/components/ui/card';

  interface Membership {
    _id: string;
    role: 'owner' | 'admin' | 'member';
    archivedAt?: number;
    user: { name: string; email: string } | null;
  }

  interface Props {
    name: string;
    slug: string;
    type: string;
    createdAt: number;
    memberships: Membership[];
  }

  let { name, slug, type, createdAt, memberships }: Props = $props();

  const active = $derived(memberships.filter((m) => m.archivedAt === undefined));
  const owners = $derived(active.filter((m) => m.role === 'owner').length);
  const admins = $derived(active.filter((m) => m.role === 'admin').length);
  const members = $derived(active.filter((m) => m.role === 'member').length);
  const archived = $derived(memberships.filter((m) => m.archivedAt !== undefined).length);
</script>

<div class="grid gap-4 sm:grid-cols-2">
  <Card.Root>
    <Card.Header>
      <Card.Title>Details</Card.Title>
    </Card.Header>
    <Card.Content>
      <dl class="flex flex-col gap-3 text-sm">
        <div class="flex justify-between">
          <dt class="text-muted-foreground">Name</dt>
          <dd class="font-medium text-foreground">{name}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-muted-foreground">Slug</dt>
          <dd class="font-mono text-foreground">/{slug}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-muted-foreground">Type</dt>
          <dd class="font-medium text-foreground uppercase">{type}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-muted-foreground">Created</dt>
          <dd class="text-foreground">{new Date(createdAt).toLocaleDateString()}</dd>
        </div>
      </dl>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title>Membership breakdown</Card.Title>
    </Card.Header>
    <Card.Content>
      <dl class="flex flex-col gap-3 text-sm">
        <div class="flex justify-between">
          <dt class="text-muted-foreground">Owners</dt>
          <dd class="font-medium text-foreground tabular-nums">{owners}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-muted-foreground">Admins</dt>
          <dd class="font-medium text-foreground tabular-nums">{admins}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-muted-foreground">Members</dt>
          <dd class="font-medium text-foreground tabular-nums">{members}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-muted-foreground">Archived</dt>
          <dd class="font-medium text-foreground tabular-nums">{archived}</dd>
        </div>
      </dl>
    </Card.Content>
  </Card.Root>
</div>
