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
    // active workspace. The membership with the MAX `selectedAt` across a
    // user's memberships *is* their current tenant — no separate "which one
    // is active" state to keep in sync. Undefined means "never activated".
    selectedAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_tenant_user', ['tenantId', 'userId']),
});
