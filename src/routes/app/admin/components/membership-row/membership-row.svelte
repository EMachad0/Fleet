<script lang="ts">
  import { PencilIcon, XIcon } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';

  interface Props {
    name: string;
    detail: string;
    role: 'owner' | 'admin' | 'member';
    archived?: boolean;
    onrolechange?: (role: 'owner' | 'admin' | 'member') => void;
    onarchive?: () => void;
  }

  let { name, detail, role, archived = false, onrolechange, onarchive }: Props = $props();

  let editing = $state(false);
</script>

<div
  class="flex items-center justify-between rounded-md border border-border px-4 py-3"
  class:opacity-60={archived}
>
  <div class="min-w-0 flex-1">
    <p class="text-sm font-medium text-foreground">{name}</p>
    <p class="truncate text-xs text-muted-foreground">{detail}</p>
  </div>

  {#if archived}
    <span class="shrink-0 text-xs text-muted-foreground">{role}</span>
  {:else if editing}
    <div class="flex shrink-0 items-center gap-2">
      <select
        class="appearance-none rounded-md border border-border bg-background py-1 pr-6 pl-2 text-xs"
        value={role}
        onchange={(e) => {
          onrolechange?.(e.currentTarget.value as Props['role']);
          editing = false;
        }}
      >
        <option value="owner">owner</option>
        <option value="admin">admin</option>
        <option value="member">member</option>
      </select>
      {#if onarchive}
        <Button variant="ghost" size="sm" onclick={onarchive}>Archive</Button>
      {/if}
      <button class="text-muted-foreground hover:text-foreground" onclick={() => (editing = false)}>
        <XIcon class="size-4" />
      </button>
    </div>
  {:else}
    <div class="flex shrink-0 items-center gap-2">
      <span class="text-xs text-muted-foreground">{role}</span>
      {#if onrolechange || onarchive}
        <button
          class="text-muted-foreground hover:text-foreground"
          onclick={() => (editing = true)}
        >
          <PencilIcon class="size-4" />
        </button>
      {/if}
    </div>
  {/if}
</div>
