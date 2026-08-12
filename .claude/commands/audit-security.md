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
[`security/CRA.md`](../../security/CRA.md). Read them before reporting a gap —
several apparent gaps are documented deliberate choices.

## 1. SBOM generates for every releasable component

The component list is owned by the release SSOT, not by the SBOM code. A
component that can be released but has no SBOM definition is a release that
ships without an inventory.

```bash
node --test scripts/generate-sbom.test.mjs

for c in $(node -e 'import("./scripts/generate-sbom.mjs").then(m=>console.log(m.listComponentIds().join(" ")))'); do
  printf "%-14s " "$c"
  node scripts/generate-sbom.mjs "$c" --output-dir /tmp/sbom-audit || echo "FAILED"
done
```

A failure here is the intended behaviour when a build manifest gained a
declaration shape the reader does not model — fix the reader, never silence it.

## 2. Schema validity

```bash
for f in /tmp/sbom-audit/*.cdx.json; do
  cyclonedx validate --input-file "$f" --input-format json \
    --input-version v1_6 --fail-on-errors
done
```

Install with `brew install cyclonedx-cli` if absent.

## 3. NTIA minimum elements

The [NTIA minimum elements](https://www.ntia.gov/report/2021/minimum-elements-software-bill-materials-sbom)
are the baseline OpenSSF recommends measuring against. Check author, timestamp,
and per-component name, version, purl, supplier, and dependency relationships:

```bash
node -e '
const fs = require("fs");
const dir = "/tmp/sbom-audit";
let tot = 0, sup = 0, lic = 0, purl = 0, auth = 0, files = 0;
for (const f of fs.readdirSync(dir)) {
  const j = JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
  files++;
  if (j.metadata?.authors?.length) auth++;
  for (const c of j.components ?? []) {
    tot++;
    if (c.supplier?.name) sup++;
    if (c.licenses?.length) lic++;
    if (c.purl) purl++;
  }
}
console.log(`SBOM author:        ${auth}/${files}`);
console.log(`component purl:     ${purl}/${tot}`);
console.log(`component supplier: ${sup}/${tot}`);
console.log(`component license:  ${lic}/${tot}`);
'
```

Regenerate with `--with-licenses` when auditing supplier and license coverage;
without it those fields are intentionally absent so local runs stay offline.

Known structural gaps, which are **not** findings: pub.dev exposes neither
license nor supplier in package metadata, and some NuGet packages carry only a
non-SPDX license URL.

Optionally score the result with
[`sbomqs`](https://github.com/interlynk-io/sbomqs):
`sbomqs score /tmp/sbom-audit/*.cdx.json`.

## 4. No leaked paths or secrets

A published SBOM is a public document about a private filesystem.

```bash
grep -rlE '/Users/|/home/[a-z]|/tmp/|ghp_|npm_[A-Za-z0-9]|BEGIN [A-Z ]*PRIVATE KEY' \
  /tmp/sbom-audit/ && echo "LEAK" || echo "clean"
```

## 5. Determinism

Regeneration at the same commit must be byte-identical, or the reproducibility
claim in `security/SBOM.md` is false.

```bash
node scripts/generate-sbom.mjs google --output-dir /tmp/sbom-audit-2
diff /tmp/sbom-audit/openiap-google-*.cdx.json /tmp/sbom-audit-2/openiap-google-*.cdx.json
```

## 6. Workflow permissions and injection

Least privilege, and no untrusted value interpolated into a shell command:

```bash
# Any ${{ }} inside a run: block is a potential injection point
for f in .github/workflows/*.yml; do
  awk '/^\s+run:/{r=1} /^\s+- name:|^\s+uses:/{r=0} r && /\$\{\{/ {print FILENAME": "$0}' "$f"
done

# Workflows that write must say so explicitly
grep -L "^permissions:" .github/workflows/*.yml
```

Pass values through `env:` instead of interpolating them. OpenSSF Scorecard's
Dangerous-Workflow check flags the same pattern.

## 7. Generated SBOMs stay out of git

```bash
git check-ignore -v sbom/ && echo "ignored" || echo "GAP: sbom/ is committable"
git ls-files '*.cdx.json' | head   # must be empty
```

## 8. Documentation matches the code

Documentation drift is the most common finding, because prose has no compiler.

```bash
# Component table in security/SBOM.md vs the release SSOT
node -e '
import("./scripts/generate-sbom.mjs").then((m) => {
  const doc = require("fs").readFileSync("security/SBOM.md", "utf8");
  for (const id of m.listComponentIds()) {
    if (!doc.includes(`\`${id}\``)) console.log(`MISSING from SBOM.md: ${id}`);
  }
});
'

# External references must resolve
grep -rhoE "https?://[^)\" ]+" security/*.md security/vex/*.md \
  packages/docs/src/pages/docs/security/*.tsx |
  sed 's/[.,)"]*$//' | sort -u |
  while read -r u; do
    code=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 20 "$u")
    [ "$code" = "200" ] || echo "$code $u"
  done
```

Also check for **hardcoded counts** — "nine workflows", "43 of 47
dependencies". They are true on the day they are written and wrong later.
Prefer a described property or a command that prints the live number.

## 9. Release integrity still holds

```bash
node --test scripts/release-branch-policy.test.mjs \
  scripts/npm-publish-authorization.test.mjs \
  scripts/verify-npm-release-provenance.test.mjs
node scripts/release-branch-policy.mjs audit
```

## 10. Report

State each check as pass, gap, or not-applicable with the command output that
justifies it. For every gap, either fix it in the same pass or record why it is
deliberate. Do not report a check as passing when its tool was unavailable —
report it as unrun and say which tool is missing.
