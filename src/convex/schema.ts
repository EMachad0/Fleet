import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  tenants: defineTable({
    name: v.string(),
    // URL-safe, globally unique across all tenant types. Acts as the
    // tab-level identity under /app/[type]/[slug]/*.
    slug: v.string(),
    // Each tenant type is a distinct product surface with its own routes,
    // navigation, and Convex modules. Adding a new type means a new URL
    // prefix + a new folder tree — never a conditional.
    type: v.union(v.literal('consumer'), v.literal('contractor')),
  }).index('by_slug', ['slug']),

  memberships: defineTable({
    userId: v.string(),
    tenantId: v.id('tenants'),
    role: v.union(v.literal('owner'), v.literal('admin'), v.literal('member')),
    // Timestamp of the last time this membership was picked as the user's
    // active workspace. Stamped at creation (so "never picked" reads as
    // "as of creation") and re-stamped on every `selectMembership`. Drives
    // both the tenant-picker sort order (most-recent first) and the
    // most-recently-used tie-break when we ever need one. Required — see
    // the insert path in `init.ts` and `selectMembership` in `memberships.ts`.
    selectedAt: v.number(),
    // Soft-delete marker. `undefined` = active. Once stamped, the row is
    // excluded from `listMyMemberships`, `getCurrentMembership`, and the
    // landing resolver — it's effectively gone for the user without
    // losing audit history (the row's `_creationTime` and role are still
    // queryable by admins). Clearing the field un-archives.
    archivedAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_tenant_user', ['tenantId', 'userId']),
});
