repo_root := `git rev-parse --show-toplevel`
parent_dir := repo_root / ".."

[doc("Create a new worktree branched from origin/main")]
new branch:
    #!/usr/bin/env bash
    set -euo pipefail
    worktree_path="{{parent_dir}}/{{branch}}"

    echo "==> Fetching origin/main"
    git fetch origin main

    echo "==> Creating worktree at ../{{branch}}"
    git worktree add "${worktree_path}" -b "{{branch}}" origin/main

    cd "${worktree_path}"

    echo "==> Installing dependencies"
    bun install --silent

    echo "==> Generating Convex secrets"
    bun scripts/generate-convex-secrets.ts > /dev/null

    echo "==> Generating ports"
    bun scripts/generate-ports.ts --auto > /dev/null
    offset=$(grep -m1 '^PORT_OFFSET=' .env | cut -d= -f2)

    echo "==> Generating Claude worktree context"
    BRANCH="{{branch}}" OFFSET="${offset}" envsubst \
        < "{{repo_root}}/.just/templates/worktree.template.md" \
        > .claude/worktree.local.md

    echo "==> Worktree '{{branch}}' is ready at ../{{branch}}"

[doc("Remove a worktree and its resources")]
rm branch:
    @echo "wk::rm not implemented yet (branch: {{branch}})"

[doc("Open a worktree in a zellij session")]
zellij branch:
    @echo "wk::zellij not implemented yet (branch: {{branch}})"
