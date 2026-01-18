# Audit Code Against Knowledge Rules

Automated workflow to check and fix code based on updated knowledge rules.

## Workflow

```
1. Compile knowledge (re-index)
         ↓
2. Analyze all code for rule violations
         ↓
3. Fix issues found
         ↓
4. Verify fixes
```

## Steps

### 1. Re-compile Knowledge

First, re-index the knowledge base to ensure latest rules are applied:

```bash
cd scripts/agent && bun run compile:ai
```

### 2. Analyze Codebase

Check each package against internal rules:

**Packages to analyze:**
- `packages/apple/Sources/` - iOS/macOS Swift code
- `packages/google/openiap/src/main/` - Android Kotlin code
- `packages/gql/src/` - GraphQL TypeScript code
- `packages/docs/src/` - Documentation React code

**Rules to check (from knowledge/internal/):**
- `01-naming-conventions.md` - Function naming (IOS suffix, no Android suffix in google package)
- `02-architecture.md` - Code organization, file structure
- `03-coding-style.md` - Explicit return types, error handling
- `04-platform-packages.md` - Package-specific rules
- `05-docs-patterns.md` - Documentation patterns
- `06-git-deployment.md` - Git conventions

### 3. Analysis Checklist

For each package, verify:

**packages/apple (Swift):**
- [ ] iOS-specific functions end with `IOS` suffix
- [ ] Cross-platform functions have NO suffix
- [ ] Acronyms follow Swift conventions (IapManager, not IAPManager)
- [ ] Types match OpenIAP specification

**packages/google (Kotlin):**
- [ ] Functions do NOT have `Android` suffix (it's Android-only package)
- [ ] Cross-platform functions have NO suffix
- [ ] Types.kt is not manually edited (auto-generated)

**packages/gql (TypeScript):**
- [ ] Generated types are not manually edited
- [ ] Async operations have `# Future` comment in schema

**packages/docs (React/TypeScript):**
- [ ] URL anchors are kebab-case
- [ ] Search IDs are kebab-case
- [ ] Modal pattern uses Preact Signals

### 4. Fix Issues

After identifying issues:
1. Read the relevant knowledge file for the rule
2. Read the violating code file
3. Fix the code to comply with the rule
4. Verify the fix

### 5. Final Verification

```bash
# Type check all packages
cd packages/apple && swift build
cd packages/google && ./gradlew :openiap:compileDebugKotlin
cd packages/gql && bun run typecheck
cd packages/docs && bun run typecheck
```

## Quick Commands

```bash
# Full audit (compile + analyze + report)
cd scripts/agent && bun run compile:ai

# Then ask Claude to analyze:
# "Analyze packages/apple for naming convention violations and fix them"
# "Check packages/google for any Android suffix violations"
# "Review all packages for rule compliance and fix issues"
```

## Example Usage

Ask Claude Code:

> "Run /audit-code and fix any issues found in packages/apple"

> "Audit the codebase for naming convention violations and fix them"

> "Check all packages against internal knowledge rules and create fixes"
