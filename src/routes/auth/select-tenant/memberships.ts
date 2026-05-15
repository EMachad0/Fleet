import { tenantTypeSchema, type TenantType } from '$lib/schemas/tenant';

/**
 * Groups the caller's memberships by tenant type, preserving the canonical
 * order defined in `tenantTypeSchema.options` and dropping types with zero
 * memberships. Feed it the flat result of `api.tenant_selection.memberships.listMyMemberships`.
 *
 * Lives route-local — not in the Convex query, not in `$lib` — on purpose:
 *
 *   - The Convex query (`src/convex/tenant_selection/memberships.ts`) stays presentation-
 *     agnostic; its doc-comment calls grouping "the caller's concern" and
 *     this file honours that. A later view that wants "most-recent first"
 *     slices the same flat result without the server growing a `sortBy`
 *     mode flag.
 *
 *   - Inline in `+page.svelte` the helper couldn't be unit-tested without
 *     a browser, and the ordering invariant (consumer before contractor,
 *     more types someday) is exactly the sort of pure logic that should
 *     be verified without booting Playwright. Colocated next to the page
 *     keeps "what calls this?" a one-folder glance.
 *
 *   - In `$lib/` it would be premature promotion. Only one route currently
 *     groups memberships this way; `project-structure` rule 6 is explicit
 *     about keeping single-consumer helpers in the route folder. When a
 *     second consumer appears (e.g. a tenant-switcher in the app shell),
 *     promote to `$lib/queries/memberships.ts` alongside whatever Convex
 *     query wrappers show up at the same time.
 *
 *   - Iterating `tenantTypeSchema.options` keeps the canonical order in
 *     one place — `src/lib/schemas/auth.ts`. Add a new tenant type by
 *     appending to the Zod enum and the grouping updates for free.
 *
 * Generic over the membership shape (`M extends { tenant: { type } }`) so
 * the helper doesn't need to import — and stay in sync with — the full
 * Convex return type. Any caller with a compatible shape can pass it in.
 */
export type MembershipGroup<M extends { tenant: { type: TenantType } }> = {
  type: TenantType;
  memberships: M[];
};

export function groupMembershipsByType<M extends { tenant: { type: TenantType } }>(
  memberships: M[],
): MembershipGroup<M>[] {
  return tenantTypeSchema.options
    .map((type) => ({
      type,
      memberships: memberships.filter((m) => m.tenant.type === type),
    }))
    .filter((group) => group.memberships.length > 0);
}
