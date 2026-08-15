---
name: audit-security
description: Audit OpenIAP's supply-chain security posture — SBOM correctness and NTIA completeness, release provenance, workflow permissions, and documentation drift — then fix what it finds. Use when the user asks to audit security, check SBOM quality, verify supply-chain posture, or before a release train.
---

# Audit Security Posture

Check what OpenIAP publishes about itself against what it actually does. Every
step below produces evidence, not an opinion.

Run this before a release train, after changing anything under `security/`,
`scripts/generate-sbom*`, or `.github/workflows/`, and whenever a new
releasable component is added.

The canonical policy this audits lives in
[`security/README.md`](../../security/README.md),
[`security/SBOM.md`](../../security/SBOM.md), and
[`security/ASSURANCE.md`](../../security/ASSURANCE.md). Read them before
reporting a gap — several apparent gaps are documented deliberate choices.

## 1. Committed dependencies have no unaccepted advisories

```bash
set -euo pipefail
bun install --frozen-lockfile
for directory in \
  libraries/expo-iap \
  libraries/expo-iap/example \
  libraries/expo-iap/example/vega \
  libraries/react-native-iap/example/vega \
  scripts/agent; do
  (cd "$directory" && bun install --frozen-lockfile --ignore-scripts)
done
(cd libraries/react-native-iap && corepack yarn install --immutable --mode=skip-build)
(cd libraries/react-native-iap/example && BUNDLE_FROZEN=true bundle install)
bun run audit:dependencies
node --test scripts/bun-dependency-snapshot.test.mjs \
  scripts/audit-security.test.mjs
osv-scanner scan source \
  --lockfile=bun.lock \
  --lockfile=libraries/expo-iap/bun.lock \
  --lockfile=libraries/expo-iap/example/bun.lock \
  --lockfile=libraries/expo-iap/example/vega/bun.lock \
  --lockfile=libraries/react-native-iap/example/vega/bun.lock \
  --lockfile=libraries/react-native-iap/example/Gemfile.lock \
  --lockfile=libraries/react-native-iap/yarn.lock \
  --lockfile=scripts/agent/bun.lock
```

The dependency audit fails on every unaccepted advisory severity, malformed
audit output, and expired or unused exceptions. An upstream-unpatched,
build-only exception must be justified and expiring in the owning
`osv-scanner.toml`. A successful GitHub dependency-submission run is separate
evidence that the hosted graph matches the exact Bun lock commit:

```bash
gh run list --workflow dependency-submission.yml --branch main --limit 1
gh api repos/hyodotdev/openiap/dependency-graph/sbom
```

Do not interpret an empty Dependabot alert list as evidence for a commit whose
snapshot workflow has not completed.

## 2. SBOM generates for every releasable component

The component list is owned by the release SSOT, not by the SBOM code. A
component that can be released but has no SBOM definition is a release that
ships without an inventory.

```bash
set -euo pipefail
node --test scripts/generate-sbom.test.mjs

SECURITY_AUDIT_ROOT=$(mktemp -d)
export SECURITY_AUDIT_ROOT
for c in $(node -e 'import("./scripts/generate-sbom.mjs").then(m=>console.log(m.listComponentIds().join(" ")))'); do
  printf "%-14s " "$c"
  node scripts/generate-sbom.mjs "$c" \
    --output-dir "$SECURITY_AUDIT_ROOT/core-a"
done
```

A failure here is the intended behaviour when a build manifest gained a
declaration shape the reader does not model — fix the reader, never silence it.

## 3. Schema validity

```bash
set -euo pipefail
for f in "$SECURITY_AUDIT_ROOT"/core-a/*.cdx.json; do
  cyclonedx validate --input-file "$f" --input-format json \
    --input-version v1_6 --fail-on-errors
done
```

Install with `brew install cyclonedx-cli` if absent.

## 4. NTIA minimum elements

