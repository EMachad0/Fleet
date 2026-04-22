<script lang="ts">
  let { children } = $props();
</script>

<div class="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12">
  <div class="w-full max-w-sm">
    <div class="mb-8 text-center">
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">Fleet</h1>
      <p class="mt-1 text-sm text-muted-foreground">Sign in to your workspace</p>
    </div>
    {@render children()}
  </div>
</div>
