<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { setError } from 'sveltekit-superforms';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { createForm } from '$lib/forms';
  import { loginSchema } from './schemas';
  import { authClient } from '$lib/auth-client';

  /**
   * Translate a Better Auth client error into user-facing copy.
   *
   * Better Auth's API routes throw `APIError.from("UNAUTHORIZED",
   * BASE_ERROR_CODES.X)` for every expected failure, and the values of
   * `BASE_ERROR_CODES` are already human-readable English (e.g. "Invalid
   * email or password"). So for anything that looks like a real API
   * response we pass `error.message` straight through.
   *
   * The only things we override are `@better-fetch/fetch`'s synthetic
   * error shapes for infrastructure failures — the two known sources of
   * "leaky" messages in this stack:
   *
   *   - `"Fetch related error. Captured by catchAllError option…"` when
   *     the network fetch itself throws (proxy can't reach Convex).
   *   - SvelteKit's default 500 body when the proxy handler crashed.
   *
   * We also collapse 5xx into the generic message; those are never
   * user-actionable.
   */
  function mapAuthError(error: { status?: number; message?: string }): string {
    const status = error.status ?? 500;
    const generic = "We couldn't sign you in right now. Please try again in a moment.";

    if (status >= 500) return generic;
    if (!error.message) return generic;
    if (/fetch related error/i.test(error.message)) return generic;

    return error.message;
  }

  const form = createForm({
    schema: loginSchema,
    onUpdate: async ({ form: submitted }) => {
      if (!submitted.valid) return;

      const { error } = await authClient.signIn.email({
        email: submitted.data.email,
        password: submitted.data.password,
      });

      if (error) {
        setError(submitted, '', mapAuthError(error));
        return;
      }

      // Hand routing off to the entry resolver at "/", which knows how to
      // dispatch based on tenant count. `next` is validated server-side too.
      const next = page.url.searchParams.get('next');
      const target = next && next.startsWith('/app') ? next : resolve('/');
      // `next` is a raw string from the URL; we've verified it starts with
      // /app (an open-redirect-safe prefix). ESLint can't see that check.
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      await goto(target, { invalidateAll: true });
    },
  });

  const { form: formStore, errors, message, submitting, enhance } = form;
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Sign in</Card.Title>
    <Card.Description>Enter your email and password to continue.</Card.Description>
  </Card.Header>
  <Card.Content>
    <!--
      `onsubmit` is a belt-and-suspenders preventDefault in case
      `use:enhance` fails to attach its submit listener for any reason
      post-hydration (it normally does this itself). It doesn't protect
      the pre-hydration window — neither listener is attached yet there —
      but that window is typically <100 ms, and the worst case is a
      harmless 405 in dev logs.
    -->
    <form
      method="POST"
      use:enhance
      onsubmit={(e) => e.preventDefault()}
      class="flex flex-col gap-4"
    >
      {#if $errors._errors?.length}
        <Alert.Root variant="destructive">
          <Alert.Title>Sign in failed</Alert.Title>
          <Alert.Description>{$errors._errors[0]}</Alert.Description>
        </Alert.Root>
      {/if}

      <Form.Field {form} name="email">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Email</Form.Label>
            <Input
              {...props}
              type="email"
              autocomplete="email"
              placeholder="you@company.com"
              bind:value={$formStore.email}
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>

      <Form.Field {form} name="password">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Password</Form.Label>
            <Input
              {...props}
              type="password"
              autocomplete="current-password"
              bind:value={$formStore.password}
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>

      {#if $message}
        <p class="text-sm text-destructive">{$message}</p>
      {/if}

      <Button type="submit" disabled={$submitting}>
        {$submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  </Card.Content>
  <Card.Footer class="justify-center">
    <p class="text-sm text-muted-foreground">
      Need an account?
      <a
        href={resolve('/auth/register')}
        class="font-medium text-foreground underline-offset-4 hover:underline"
      >
        Request access
      </a>
    </p>
  </Card.Footer>
</Card.Root>
