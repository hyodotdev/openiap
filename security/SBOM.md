# Software Bill of Materials (SBOM)

## Purpose

Current OpenIAP release workflows attach a machine-readable inventory of direct
runtime components and dependency contracts, including first-party OpenIAP
native contracts. A daily repair job fills missed assets for each latest stable
release, and a weekly read-only job re-verifies and scans every published stable
release carrying an SBOM. Prereleases rely on their release-time dispatch. That
inventory lets a consumer — or a maintainer responding to a new advisory —
identify the released dependency contract without reconstructing it from build
scripts. Exact application exposure still comes from the consumer's resolved
dependency graph.

SBOMs are generated from released manifests and registry descriptors, shipped
native declarations, and hash-pinned embedded binaries. No one edits an SBOM by
hand, and none are committed to the repository.

## Scope

One SBOM per **releasable component**, not one per repository. A single
monorepo-wide document would describe an artifact nobody installs.

The releasable components are defined by `versionSources` in
`scripts/release-branch-policy.mjs` and mirrored by `COMPONENTS` in
`scripts/generate-sbom.mjs`. This table is a third copy for readers;
`bun run audit:sbom-docs` fails when it drifts from either, so a component
cannot be released without also being described:

| Component           | SBOM name                   | Distribution                     | Release tag                           |
| ------------------- | --------------------------- | -------------------------------- | ------------------------------------- |
| `apple`             | `openiap`                   | CocoaPods, Swift Package Manager | `<version>`                           |
| `google`            | `openiap-google`            | Maven Central                    | `google-<version>`                    |
| `react-native`      | `react-native-iap`          | npm                              | `react-native-iap-<version>`          |
| `expo`              | `expo-iap`                  | npm                              | `expo-iap-<version>`                  |
| `conformance`       | `openiap-conformance`       | npm                              | `openiap-conformance-<version>`       |
| `flutter`           | `flutter_inapp_purchase`    | pub.dev                          | `flutter-iap-<version>`               |
| `kmp`               | `kmp-iap`                   | Maven Central                    | `kmp-iap-<version>`                   |
| `maui`              | `OpenIap.Maui`              | NuGet                            | `maui-iap-<version>`                  |
| `godot`             | `godot-iap`                 | GitHub Release                   | `godot-iap-<version>`                 |
| `docs`              | `openiap-spec`              | GitHub Release                   | `docs-<version>`                      |
| `commerce-protocol` | `openiap-commerce-protocol` | npm                              | `openiap-commerce-protocol-<version>` |

`packages/kit` (IAPKit) is deliberately outside this list. It is a deployed
service rather than a distributed package: consumers call it over HTTPS and
never install its dependency tree. Its source dependency graph is covered by
the repository gates, and its current source image is scanned before deployment
and by the weekly security workflow — see [README.md](README.md).

## Licence notices

The SBOM records an SPDX identifier per component. For components whose licence
requires the notice to be redistributed with the binary — MIT, ISC, and the
Apache and BSD families — the verbatim upstream licence text is committed
alongside the binary and referenced from the component's `licenseFile`.

`scripts/generate-third-party-notices.mjs` renders those into a
`THIRD_PARTY_NOTICES.md` shipped inside the release artifact, and prints a
licence inventory with `--inventory`. It refuses to render when a component
declares such a licence with no committed text, so the failure mode is a failed
release rather than a notice with an empty section. Nothing composes or infers
licence text.

Today this applies to `godot`, the only component that redistributes a
third-party binary: the addon ZIP embeds `SwiftGodotRuntime` (MIT) and ships its
notice plus the addon's own `LICENSE`. Registry-distributed components carry
their dependencies by coordinate rather than by embedding them, so the consuming
package manager resolves those licences.

## Standards

