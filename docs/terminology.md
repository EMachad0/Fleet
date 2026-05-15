## When to use

Consult this doc whenever you are:

- Naming a variable, function, table, route, or UI element
- Writing user-facing copy (labels, tooltips, error messages)
- Discussing the domain model in PRs, issues, or commit messages
- Onboarding to the codebase for the first time

## Glossary

### Tenant

The primary organizational unit. Each tenant has a `name`, a `uuid` (v7), and a `type`. In the
database this is the `tenants` table. The UI calls it a **workspace** — see below.

### Workspace

The user-facing label for a **tenant**. The UI says "Choose a workspace", "Switch workspace", etc.
Code and database always use `tenant`. When writing user-visible text, use "workspace". When
writing code, use "tenant".

### Tenant type

One of three product surfaces a tenant belongs to: `consumer`, `contractor`, or `admin`. Each type
gets its own route tree (`/app/consumer`, `/app/contractor`, `/app/admin`) and its own set of
features. The canonical definition lives in `src/convex/schemas/tenant.ts` as `tenantTypeSchema`.

- **Consumer** — end-user/customer-facing workspace
- **Contractor** — service provider workspace
- **Admin** — system administration, full access to all tenants and users

### Membership

The join between a user and a tenant. Lives in the `memberships` table. A membership carries a
**role** and tracks the `selectedAt` timestamp (most-recently-used sorting for the workspace
picker). A user can have multiple memberships across different tenants.

### Role

The access level within a specific membership. Three values:

- **owner** — full control of the tenant
- **admin** — administrative access within the tenant
- **member** — standard access

Roles attach to memberships, not to users directly. The same user can be an `owner` in one tenant
and a `member` in another.

### Archive

Soft-delete semantics. An archived record has an `archivedAt` timestamp; an active record has
`archivedAt: undefined`. Archived memberships are excluded from the workspace picker and current
membership queries but remain queryable by admins for audit history. Clearing the field un-archives.

### Seed data

Development fixtures defined in `src/convex/init.ts`. Three constant arrays — `SEED_USERS`,
`SEED_TENANTS`, `SEED_MEMBERSHIPS` — describe the initial state of a dev database. Applied via
`bun run seed`, cleared via `bun run clear`. The file is declarative: grow by adding entries.
