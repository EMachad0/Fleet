<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { AppShell } from '$lib/components/app/app-shell';
  import { Button } from '$lib/components/ui/button';

  let { children, data } = $props();

  const slug = $derived(data.currentMembership.data!.tenant.slug);

  const navItems = $derived([
    {
      href: resolve(`/app/admin/${slug}`),
      label: 'Dashboard',
      active: page.url.pathname === `/app/admin/${slug}`,
    },
    {
      href: resolve(`/app/admin/${slug}/tenants`),
      label: 'Tenants',
      active: page.url.pathname.startsWith(`/app/admin/${slug}/tenants`),
    },
    {
      href: resolve(`/app/admin/${slug}/users`),
      label: 'Users',
      active: page.url.pathname.startsWith(`/app/admin/${slug}/users`),
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
    {#each navItems as item}
      <Button href={item.href} variant={item.active ? 'secondary' : 'ghost'} size="sm">
        {item.label}
      </Button>
    {/each}
  {/snippet}
  {@render children()}
</AppShell>
