import { v7 as uuidv7 } from 'uuid';
import type { MutationCtx } from '$convex/_generated/server';
import type { Doc } from '$convex/_generated/dataModel';

type TenantType = Doc<'tenants'>['type'];

export async function createTenant(ctx: MutationCtx, args: { name: string; type: TenantType }) {
  return ctx.db.insert('tenants', { name: args.name, uuid: uuidv7(), type: args.type });
}
