<script lang="ts">
  import { Button } from '$lib/components/ui/button';

  interface Props {
    name: string;
    detail: string;
    href: string;
  }

  let { name, detail, href }: Props = $props();
</script>

<div class="flex items-center justify-between rounded-md border border-border px-4 py-3">
  <div>
    <p class="text-sm font-medium text-foreground">{name}</p>
    <p class="text-xs text-muted-foreground">{detail}</p>
  </div>
  <Button {href} variant="outline" size="sm">Details</Button>
</div>
