# Conventions

## Enum Values

- Use PascalCase for all enum values, including string literal unions and
  documentation snippets. This keeps the codebase and docs aligned with the
  runtime values exposed by the SDK.
- In documentation examples (e.g., `src/pages/docs/types.tsx`), declare enums
  before any related type aliases so readers see the enum values ahead of the
  structures that consume them.

## Naming

- Reserve the `Props` suffix for top-level argument objects (e.g., the direct
  parameters passed to public APIs). When defining nested structures inside
  those props, prefer the `Params` suffix if a suffix is needed.
