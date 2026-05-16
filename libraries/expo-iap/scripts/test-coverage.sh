#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "Running tests with coverage..."

# Run main tests
echo "Running main library tests..."
bunx jest --coverage

# Run example tests
echo "Running example app tests..."
cd example
bunx jest --coverage --passWithNoTests

echo "Coverage reports generated in ./coverage and ./example/coverage"
