# Software Bill of Materials (SBOM)

## Purpose

Current OpenIAP release workflows attach a machine-readable inventory of direct
third-party dependencies, and a daily repair job fills missed latest-release
assets. That inventory lets a consumer — or a maintainer responding to a new
advisory — identify the released dependency contract without reconstructing it
from build scripts. Exact application exposure still comes from the consumer's
resolved dependency graph.

SBOMs are generated from the released manifest or the registry descriptor that
consumers resolve. No one edits an SBOM by hand, and none are committed to the
repository.

## Scope

One SBOM per **releasable component**, not one per repository. A single
monorepo-wide document would describe an artifact nobody installs.

The component list is not maintained here. It is read from the release
single-source-of-truth, `scripts/release-branch-policy.mjs`, so a component
cannot be released without also being described:

| Component      | SBOM name                | Distribution                     | Release tag                     |
| -------------- | ------------------------ | -------------------------------- | ------------------------------- |
| `apple`        | `openiap`                | CocoaPods, Swift Package Manager | `<version>`                     |
| `google`       | `openiap-google`         | Maven Central                    | `google-<version>`              |
| `react-native` | `react-native-iap`       | npm                              | `react-native-iap-<version>`    |
| `expo`         | `expo-iap`               | npm                              | `expo-iap-<version>`            |
| `conformance`  | `openiap-conformance`    | npm                              | `openiap-conformance-<version>` |
| `flutter`      | `flutter_inapp_purchase` | pub.dev                          | `flutter-iap-<version>`         |
| `kmp`          | `kmp-iap`                | Maven Central                    | `kmp-iap-<version>`             |
| `maui`         | `OpenIap.Maui`           | NuGet                            | `maui-iap-<version>`            |
| `godot`        | `godot-iap`              | GitHub Release                   | `godot-iap-<version>`           |
| `docs`         | `openiap-spec`           | GitHub Release                   | `docs-<version>`                |

`packages/kit` (IAPKit) is deliberately outside this list. It is a deployed
service rather than a distributed package: consumers call it over HTTPS and
never install its dependency tree. Its dependencies are monitored through
Dependabot instead — see [README.md](README.md).

## Standards

