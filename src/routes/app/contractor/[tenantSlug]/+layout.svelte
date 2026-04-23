<script lang="ts">
  import { AppShell } from '$lib/components/app/app-shell';

  let { children, data } = $props();
</script>

<AppShell
  typeLabel="Contractor"
  tenantName={data.currentMembership.data?.tenant.name ?? ''}
  userName={data.currentMembership.data?.user.name}
  showSwitch={(data.membershipCount.data ?? 0) > 1}
>
  {@render children()}
</AppShell>
