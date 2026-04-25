<script lang="ts">
  import { page } from '$app/state';
  import { AppShell } from '$lib/components/app/app-shell';
  import { Button } from '$lib/components/ui/button';

  let { children, data } = $props();

  const pathname = page.url.pathname;
  const navItems = $derived([
    {
      href: '/app/admin',
      label: 'Dashboard',
      active: pathname.startsWith('/app/admin'),
    },
    {
      href: '/app/admin/tenants',
      label: 'Tenants',
      active: pathname.startsWith('/app/admin/tenants'),
    },
    {
      href: '/app/admin/users',
      label: 'Users',
      active: pathname.startsWith('/app/admin/users'),
    },
  ]);
</script>

<AppShell
  typeLabel="Admin"
  tenantName={data.currentMembership.data?.tenant.name ?? ''}
  userName={data.currentMembership.data?.user.name}
  showSwitch={(data.membershipCount.data ?? 0) > 1}
>
  {#snippet nav()}
    {#each navItems as item (item.href)}
      <Button href={item.href} variant={item.active ? 'secondary' : 'ghost'} size="sm">
        {item.label}
      </Button>
    {/each}
  {/snippet}
  {@render children()}
</AppShell>
