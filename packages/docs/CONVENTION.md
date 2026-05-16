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

## Framework Listings

- Treat `src/lib/images.ts` `LIBRARIES` as the SSOT for framework library
  membership and order.
- Home, `/languages`, setup pages, sidebars, and sponsor lists should derive
  framework entries from `LIBRARIES`; add metadata fields there instead of
  duplicating local arrays.
- Install commands that include package versions should derive from package
  metadata helpers (for example `FLUTTER_PACKAGE`, `KMP_PACKAGE`, and
  `MAUI_PACKAGE` in `src/lib/versioning.ts`), not inline version literals in
  page components.
