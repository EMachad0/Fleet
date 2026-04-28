<script lang="ts">
  import * as Card from '$lib/components/ui/card';

  interface Props {
    name: string;
    uuid: string;
    type: string;
    createdAt: number;
    memberCounts: { owners: number; admins: number; members: number; archived: number };
  }

  let { name, uuid, type, createdAt, memberCounts }: Props = $props();
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
          <dt class="text-muted-foreground">UUID</dt>
          <dd class="font-mono text-xs text-foreground">{uuid}</dd>
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
          <dd class="font-medium text-foreground tabular-nums">{memberCounts.owners}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-muted-foreground">Admins</dt>
          <dd class="font-medium text-foreground tabular-nums">{memberCounts.admins}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-muted-foreground">Members</dt>
          <dd class="font-medium text-foreground tabular-nums">{memberCounts.members}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-muted-foreground">Archived</dt>
          <dd class="font-medium text-foreground tabular-nums">{memberCounts.archived}</dd>
        </div>
      </dl>
    </Card.Content>
  </Card.Root>
</div>
