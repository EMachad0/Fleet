<script lang="ts">
  import { dev } from '$app/environment';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';

  const emoji = $derived(
    page.status === 404
      ? ['magnifying glass', 'detective', 'compass', 'map'][Math.floor(Math.random() * 4)]
      : ['wrench', 'fire extinguisher', 'toolbox', 'duct tape'][Math.floor(Math.random() * 4)],
  );

  const quip = $derived(
    page.status === 404
      ? [
          'This page packed its bags and left. No forwarding address.',
          'We looked everywhere. Under the couch cushions, even.',
          "Plot twist: the page was inside us all along. Just kidding, it's gone.",
          "404: Page not found. But you found this page, so that's something!",
        ][Math.floor(Math.random() * 4)]
      : [
          'Something broke. We blame the intern. (There is no intern.)',
          "Well, that wasn't supposed to happen. We're as surprised as you are.",
          'Our servers just made a face like they stepped on a Lego.',
          'Something went sideways. Probably not your fault. Probably.',
        ][Math.floor(Math.random() * 4)],
  );
</script>

<div class="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12">
  <div class="w-full max-w-md">
    <Card.Root>
      <Card.Header class="text-center">
        <p class="text-6xl" role="img" aria-label={emoji}>
          {page.status === 404 ? '\u{1F50D}' : '\u{1F6E0}\u{FE0F}'}
        </p>
        <Card.Title class="text-4xl font-bold tabular-nums">{page.status}</Card.Title>
        <Card.Description class="text-base">{quip}</Card.Description>
      </Card.Header>

      {#if dev && page.error?.message}
        <Card.Content>
          <details class="rounded-md border border-destructive/30 bg-destructive/5 p-3" open>
            <summary class="cursor-pointer text-sm font-medium text-destructive">
              Dev details
            </summary>
            <pre
              class="mt-2 max-h-60 overflow-auto text-xs break-words whitespace-pre-wrap text-muted-foreground">{page
                .error.message}</pre>
          </details>
        </Card.Content>
      {:else if page.error?.message && page.status !== 404}
        <Card.Content>
          <p class="text-center text-sm text-muted-foreground">{page.error.message}</p>
        </Card.Content>
      {/if}

      <Card.Footer class="justify-center">
        <Button href={resolve('/')} variant="outline">Back to safety</Button>
      </Card.Footer>
    </Card.Root>
  </div>
</div>
