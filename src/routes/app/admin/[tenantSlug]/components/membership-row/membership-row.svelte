<script lang="ts">
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
</script>

<div
  class="flex items-center justify-between rounded-md border border-border px-4 py-3"
  class:opacity-60={archived}
>
  <div>
    <p class="text-sm font-medium text-foreground">{name}</p>
    <p class="text-xs text-muted-foreground">{detail}</p>
  </div>
  {#if !archived && (onrolechange || onarchive)}
    <div class="flex items-center gap-2">
      {#if onrolechange}
        <select
          class="rounded-md border border-border bg-background px-2 py-1 text-xs"
          value={role}
          onchange={(e) => onrolechange?.(e.currentTarget.value as any)}
        >
          <option value="owner">owner</option>
          <option value="admin">admin</option>
          <option value="member">member</option>
        </select>
      {/if}
      {#if onarchive}
        <Button variant="ghost" size="sm" onclick={onarchive}>Archive</Button>
      {/if}
    </div>
  {/if}
</div>
