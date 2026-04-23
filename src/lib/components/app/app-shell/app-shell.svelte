<script lang="ts">
  import type { Snippet } from 'svelte';
  import { resolve } from '$app/paths';
  import { Button } from '$lib/components/ui/button';

  interface Props {
    typeLabel: string;
    tenantName: string;
    userName?: string | null;
    showSwitch?: boolean;
    children: Snippet;
    nav?: Snippet;
  }

  let { typeLabel, tenantName, userName, showSwitch = true, children, nav }: Props = $props();
</script>

<div class="flex min-h-svh flex-col bg-background">
  <header class="border-b border-border bg-card">
    <div class="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold tracking-tight text-foreground">Fleet</span>
        <span class="text-xs tracking-wide text-muted-foreground uppercase">{typeLabel}</span>
        <span class="h-4 w-px bg-border" aria-hidden="true"></span>
        <span class="text-sm text-muted-foreground">{tenantName}</span>
      </div>

      <div class="flex items-center gap-3">
        {#if nav}{@render nav()}{/if}
        {#if userName}
          <span class="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
        {/if}
        {#if showSwitch}
          <Button href={resolve('/auth/select-tenant')} variant="ghost" size="sm">Switch</Button>
        {/if}
        <Button href={resolve('/auth/logout')} variant="ghost" size="sm">Sign out</Button>
      </div>
    </div>
  </header>

  <main class="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
    {@render children()}
  </main>
</div>
