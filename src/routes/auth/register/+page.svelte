<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Request access</Card.Title>
    <Card.Description>Self-sign-up isn't available yet.</Card.Description>
  </Card.Header>
  <Card.Content>
    <p class="text-sm leading-relaxed text-muted-foreground">
      Fleet accounts are created by your workspace administrator. Ask them to send you an invite —
      we'll email you a link as soon as your account is ready.
    </p>
  </Card.Content>
  <Card.Footer>
    <Button href="/auth/login" class="w-full">Back to sign in</Button>
  </Card.Footer>
</Card.Root>
