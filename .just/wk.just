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

[doc("Create a new worktree and open it in a zellij tab")]
new_ui branch: (new branch) (zellij branch)

[doc("Remove a worktree and its resources")]
rm branch:
    @echo "wk::rm not implemented yet (branch: {{branch}})"

[doc("Open a worktree in a zellij tab")]
zellij branch:
    #!/usr/bin/env bash
    set -euo pipefail
    worktree_path="{{parent_dir}}/{{branch}}"

    if [ -z "${ZELLIJ_SESSION_NAME:-}" ]; then
        echo "Error: not inside a zellij session. Start zellij first."
        exit 1
    fi

    if [ ! -d "${worktree_path}" ]; then
        echo "Error: worktree '../{{branch}}' does not exist. Run 'just wk::new {{branch}}' first."
        exit 1
    fi

    zellij action new-tab \
        --layout "{{repo_root}}/.zellij/layout.kdl" \
        --cwd "${worktree_path}" \
        --name "{{branch}}"