| Concern            | Standard                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document format    | [CycloneDX 1.6](https://cyclonedx.org/specification/overview/), JSON encoding ([schema](https://github.com/CycloneDX/specification))                       |
| Component identity | [Package URL (purl)](https://github.com/package-url/purl-spec)                                                                                             |
| License identity   | [SPDX license identifiers](https://spdx.org/licenses/)                                                                                                     |
| Vulnerability data | [CycloneDX VEX](https://cyclonedx.org/capabilities/vex/)                                                                                                   |
| Attestation        | [in-toto](https://in-toto.io/) statements carrying [SLSA provenance](https://slsa.dev/provenance/v1), signed through [Sigstore](https://www.sigstore.dev/) |

CycloneDX is the primary format. It was chosen over SPDX because purl coverage
across the six ecosystems this repository publishes into (npm, Maven, NuGet,
pub, CocoaPods, generic) is more direct, and because vulnerability tooling in
these ecosystems consumes CycloneDX with less translation. There is no second
format: publishing two documents that can disagree is a liability, not a
feature.

## What this system depends on

An SBOM pipeline is itself a supply-chain surface, so its own inputs are listed
here rather than left implicit.

**The generator** (`scripts/generate-sbom.mjs`, `scripts/sbom-dependencies.mjs`)
uses **only the Node.js standard library** — no npm dependency, no vendored
code, no external binary. It is plain ESM run by the Node version already
pinned in CI. This is deliberate: a tool that reports what you depend on should
not quietly add dependencies of its own.

**At generation time** it reads package registries over HTTPS for the published
dependency descriptors and for declared licenses:

| Registry                                          | Used for                    |
| ------------------------------------------------- | --------------------------- |
| [Maven Central](https://repo1.maven.org/maven2/)  | Maven coordinate POMs       |
| [Google Maven](https://maven.google.com/)         | androidx / com.android POMs |
| [nuget.org](https://www.nuget.org/)               | NuGet `.nuspec`             |
| [registry.npmjs.org](https://registry.npmjs.org/) | npm package metadata        |

Failure to read a published POM or nuspec blocks generation because the
dependency inventory would be incomplete. A license lookup failure degrades to
a missing license field and does not block the release.

**In CI**, `.github/workflows/sbom.yml` uses these actions:

| Action                                                                                  | Purpose                    | License |
| --------------------------------------------------------------------------------------- | -------------------------- | ------- |
| [`actions/checkout`](https://github.com/actions/checkout)                               | Check out the released tag | MIT     |
| [`actions/setup-node`](https://github.com/actions/setup-node)                           | Provide the Node runtime   | MIT     |
| [`actions/attest-build-provenance`](https://github.com/actions/attest-build-provenance) | Sign SLSA provenance       | MIT     |
| [`gh` CLI](https://cli.github.com/)                                                     | Upload the release asset   | MIT     |

Action versions use reviewed major-version tags and are kept current by
Dependabot. Commit-SHA pinning remains a documented repository-wide gap.

## Naming convention

```text
<sbom-name>-<version>.cdx.json
```

Concretely:

```text
react-native-iap-16.3.0.cdx.json
openiap-conformance-1.0.0.cdx.json
openiap-google-3.3.0.cdx.json
```

The name and version equal the published package's own name and version, so a
released artifact and its SBOM can be matched without a lookup table.

## Generation

```bash
bun run sbom <component>                  # writes ./sbom/<name>-<version>.cdx.json
bun run sbom <component> --with-licenses  # also resolve licenses from registries
bun run sbom <component> --stdout         # print instead of writing
bun run sbom --tag <release-tag>          # preserve the published tag identity
bun run sbom resolve-tag <tag>            # which component does this tag belong to?
```

The generator (`scripts/generate-sbom.mjs`) reads:

| Ecosystem      | Dependency source                                           |
| -------------- | ----------------------------------------------------------- |
| npm            | Released `package.json` (`dependencies`)                    |
| Maven / Gradle | Published POM for the selected consumer artifact            |
| NuGet          | Published nuspec dependency groups                          |
| pub            | Released `pubspec.yaml`; constraints are preserved verbatim |
| Godot / Gradle | Released addon `build.gradle.kts`                           |
| Swift          | Released `Package.swift`                                    |

### What is included

**Runtime dependencies of the published artifact.** Direct dependencies always;
transitive dependencies when a resolver export is supplied (see below).

### What is excluded, and why

- **Test and build-only dependencies.** `testImplementation`,
  `androidTestImplementation`, `compileOnly`, annotation processors, and NuGet
  references marked `PrivateAssets="all"` never reach a consumer. Listing them
  would inflate the apparent attack surface of the shipped artifact with code
  that is not in it.
- **`devDependencies`.** Same reasoning. Note that the npm packages here
  declare no runtime `dependencies` at all, so their SBOMs are legitimately
  empty of third-party components — that is a property of the artifact, not a
  gap in the tooling.
- **`peerDependencies`.** The host application supplies and versions these
  (React, React Native, Expo, Flutter SDK). They are part of the consuming
  application's SBOM, not ours.
- **Operating-system frameworks.** StoreKit is not a distributed package.

### Version constraints

Library manifests sometimes publish a version constraint rather than one exact
resolved version. The SBOM preserves that constraint verbatim and marks it with
`openiap:sbom:version-constraint`; it never rewrites the lower bound as though
that were the version every consumer installs. An application SBOM should use
its lockfile or ecosystem resolver when exact CVE matching is required.

### Licenses

`--with-licenses` resolves each dependency's declared license from its own
registry — Maven Central and Google's Maven repository for Maven coordinates,
nuget.org for NuGet, registry.npmjs.org for npm. The release workflow passes
this flag. Maven and NuGet component generation still reads the published
dependency descriptor when license enrichment is disabled.

Licenses are never guessed. A registry value is emitted as an SPDX identifier
only when it is a recognised one; anything else is recorded as a free-text
license name, because downstream tooling treats `license.id` as authoritative
and a confident wrong identifier is worse than an absent one. A lookup failure
leaves the field empty rather than failing the release — license data is
compliance metadata, not part of the security inventory.

Every direct dependency resolves a license except two structural cases, which
are limitations of the source metadata rather than bugs:

- **pub.dev packages** — Dart declares licensing in a `LICENSE` file, and
  package metadata exposes no standard license field.
- **NuGet packages whose nuspec carries only a license URL** that does not map
  to an SPDX identifier, such as `Xamarin.Android.Google.BillingClient`.

`bun run sbom <component> --with-licenses` prints the resolved count for a
component, so current coverage is checkable rather than quoted here — a fixed
number would go stale the next time a dependency changes.

### Transitive dependencies

Direct dependencies are read from the published descriptor or released
manifest. A complete transitive closure requires the ecosystem's own resolver,
which only a runner with that toolchain can produce. When such an export is
available it is merged in:

```bash
bun run sbom google --resolved gradle-dependencies.json
```

The file is a JSON array (or `{"components": [...]}`) of `{name, version, purl}`
entries. Merged entries are marked with an `openiap:sbom:relationship`
property of `transitive`; all entries remain reachable from the root dependency
graph.

Where an input declares a dependency this reader cannot resolve, generation
**fails** rather than emitting a shorter list. An SBOM that silently omits a
dependency is worse than no SBOM, because it is trusted.

#### Published dependency metadata

Maven and NuGet inventories are read from the POM or nuspec consumers resolve,
not reconstructed from conditional build scripts. This makes the inventory
flavor-aware and includes dependencies injected by the publishing toolchain,
such as Kotlin's standard library. Pub constraints remain constraints because a
library release does not choose the application's eventual resolved version.

The KMP release spans platform variants. Its release SBOM uses the published
`io.github.hyochan:kmp-iap-android-play` POM so the Android dependency on
`openiap-google` is not omitted. An iOS-only consumer should use its resolved
application graph for target-specific dependencies.

The small Godot Gradle reader remains because its GitHub release is the artifact
of record. It rejects unknown configurations, unresolved coordinates, catalog
accessors, and unsupported coordinate shapes instead of silently dropping them.

## Release integration

Every component release workflow dispatches `.github/workflows/sbom.yml` after
creating its GitHub Release. This explicit dispatch is required because a
release created with `GITHUB_TOKEN` does not trigger another workflow. A scan on
SBOM changes and a daily schedule dispatch any missing newest-component asset.

```text
release workflow  →  GitHub Release published
                            │ explicit workflow_dispatch
                            ▼
                         sbom.yml
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    resolve component   generate SBOM   verify identity
      from the tag     at the tagged     (version, tag,
                          commit         commit, no paths)
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
            attest provenance   upload as release asset
```

Before upload, the workflow asserts that the SBOM's version, release tag,
release commit, and recorded generator commit match its inputs, and that no
local filesystem path leaked into the document. Any mismatch fails the run.

Tags that do not belong to a component are skipped with a notice rather than
failing. A duplicate dispatch preserves an existing SBOM rather than
overwriting an immutable release asset.

## Storage location

Generated SBOMs live **only** as assets on their GitHub Release:

```text
https://github.com/hyodotdev/openiap/releases/tag/<release-tag>
  └── <sbom-name>-<version>.cdx.json
```

They are not committed. `sbom/` and `*.cdx.json` are gitignored. A checked-in
SBOM would be a second source of truth that drifts from the release it claims
to describe, and would add noise to every dependency-changing pull request.

## Verification

Any consumer can independently verify a published SBOM:

```bash
# 1. Download the SBOM from its release
gh release download react-native-iap-16.3.0 \
  --repo hyodotdev/openiap -p '*.cdx.json'

# 2. Confirm this repository's CI produced it
gh attestation verify react-native-iap-16.3.0.cdx.json \
  --repo hyodotdev/openiap

# 3. Validate it against the CycloneDX schema
cyclonedx validate --input-file react-native-iap-16.3.0.cdx.json \
  --input-format json --input-version v1_6 --fail-on-errors
```

Every tool above is independent of this repository, so verification does not
require trusting our tooling:

| Tool                                                                           | Role                                         | License    |
| ------------------------------------------------------------------------------ | -------------------------------------------- | ---------- |
| [`gh attestation verify`](https://cli.github.com/manual/gh_attestation_verify) | Confirm CI provenance against Sigstore       | MIT        |
| [`cyclonedx-cli`](https://github.com/CycloneDX/cyclonedx-cli)                  | Validate against the published schema        | Apache-2.0 |
| [`bomlens`](https://github.com/sktelecom/bomlens)                              | Local-first SBOM validation and risk report  | Apache-2.0 |
| [`osv-scanner`](https://github.com/google/osv-scanner)                         | Match components against the OSV database    | Apache-2.0 |
| [`grype`](https://github.com/anchore/grype)                                    | Match components against vulnerability feeds | Apache-2.0 |

OpenIAP runs none of these in CI — see [README.md](README.md#scanning-posture)
for why — but each accepts a CycloneDX 1.6 document directly, so a consumer can
point their own scanner at a release asset on their own schedule.

Maintainers can reproduce the core dependency inventory from the published tag
and the generator commit recorded under `openiap:generator:commit`. The release
workflow uses live registries to enrich dependencies with licenses and
suppliers, so those fields are point-in-time metadata and are not guaranteed to
be byte-identical later.

The example below intentionally reproduces the immutable Google 3.3.0 asset.
That asset predates the published-POM reader and contains the older
source-manifest inventory; use the published POM, not that historical SBOM, for
Google 3.3.0 dependency matching.

```bash
RELEASE_TAG=google-3.3.0
PUBLISHED_SBOM=/absolute/path/openiap-google-3.3.0.cdx.json
GENERATOR_COMMIT=$(jq -r '
  .metadata.tools.components[]
  | select(.name == "openiap-sbom-generator")
  | .properties[]
  | select(.name == "openiap:generator:commit") | .value
' "$PUBLISHED_SBOM")

git fetch origin main --tags
SBOM_REPRO_DIR=$(mktemp -d)
git worktree add --detach "$SBOM_REPRO_DIR" "$RELEASE_TAG"
git -C "$SBOM_REPRO_DIR" checkout "$GENERATOR_COMMIT" -- \
  scripts/generate-sbom.mjs \
  scripts/sbom-dependencies.mjs \
  scripts/release-branch-policy.mjs \
  scripts/assert-release-tag.mjs
(
  cd "$SBOM_REPRO_DIR"
  node scripts/generate-sbom.mjs --tag "$RELEASE_TAG" \
    --commit "$(git rev-parse HEAD)" \
    --generator-commit "$GENERATOR_COMMIT" \
    --output-dir sbom
)

jq '(.components[]? |= del(.licenses, .supplier))' \
  "$PUBLISHED_SBOM" > /tmp/published-core.json
jq '(.components[]? |= del(.licenses, .supplier))' \
  "$SBOM_REPRO_DIR/sbom/openiap-google-3.3.0.cdx.json" \
  > /tmp/generated-core.json
diff /tmp/published-core.json /tmp/generated-core.json
git worktree remove --force "$SBOM_REPRO_DIR"
```

## Update policy

- Every current release workflow produces an SBOM automatically.
- SBOMs are **immutable once published**, exactly like the release tag they
  belong to. A dependency change ships as a new release with a new SBOM; a
  published SBOM is never edited in place.
- A release that predates this system and has no SBOM asset can be described
  with `workflow_dispatch`. The workflow reads released inputs, records the
  exact default-branch generator commit, and refuses to overwrite an existing
  asset.
- The newest release of each component is checked after SBOM changes and every
  day, so a missed release-time dispatch is repaired without manual triage.
- Changes to the generator are covered by `scripts/generate-sbom.test.mjs`,
  including a historical release-tree fixture and every accepted tag alias.
  CI also fails if a releasable component has no SBOM metadata.

## Relationship to vulnerability management

The SBOM is an input to vulnerability response, not the goal:

```text
SBOM (per released version)
   │
   ▼
dependency inventory  ←──  Dependabot alerts (packages/kit, GitHub Actions, Docker)
   │
   ▼
affected-version analysis  ──  "which shipped releases contain this CVE?"
   │
   ▼
security advisory + patch
   │
   ▼
new release  →  new SBOM
```

Its concrete value here is answering the affected-version question. Dependabot
tells us a dependency is vulnerable _today, on `main`_. The published SBOMs
tell us which already-shipped versions contain it — which is what a consumer
needs to know and what an advisory has to state.

See [README.md](README.md) for the full vulnerability-management picture and
[CRA.md](CRA.md) for how this maps onto Cyber Resilience Act expectations.