| Concern            | Standard                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document format    | [CycloneDX 1.6](https://cyclonedx.org/specification/overview/), JSON encoding ([schema](https://github.com/CycloneDX/specification))                       |
| Component identity | [Package URL (purl)](https://github.com/package-url/purl-spec)                                                                                             |
| License identity   | [SPDX license identifiers](https://spdx.org/licenses/)                                                                                                     |
| Vulnerability data | [CycloneDX VEX](https://cyclonedx.org/capabilities/vex/)                                                                                                   |
| Attestation        | [in-toto](https://in-toto.io/) statements carrying [SLSA provenance](https://slsa.dev/provenance/v1), signed through [Sigstore](https://www.sigstore.dev/) |

CycloneDX is the primary format. The generator emits six purl types — npm,
Maven, NuGet, pub, CocoaPods, and generic — which vulnerability tooling can
consume directly. The Apple artifact distributed through CocoaPods and SwiftPM
uses its canonical CocoaPods purl identity. There is no second document format:
publishing two inventories that can disagree is a liability, not a feature.

## What this system depends on

An SBOM pipeline is itself a supply-chain surface, so its own inputs are listed
here rather than left implicit.

**The generator** (`scripts/generate-sbom.mjs`, `scripts/sbom-dependencies.mjs`)
uses **only the Node.js standard library** — no npm dependency, vendored code,
or runtime library — plus the Git executable already required by the checkout.
It is plain ESM run with Node 24 selected in CI. This is deliberate: a tool
that reports what you depend on should not quietly add a package dependency tree
of its own.

**At generation time**, Maven and NuGet components read the published
consumer-visible descriptor over HTTPS as a required inventory input. With
`--with-licenses`, the generator also performs best-effort license and supplier
enrichment:

| Registry                                          | Required inventory input     | Best-effort enrichment      |
| ------------------------------------------------- | ---------------------------- | --------------------------- |
| [Maven Central](https://repo1.maven.org/maven2/)  | Maven coordinate POMs        | License and organization    |
| [Google Maven](https://maven.google.com/)         | Android/Google Maven POMs    | License and organization    |
| [nuget.org](https://www.nuget.org/)               | NuGet `.nuspec` dependencies | License and authors         |
| [registry.npmjs.org](https://registry.npmjs.org/) | —                            | npm license and author data |

Failure to read a required POM or nuspec blocks generation because the
dependency inventory would be incomplete. A metadata-enrichment failure
preserves reviewed local fields, leaves any remaining field missing, and does
not block the release.

**In CI**, `.github/workflows/sbom.yml` uses these actions and tools:

| Input                                                                                   | Purpose                                | Integrity boundary              | License    |
| --------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------- | ---------- |
| [`actions/checkout`](https://github.com/actions/checkout)                               | Check out the released tag             | Exact Action commit SHA         | MIT        |
| [`actions/setup-node`](https://github.com/actions/setup-node)                           | Provide the Node runtime               | Exact Action commit SHA         | MIT        |
| [`actions/attest-build-provenance`](https://github.com/actions/attest-build-provenance) | Sign SLSA provenance                   | Exact Action commit SHA         | MIT        |
| [`cyclonedx-cli`](https://github.com/CycloneDX/cyclonedx-cli)                           | Validate the CycloneDX 1.6 schema      | Versioned binary + SHA-256      | Apache-2.0 |
| [`gh` CLI](https://cli.github.com/)                                                     | Upload and verify release attestations | Preinstalled GitHub runner tool | MIT        |

Every external Action is pinned to an exact commit SHA with its reviewed
upstream ref recorded in a comment. Security-tool binaries are downloaded by
`scripts/install-security-tool.sh` and verified against the recorded SHA-256;
`gh` is the runner-provided CLI, not a GitHub Action.

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

| Source                    | Dependency evidence                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------- |
| npm                       | Released `package.json` (`dependencies`)                                              |
| Maven / Gradle            | Published POM for each selected consumer artifact                                     |
| NuGet                     | Published nuspec dependency groups                                                    |
| pub                       | Released `pubspec.yaml`; constraints are preserved verbatim                           |
| Declared native contracts | Shipped framework Gradle, podspec, Package.swift, and project dependency declarations |
| Embedded binary           | Hash-pinned SwiftGodot runtime files plus their reviewed local metadata               |

The MAUI inventory is the union of the published nuspec's target-framework
groups. Use the consuming application's resolved graph to narrow dependencies
to Android, iOS, or Mac Catalyst.

### What is included

**Runtime components and dependency contracts of the published artifact.**
Direct dependencies always; transitive dependencies when a resolver export is
supplied (see below). Framework release SBOMs aggregate the native Apple and
Google contracts the package installs.

### What is excluded, and why

- **Test and build-only dependencies.** `testImplementation`,
  `androidTestImplementation`, `compileOnly`, annotation processors, and NuGet
  references marked `PrivateAssets="all"` never reach a consumer. Listing them
  would inflate the apparent attack surface of the shipped artifact with code
  that is not in it.
- **`devDependencies`.** Same reasoning. The published JavaScript manifests
  declare no npm runtime `dependencies`; `openiap-conformance` therefore has no
  runtime components. Expo and React Native still list their shipped native
  contracts in their aggregate release SBOMs.
- **JavaScript `peerDependencies` as bundled npm code.** The host application
  supplies and versions these. Host constraints needed to describe a framework
  contract remain visible as such rather than being treated as bundled code.
- **Operating-system frameworks.** StoreKit is not a distributed package.

### Version constraints

Library manifests sometimes publish a version constraint rather than one exact
resolved version. The SBOM preserves that constraint verbatim and marks it with
`openiap:sbom:version-constraint`; it never rewrites the lower bound as though
that were the version every consumer installs. An application SBOM should use
its lockfile or ecosystem resolver when exact CVE matching is required.

### Licenses

Known metadata for OpenIAP native artifacts, declared framework dependencies,
and bundled SwiftGodot binaries is reviewed against shipped declarations and
upstream package or license evidence. `--with-licenses` additionally resolves
dependency metadata from Maven Central, Google's Maven repository, nuget.org,
and registry.npmjs.org. The release workflow passes this flag. Maven and NuGet
component generation still reads the published dependency descriptor when
enrichment is disabled.

Licenses are never guessed. A registry value is emitted as an SPDX identifier
only when it is a recognised one; anything else is recorded as a free-text
license name, because downstream tooling treats `license.id` as authoritative
and a confident wrong identifier is worse than an absent one. A lookup failure
preserves reviewed local metadata and leaves any remaining field empty rather
than failing the release — license data is compliance metadata, not part of the
security inventory.

License coverage is best-effort where an ecosystem does not publish a standard
machine-readable value. Current structural gaps include:

- **pub.dev packages** — Dart declares licensing in a `LICENSE` file, and
  package metadata exposes no standard license field.
- **NuGet packages whose nuspec carries only a license URL** that does not map
  to an SPDX identifier, such as `Xamarin.Android.Google.BillingClient`.

`bun run sbom <component> --with-licenses` prints the resolved count for a
component, so current coverage is checkable rather than quoted here — a fixed
number would go stale the next time a dependency changes.

Supplier is an NTIA minimum field; reviewed local suppliers and registry
authors are included when available. A missing registry value remains visible
as missing metadata instead of being guessed.

### Transitive dependencies

Direct dependencies are read from the published descriptor, released manifest,
shipped native declaration, or hash-pinned embedded binary. A complete
transitive closure requires the ecosystem's own resolver, which only a runner
with that toolchain can produce. When such an export is available it is merged
in:

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

The KMP release spans platform variants. Its release SBOM combines the
published canonical `io.github.hyochan:kmp-iap` POM with the declared Apple and
Play, Horizon, and Amazon OpenIAP native contracts. A consumer should still use
its resolved application graph for target-specific transitive dependencies.

The small Godot Gradle reader remains because its GitHub release is the artifact
of record. It rejects unknown configurations, unresolved coordinates, catalog
accessors, and unsupported coordinate shapes instead of silently dropping them.

## Release integration

Every component release workflow dispatches `.github/workflows/sbom.yml` after
creating its GitHub Release. This explicit dispatch is required because a
release created with `GITHUB_TOKEN` does not trigger another workflow. A scan on
SBOM changes and a daily schedule dispatch any missing newest stable asset.
Prereleases rely on their release-time dispatch and are not part of this repair
scan. The separate read-only `.github/workflows/security-rescan.yml` requires
that asset to exist for each newest stable component release, then verifies and
scans every published stable release that carries one each week.

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
failing. A duplicate dispatch verifies an existing SBOM's identity, generator
commit, GitHub digest, and provenance before preserving it. The repair scan
recognizes only the exact tag/digest pairs recorded in
`LEGACY_SBOM_REPAIRS`. It uploads and verifies a corrected document under a
temporary name before removing an approved legacy asset; no unlisted existing
asset is overwritten.

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

# 2. Confirm the main-branch workflow produced it on a GitHub-hosted runner
CERT_IDENTITY=https://github.com/hyodotdev/openiap
CERT_IDENTITY="$CERT_IDENTITY/.github/workflows/sbom.yml@refs/heads/main"
gh attestation verify react-native-iap-16.3.0.cdx.json \
  --repo hyodotdev/openiap --cert-identity "$CERT_IDENTITY" \
  --deny-self-hosted-runners

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

After upload, OpenIAP re-downloads the canonical asset and verifies its GitHub
digest, release identity, generator binding, and `gh attestation verify`
result. The weekly security workflow repeats those checks and runs OSV against
every published stable SBOM; the Kit source image runs through Trivy. This is
post-publication verification and a workflow success gate, not a platform
immutability control. Independent tools accept CycloneDX 1.6 directly, so
consumers can inspect a release asset on their own schedule.

Maintainers can reproduce the core dependency inventory from the full release
commit recorded in the SBOM, after verifying the current tag still points to
that commit, and the generator commit recorded under
`openiap:generator:commit`. The release
workflow uses live registries to enrich dependencies with licenses and
suppliers, so those fields are point-in-time metadata and are not guaranteed to
be byte-identical later.

The example below reproduces the corrected Google 3.3.0 asset from its recorded
generator commit. The one-time repair replaces the known inaccurate legacy
digest with the published-POM inventory before this procedure is used.

```bash
RELEASE_TAG=google-3.3.0
PUBLISHED_SBOM=/absolute/path/openiap-google-3.3.0.cdx.json
RELEASE_COMMIT=$(jq -r '
  .metadata.component.properties[]
  | select(.name == "openiap:release:commit") | .value
' "$PUBLISHED_SBOM")
GENERATOR_COMMIT=$(jq -r '
  .metadata.tools.components[]
  | select(.name == "openiap-sbom-generator")
  | .properties[]
  | select(.name == "openiap:generator:commit") | .value
' "$PUBLISHED_SBOM")

git fetch origin main --tags
test "$RELEASE_COMMIT" = "$(git rev-parse "$RELEASE_TAG^{commit}")"
SBOM_REPRO_DIR=$(mktemp -d)
git worktree add --detach "$SBOM_REPRO_DIR" "$RELEASE_COMMIT"
git -C "$SBOM_REPRO_DIR" checkout "$GENERATOR_COMMIT" -- \
  scripts/generate-sbom.mjs \
  scripts/sbom-dependencies.mjs \
  scripts/release-branch-policy.mjs \
  scripts/assert-release-tag.mjs
(
  cd "$SBOM_REPRO_DIR"
  node scripts/generate-sbom.mjs --tag "$RELEASE_TAG" \
    --commit "$RELEASE_COMMIT" \
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
- SBOMs are write-once by workflow policy. See
  [Release integration](#release-integration) for the digest-guarded legacy
  repair exception; GitHub release immutability is not currently enabled.
- A release that predates this system and has no SBOM asset can be described
  with `workflow_dispatch` when its tag alias and released tree are supported by
  the current generator. Otherwise, use its recorded full commit SHA, tag as
  verified at investigation time, and published descriptors. The workflow
  records the attested workflow commit as the generator revision and refuses to
  overwrite an existing asset.
- The newest stable release of each component is checked after SBOM changes and
  every day, so a missed stable release-time dispatch is repaired without manual
  triage.
- Every published stable release SBOM is re-verified and vulnerability-scanned
  weekly. Older releases without an SBOM remain outside that scan. Results are
  retained as workflow artifacts for 30 days.
- Changes to the generator are covered by `scripts/generate-sbom.test.mjs`,
  including a historical release-tree fixture and every accepted tag alias.
  CI also fails if a releasable component has no SBOM metadata.

## Relationship to vulnerability management

The SBOM is an input to vulnerability response, not the goal:

```text
SBOM (per published release asset)
   │
   ▼
dependency inventory  ←──  repository audits + hosted dependency alerts
   │
   ▼
affected-version analysis  ──  "which releases declare the affected dependency?"
   │
   ▼
security advisory + patch
   │
   ▼
new release  →  new SBOM
```

Its concrete value here is answering the affected-version question. Repository
audits and hosted alerts identify findings in current source and submitted
graphs. Published stable release SBOMs are scanned weekly and identify their
direct dependency contracts. Older releases without an asset are investigated
from their recorded full commit SHA, tag as verified at investigation time, and
published descriptors when an advisory needs an affected-version list.

See [README.md](README.md) for the full vulnerability-management picture and
[CRA.md](CRA.md) for how this maps onto Cyber Resilience Act expectations.
