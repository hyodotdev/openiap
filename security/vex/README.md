# VEX statements

A VEX (Vulnerability Exploitability eXchange) statement records **whether a
known vulnerability actually affects an OpenIAP component**. Its purpose is to
answer the question a consumer's scanner raises: their tool matched a CVE
against a dependency in our SBOM, and they need to know whether it is
reachable in our product.

## Why this is not generated

The dependency inventory and release SBOM are produced automatically from
released manifests and descriptors, shipped native declarations, and
hash-pinned embedded binaries. VEX cannot be generated automatically because
whether a CVE is exploitable through OpenIAP's use of a dependency is an
engineering judgement. Automation only
ensures that a recorded judgement ships with the release it applies to and
rejects a malformed one. The other files under `security/` are hand-authored
policy and assurance records.

**There is normally no file in this directory.** A file appears only when a CVE
has been analysed against a released component. An empty analysis is not
published, because an empty `vulnerabilities` array would read as "we checked
and found nothing" — a stronger claim than silence.

## Format

One file per component, named after its component id (`google.json`,
`react-native.json`, …). Use the ids from `bun run sbom` — the same ids as the
release SSOT.

```json
{
  "vulnerabilities": [
    {
      "id": "CVE-2021-44228",
      "source": {
        "name": "GitHub Advisory Database",
        "url": "https://github.com/advisories/GHSA-jfh8-c2jp-5v3q"
      },
      "affects": [{ "ref": "pkg:maven/com.example/library@1.2.3" }],
      "analysis": {
        "state": "not_affected",
        "justification": "code_not_reachable",
        "detail": "The vulnerable XML parser is only invoked by the library's servlet entry point, which OpenIAP does not use. OpenIAP calls only the billing result mapper."
      }
    }
  ]
}
```

The `affects[].ref` must match a `bom-ref` in the component's SBOM — that is
the purl of the dependency, exactly as generated.

## States

CycloneDX defines six analysis states
([VEX capability](https://cyclonedx.org/capabilities/vex/),
[`vulnerabilities` schema](https://cyclonedx.org/docs/1.6/json/#vulnerabilities)):

| State                    | Meaning                                                   |
| ------------------------ | --------------------------------------------------------- |
| `in_triage`              | Received, assessment under way                            |
| `exploitable`            | Confirmed to affect this component                        |
| `not_affected`           | Present in the dependency tree, but not exploitable here  |
| `false_positive`         | The matcher is wrong — the vulnerable code is not present |
| `resolved`               | Fixed in this version                                     |
| `resolved_with_pedigree` | Fixed, with the modification recorded in pedigree         |

`not_affected` and `false_positive` **require** a `justification` or `detail`.
A bare "not affected" is not reviewable, and reviewers are the entire point of
publishing one. Generation fails without it.

Standard justifications include `code_not_present`, `code_not_reachable`,
`requires_configuration`, `requires_dependency`, `requires_environment`,
`protected_by_compiler`, `protected_at_runtime`, `protected_at_perimeter`,
and `protected_by_mitigating_control`.

## How it reaches consumers

Statements are merged into the component's SBOM at release time and published
as part of the same `.cdx.json` asset. There is no separate VEX document to
find or verify — the SBOM a consumer already downloaded carries the analysis,
and the file is covered by the same provenance attestation.

## Lifecycle

VEX is a release-specific snapshot, like the SBOM. Editing a statement changes
only future releases; published assets follow the canonical
[`SBOM.md` update policy](../SBOM.md#update-policy). If an assessment changes —
for example a `not_affected` becomes `exploitable` after new information — that
is a security advisory and a new release, not an edit to history.

See [`../SBOM.md`](../SBOM.md) for the inventory these statements annotate and
[`../../SECURITY.md`](../../SECURITY.md) for the reporting process that
produces them.
