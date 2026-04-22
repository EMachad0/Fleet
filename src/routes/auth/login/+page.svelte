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
  import { loginSchema } from '$lib/schemas/auth';
  import { authClient } from '$lib/auth-client';

  const form = createForm({
    schema: loginSchema,
    onUpdate: async ({ form: submitted }) => {
      if (!submitted.valid) return;

      const { error } = await authClient.signIn.email({
        email: submitted.data.email,
        password: submitted.data.password,
      });

      if (error) {
        setError(submitted, '', error.message ?? 'Could not sign in');
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
    <form method="POST" use:enhance class="flex flex-col gap-4">
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
