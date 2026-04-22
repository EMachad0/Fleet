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

type ObjectSchema = z.ZodType<Record<string, unknown>>;

type CreateFormInput<S extends ObjectSchema> = {
  schema: S;
  data?: SuperValidated<Infer<S, 'zod4'>, unknown, InferIn<S, 'zod4'>>;
} & Partial<FormOptions<Infer<S, 'zod4'>>>;

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
