#!/bin/bash

# Script to run all CI checks locally before committing
# This helps catch issues before they fail in CI

echo "🚀 Running CI checks locally..."
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any checks fail
FAILED=0

run_check() {
    local title=$1
    local success_message=$2
    local failure_message=$3
    shift 3

    echo -e "\n${YELLOW}${title}${NC}"
    if "$@"; then
        echo -e "${GREEN}✅ ${success_message}${NC}"
    else
        echo -e "${RED}❌ ${failure_message}${NC}"
        if [ -n "${CHECK_HINT:-}" ]; then
            echo -e "${YELLOW}💡 ${CHECK_HINT}${NC}"
        fi
        FAILED=1
    fi
}

run_check "📦 Installing dependencies..." "Dependencies installed" "Dependency installation failed" yarn install --immutable
run_check "⚙️ Generating Nitro code..." "Nitro code generated" "Nitro code generation failed" yarn nitrogen
run_check "🔍 Running TypeScript check..." "TypeScript check passed" "TypeScript check failed" yarn typecheck
run_check "🔍 Running ESLint..." "ESLint check passed" "ESLint check failed" yarn lint
CHECK_HINT='Run '\''yarn prettier --write "src/**/*.{ts,tsx,js,jsx}"'\'' to fix' \
    run_check "💅 Checking code formatting..." "Code formatting check passed" "Code formatting issues found" yarn prettier --check "src/**/*.{ts,tsx,js,jsx}"
run_check "🧪 Running tests..." "Tests passed" "Tests failed" yarn test --passWithNoTests

# Summary
echo -e "\n================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✨ All CI checks passed! Ready to commit.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some CI checks failed. Please fix the issues before committing.${NC}"
    exit 1
fi
