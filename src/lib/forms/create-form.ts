import {
  defaults,
  superForm,
  type FormOptions,
  type Infer,
  type InferIn,
  type SuperValidated,
} from 'sveltekit-superforms';
import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
import type { z } from 'zod';

// Must be an object schema — superforms' adapters require `Record<string, unknown>` output.
type ObjectSchema = z.ZodType<Record<string, unknown>>;

type CreateFormInput<S extends ObjectSchema> = {
  /** Zod schema — used for both `defaults()` and client validators. */
  schema: S;
  /**
   * Optional pre-validated seed from a `+page.ts` / `+page.server.ts` load.
   * When omitted, the form starts from `defaults(zod4(schema))`.
   *
   * Note: the second/third type args use the `'zod4'` tag so the types
   * unify with `defaults(zod4(schema))`. Using plain `Infer<S>` here
   * produces "Type instantiation is excessively deep" errors.
   */
  data?: SuperValidated<Infer<S, 'zod4'>, unknown, InferIn<S, 'zod4'>>;
} & Partial<FormOptions<Infer<S, 'zod4'>>>;

/**
 * Thin wrapper around `superForm` that binds the Zod schema once for both
 * the initial value and the client-side validators. Any `FormOptions` key
 * (including `SPA`, `resetForm`, `onUpdate`, …) can be overridden per-call.
 * Defaults lean toward the common case: SPA mode + keep form on success.
 * Opt out of SPA with `SPA: undefined` (superforms' native "use the form
 * action" signal).
 */
export function createForm<S extends ObjectSchema>({
  schema,
  data,
  ...overrides
}: CreateFormInput<S>) {
  return superForm(data ?? defaults(zod4(schema)), {
    SPA: true,
    resetForm: false,
    validators: zod4Client(schema),
    ...overrides,
  });
}
