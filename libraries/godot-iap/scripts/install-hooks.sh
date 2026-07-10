#!/bin/bash
# Install git hooks from scripts/ folder

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

REPO_ROOT="$(git -C "$PROJECT_ROOT" rev-parse --show-toplevel 2>/dev/null)" || {
    echo "Not inside a Git worktree; skipping hook installation."
    exit 0
}

if [ "$REPO_ROOT" != "$PROJECT_ROOT" ]; then
    echo "Using monorepo hooks from $REPO_ROOT; skipping library-local hook installation."
    exit 0
fi

HOOKS_DIR="$(git -C "$PROJECT_ROOT" rev-parse --git-path hooks)"
case "$HOOKS_DIR" in
    /*) ;;
    *) HOOKS_DIR="$PROJECT_ROOT/$HOOKS_DIR" ;;
esac

echo "Installing git hooks..."
mkdir -p "$HOOKS_DIR"

# Create symbolic link for pre-commit
if [ -f "$SCRIPT_DIR/pre-commit" ]; then
    ln -sf "$SCRIPT_DIR/pre-commit" "$HOOKS_DIR/pre-commit" || exit 1
    echo "✓ pre-commit hook installed"
fi

echo "Done!"
