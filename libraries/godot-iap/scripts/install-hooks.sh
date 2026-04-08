#!/bin/bash
# Install git hooks from scripts/ folder

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

echo "Installing git hooks..."

# Create symbolic link for pre-commit
if [ -f "$SCRIPT_DIR/pre-commit" ]; then
    ln -sf "$SCRIPT_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
    echo "✓ pre-commit hook installed"
fi

echo "Done!"
