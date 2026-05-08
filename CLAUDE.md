# Fleet

## Tech Stack

SvelteKit 2, Svelte 5, Convex (backend + database), shadcn-svelte, Superforms + Formsnap, Tailwind CSS 4, TypeScript, Bun, Vitest, Playwright, better-auth

## Required Reading

Before starting work, read any docs that match the task at hand:

- Before starting any task: read `docs/terminology.md`
- Before creating or modifying UI components: read `docs/shadcn-svelte.md`
- Before creating or modifying forms: read `docs/superforms.md`
- Before creating or modifying tests: read `docs/testing.md`
- Before creating or modifying routes, layouts, load functions, server logic: read `docs/sveltekit-best-practices.md`
- Before creating or modifying packages: read `docs/package-manager.md`
- Before creating or modifying files, directories: read `docs/project-structure.md`
- Before creating or modifying skills, docs: read `docs/skills-and-docs.md`
- Before starting a containerized development environment: read `docs/docker-setup.md`
- Before creating or modifying CI/CD workflows: read `docs/cicd.md`

## Shell Rules

- **Never use `find -exec`**. It triggers a permission prompt that cannot be auto-allowed. Use one of these alternatives:
  - `find ... -print0 | xargs -0 command` (pipe to xargs)
  - `fd` (already in the allowed list, modern alternative to find)
- **Never use `npm` or `npx`**. Always use `bun` and `bunx` instead.

## Agent Rules

- **Never use the `AskUserQuestion` tool.** If you need clarification, state your assumption and proceed. If you need to present options, list them in plain text output instead.
