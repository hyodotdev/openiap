# Fact Graph — Declared-Fact Consistency

One cross-cutting scalar (a tool version, a runner image) gets declared in
many files. When someone bumps most of them, the leftover breaks — usually in
the one lane nobody runs until a release. This system makes that class of
drift fail CI instead.

Real incidents this system would have caught (all shipped 2026-08-20):

- `release-godot.yml` still on `macos-15` after six other release lanes moved
  to `macos-26` — surfaced as a 9-minute runner wait during a live release.
- `Example/project.godot` declaring Godot 4.5 features while the Makefile and
  every CI lane pinned 4.7.1 — the editor rewrote the file on every open.

## Model

`scripts/facts.mjs` is the registry. Each **fact** declares:

- `values` — named roles for the values that may legitimately coexist
  (`{ current: "4.7.1", minimum: "4.3" }`). One role means uniformity.
- `scanners` — regexes with one capture group, run over file sets.

`scripts/audit-facts.mjs` enforces two rules:

1. Every occurrence a scanner finds must be one of the declared values.
2. Every declared value must still occur somewhere.

Rule 2 is what makes bumps atomic: change the registry and every stale
occurrence fails; change a file and the unregistered value fails. There is
deliberately **no per-site list** — an unlisted site cannot drift silently
because the scanner sees it anyway.

`DERIVED` relations express one declaration computed from another
(`project.godot` features = major.minor of `godot.version.current`) instead of
duplicating the value.

## Authority direction

The registry is authoritative; files follow it. When the audit fails, the fix
is to finish the bump — never to edit the registry to match a stray file
unless the stray file is the intended new value.

## Boundaries (do not absorb these)

| Domain                              | Owner                                         |
| ----------------------------------- | --------------------------------------------- |
| Generated type files source→targets | `packages/gql/generated-sync-manifest.mjs`    |
| Package/spec version floor          | `openiap-versions.json` + release-state audit |
| API surface parity across languages | `scripts/audit-non-godot-parity.mjs`          |
| Change→job routing                  | `scripts/audit-ci-path-filters.mjs`           |

The fact graph holds scalar declarations only. A fact pinned here must not
also be pinned as a parity-audit needle — one owner per fact.

## Authoring rules

- Anchor patterns to structural keys (`java-version:`), never bare numbers.
- A deliberately divergent value (Node 20 for builds, 24 for npm publish) is
  either two roles in one fact or out of scope — never an unexplained skip.
- **Every new fact ships with a planted-violation test** in
  `scripts/audit-facts.test.mjs`: edit a real file in memory, assert the audit
  reports it. A guard that has never seen its bug fire is unverified
  (the release-sync guard shipped broken exactly this way).

## Limits

Agreement is not correctness: `supported_platforms` was consistent across all
four copies and every copy was wrong, because Godot never read the key. The
fact graph catches drift between declarations; it cannot tell whether the
declaration means anything. Semantic validity stays with tests and e2e.

## Roadmap

1. **Done** — toolchain facts (Xcode, macOS image, JDK, Bun, Godot) plus the
   Example-project derivation.
2. Absorb parity-audit needles that assert scalar pins, shrinking
   `audit-non-godot-parity.mjs` toward behavior-only assertions.
3. Derive CI path-filter expectations from a package→path→job edge list
   instead of asserting them post hoc.
