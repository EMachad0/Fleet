<script lang="ts">
  import { AppShell } from '$lib/components/app/app-shell';

  let { children, data } = $props();
</script>

<AppShell
  typeLabel="Contractor"
  tenantName={data.currentMembership.tenant.name}
  userName={data.currentMembership.user.name}
>
  {@render children()}
</AppShell>