The [NTIA minimum elements](https://www.ntia.gov/report/2021/minimum-elements-software-bill-materials-sbom)
are the baseline OpenSSF recommends measuring against. Validate author,
timestamp, component identity, and dependency relationships. Report supplier
and license coverage because registry gaps can leave those fields absent:

```bash
set -euo pipefail
COMPONENT_IDS=$(node -e 'import("./scripts/generate-sbom.mjs").then(m=>console.log(m.listComponentIds().join(" ")))')
export COMPONENT_IDS
for c in $COMPONENT_IDS; do
  node scripts/generate-sbom.mjs "$c" --with-licenses \
    --output-dir "$SECURITY_AUDIT_ROOT/enriched"
done

node -e '
const fs = require("fs");
const dir = `${process.env.SECURITY_AUDIT_ROOT}/enriched`;
let tot = 0, sup = 0, lic = 0, files = 0;
const errors = [];
for (const f of fs.readdirSync(dir)) {
  const j = JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
  files++;
  const root = j.metadata?.component;
  const authors = j.metadata?.authors ?? [];
  if (!authors.some((author) => author?.name?.trim())) {
    errors.push(`${f}: missing author name`);
  }
  if (!root?.supplier?.name?.trim()) errors.push(`${f}: missing root supplier`);
  if (!Number.isFinite(Date.parse(j.metadata?.timestamp))) {
    errors.push(`${f}: invalid timestamp`);
  }
  const components = [root, ...(j.components ?? [])];
  for (const c of components) {
    if (!c?.name || !c.version || !c.purl) {
      errors.push(`${f}: incomplete component identity`);
    }
  }
  const refs = new Set(components.map((c) => c?.purl).filter(Boolean));
  const rows = j.dependencies ?? [];
  for (const ref of refs) {
    if (rows.filter((row) => row?.ref === ref).length !== 1) {
      errors.push(`${f}: dependency row count for ${ref}`);
    }
  }
  for (const row of rows) {
    if (!refs.has(row?.ref) || (row.dependsOn ?? []).some((ref) => !refs.has(ref))) {
      errors.push(`${f}: unknown dependency relationship`);
    }
  }
  const declared = new Set((rows.find((row) => row.ref === root?.purl)?.dependsOn ?? []));
  const expected = new Set((j.components ?? []).map((c) => c.purl));
  if (declared.size !== expected.size || [...expected].some((ref) => !declared.has(ref))) {
    errors.push(`${f}: incomplete root dependency relationships`);
  }
  for (const c of j.components ?? []) {
    tot++;
    if (c.supplier?.name) sup++;
    if (c.licenses?.length) lic++;
  }
}
const expectedFiles = process.env.COMPONENT_IDS.trim().split(/\s+/).length;
if (files !== expectedFiles) {
  errors.push(`generated ${files}/${expectedFiles} component SBOMs`);
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(`core fields/graphs: ${files}/${files}`);
console.log(`component supplier: ${sup}/${tot}`);
console.log(`component license:  ${lic}/${tot}`);
'
```

Regenerate with `--with-licenses` when auditing supplier and license coverage;
without it registry-enriched values are absent while reviewed local fields
remain. Maven and NuGet inventories still read their published dependency
descriptors.

Known structural gaps, which are **not** findings: pub.dev exposes neither
license nor supplier in package metadata, and some NuGet packages carry only a
non-SPDX license URL.

Optionally score the result with
[`sbomqs`](https://github.com/interlynk-io/sbomqs):
`sbomqs score "$SECURITY_AUDIT_ROOT"/core-a/*.cdx.json`.

## 5. No leaked paths or secrets

A published SBOM is a public document about a private filesystem.

```bash
if grep -rlE '/Users/|/home/[a-z]|/tmp/|ghp_|npm_[A-Za-z0-9]|BEGIN [A-Z ]*PRIVATE KEY' \
  "$SECURITY_AUDIT_ROOT/core-a"; then
  echo "LEAK"
  exit 1
fi
echo "clean"
```

## 6. Core determinism

The dependency inventory must be byte-identical for the same release commit,
generator commit, and resolver input. Do not pass `--with-licenses` here: live
registry license and supplier metadata is point-in-time enrichment.

```bash
node scripts/generate-sbom.mjs google \
  --output-dir "$SECURITY_AUDIT_ROOT/core-b"
diff "$SECURITY_AUDIT_ROOT"/core-a/openiap-google-*.cdx.json \
  "$SECURITY_AUDIT_ROOT"/core-b/openiap-google-*.cdx.json
```

## 7. Published release assets

Fresh local output does not prove that the public release asset is complete.
Download every published stable SBOM, bind it to the release tag and API digest,
validate its schema, and verify its exact signing workflow:

```bash
set -euo pipefail
git fetch origin main --tags
gh api --paginate --slurp \
  "repos/hyodotdev/openiap/releases?per_page=100" \
  > "$SECURITY_AUDIT_ROOT/releases.json"

node scripts/generate-sbom.mjs missing-release-tags \
  "$SECURITY_AUDIT_ROOT/releases.json" \
  > "$SECURITY_AUDIT_ROOT/missing-tags.txt"
if [ -s "$SECURITY_AUDIT_ROOT/missing-tags.txt" ]; then
  cat "$SECURITY_AUDIT_ROOT/missing-tags.txt"
  exit 1
fi

node scripts/generate-sbom.mjs published-release-assets \
  "$SECURITY_AUDIT_ROOT/releases.json" \
  > "$SECURITY_AUDIT_ROOT/published-assets.tsv"
mkdir -p "$SECURITY_AUDIT_ROOT/published" \
  "$SECURITY_AUDIT_ROOT/scan" \
  "$SECURITY_AUDIT_ROOT/reports"
while IFS=$'\t' read -r component version tag name digest; do
  node scripts/assert-release-tag.mjs \
    "$component" main "$tag" "$version" || exit 1
  gh release download "$tag" --repo hyodotdev/openiap \
    -p "$name" -D "$SECURITY_AUDIT_ROOT/published" || exit 1
  file="$SECURITY_AUDIT_ROOT/published/$name"
  node scripts/generate-sbom.mjs verify-file "$file" \
    --tag "$tag" --digest "$digest" || exit 1
  cyclonedx validate --input-file "$file" --input-format json \
    --input-version v1_6 --fail-on-errors || exit 1
  cert_identity=https://github.com/hyodotdev/openiap
  cert_identity="$cert_identity/.github/workflows/sbom.yml@refs/heads/main"
  attestation_file="$SECURITY_AUDIT_ROOT/reports/$name.attestation.json"
  gh attestation verify "$file" --repo hyodotdev/openiap \
    --cert-identity "$cert_identity" \
    --deny-self-hosted-runners --format json \
    > "$attestation_file" || exit 1
  node scripts/generate-sbom.mjs verify-attested-generator \
    "$file" "$attestation_file" \
    --repository hyodotdev/openiap --branch main || exit 1
  scan_file="$SECURITY_AUDIT_ROOT/scan/$name"
  node scripts/generate-sbom.mjs scan-copy "$file" "$scan_file"
  report_file="$SECURITY_AUDIT_ROOT/reports/$name.osv.json"
  if jq -e '(.components // []) | length > 0' "$scan_file" >/dev/null; then
    osv-scanner scan source -L="$scan_file" --format=json \
      > "$report_file" || exit 1
  else
    jq -n --arg source "$name" '{
      source: $source,
      results: [],
      note: "SBOM declares no exact third-party components"
    }' > "$report_file"
  fi
done < "$SECURITY_AUDIT_ROOT/published-assets.tsv"

ASSESSED_MAIN_SHA=$(git rev-parse origin/main)
gh run list --workflow security-rescan.yml --branch main --event schedule --limit 1 \
  --json databaseId,status,conclusion,headSha,createdAt,url \
  > "$SECURITY_AUDIT_ROOT/latest-scheduled-rescan.json"
node -e '
const run = require(process.env.SECURITY_AUDIT_ROOT + "/latest-scheduled-rescan.json")[0];
const freshAfter = Date.now() - 9 * 24 * 60 * 60 * 1000;
if (!run || run.status !== "completed" || run.conclusion !== "success" ||
    !Number.isFinite(Date.parse(run.createdAt)) || Date.parse(run.createdAt) < freshAfter) {
  throw new Error("no successful scheduled security rescan in the last nine days");
}
'

gh run list --workflow security-rescan.yml --branch main \
  --commit "$ASSESSED_MAIN_SHA" --limit 100 \
  --json databaseId,status,conclusion,headSha,createdAt,url,event \
  > "$SECURITY_AUDIT_ROOT/recent-rescans.json"
jq -e --arg sha "$ASSESSED_MAIN_SHA" '
  any(.[];
    .headSha == $sha and
    (.event == "schedule" or .event == "workflow_dispatch") and
    .status == "completed" and .conclusion == "success")
' "$SECURITY_AUDIT_ROOT/recent-rescans.json" >/dev/null
```

An existing asset without the required generator commit is a failure even when
its dependency list, schema, and attestation are otherwise valid.
The latest scheduled run must be recent and successful to prove cron health.
Separately, the assessed `main` commit needs a successful scheduled or manual
run. A missing run after the workflow first lands is a gap, not a pass. The
hosted run also rebuilds and scans the current Kit source image; inspect its
retained `kit-container-trivy` artifact when triaging a finding.

## 8. Workflow permissions and injection

Least privilege, and no untrusted value interpolated into a shell command:

```bash
# Any ${{ }} inside a run: value is a potential injection point. The structural
# parser scans both .yml and .yaml workflows, enforces read-only defaults, and
# requires exact action SHAs with reviewed version comments.
node scripts/audit-security.mjs workflows
```

Pass values through `env:` instead of interpolating them. OpenSSF Scorecard's
Dangerous-Workflow check flags the same pattern.

## 9. Generated SBOMs stay out of git

```bash
git check-ignore -v sbom/ || {
  echo "GAP: sbom/ is committable"
  exit 1
}
tracked_sboms=$(git ls-files '*.cdx.json')
if [ -n "$tracked_sboms" ]; then
  echo "$tracked_sboms"
  echo "GAP: generated SBOMs are tracked"
  exit 1
fi
```

## 10. Documentation matches the code

Documentation drift is the most common finding, because prose has no compiler.

```bash
# Component table in security/SBOM.md vs the release SSOT
node -e '
import("./scripts/generate-sbom.mjs").then((m) => {
  const doc = require("fs").readFileSync("security/SBOM.md", "utf8");
  let missing = 0;
  for (const id of m.listComponentIds()) {
    if (!doc.includes(`\`${id}\``)) {
      console.error(`MISSING from SBOM.md: ${id}`);
      missing++;
    }
  }
  if (missing) process.exitCode = 1;
});
'

# External references must resolve
node scripts/audit-security.mjs urls \
  $(rg --files security packages/docs/src/pages/docs/security \
    -g '*.md' -g '*.tsx')
```

Also check for **hardcoded counts** — "nine workflows", "43 of 47
dependencies". They are true on the day they are written and wrong later.
Prefer a described property or a command that prints the live number.

## 11. Release integrity still holds

```bash
node --test scripts/release-branch-policy.test.mjs \
  scripts/npm-publish-authorization.test.mjs \
  scripts/verify-npm-release-provenance.test.mjs
node scripts/release-branch-policy.mjs audit
```

## 12. Report

State each check as pass, gap, or not-applicable with the command output that
justifies it. For every gap, either fix it in the same pass or record why it is
deliberate. Do not report a check as passing when its tool was unavailable —
report it as unrun and say which tool is missing.
