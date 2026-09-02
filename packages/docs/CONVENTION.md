# Conventions

## Enum Values

- Use the generated target-language member name and wire value exactly as
  emitted from the GraphQL SSOT. GraphQL enum identifiers are PascalCase, while
  serialized string values and TypeScript string-literal unions use the
  generated lowercase/kebab-case wire values (for example, `OneTime` maps to
  `'one-time'`). Do not normalize documentation snippets to PascalCase when the
  runtime value is lowercase or kebab-case.
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
- `src/lib/versioning.ts` must only read framework package versions from
  `src/generated/version-metadata.json`. That generated file is synced from
  the real package metadata by `scripts/sync-versions.sh` so Vercel can build
  from the `packages/docs` root without importing files outside the docs
  package.

## Sponsor Surfaces

- Treat `sponsor-registry.json` as the SSOT for supporter records and logos;
  funding channel links on the sponsor, sponsorship, founding-supporter,
  governance, one-pager, and IAPKit docs; generated README sponsor blocks; and
  `.github/FUNDING.yml`.
- Run `bun run sponsors:sync` from the repository root after changing it. The
  command updates the root, package, and library READMEs, the specification
  READMEs under `specs/openiap/` that carry the block markers (currently the
  client specification; the Commerce Protocol README must stay marker-free), and
  `.github/FUNDING.yml`.
- Use the generated `openiap-*` reference links for sponsor or funding mentions
  elsewhere in those READMEs; the audit rejects hardcoded funding URLs.
- Do not edit content between `<!-- sponsors:start -->` and
  `<!-- sponsors:end -->`; `bun run audit:sponsors` and CI reject drift.
