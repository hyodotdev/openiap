# OpenChain gap assessment

A self-assessment of OpenIAP against **ISO/IEC 18974** (OpenChain Security
Assurance) and, where relevant, **ISO/IEC 5230** (OpenChain License
Compliance). It records what exists, what does not, and what is deliberately
out of scope.

This is an internal gap list, **not a conformance claim**. OpenIAP has not
submitted a self-certification. The reference material is the OpenChain
specification text and the [Trusted OSS](https://trustedoss.github.io/en)
self-study guide, both openly licensed.

Why bother: 18974 is the closest existing standard to what the CRA expects of
software suppliers, and it is expressed as verifiable materials rather than
legal language. Closing these gaps improves the security programme regardless
of which regulation applies. It also aligns with the foundation track, since
OpenChain is a Linux Foundation project.

## ISO/IEC 18974 — Security Assurance

| Req   | Requirement                   | Status      | Where / what is missing                                                                                                                                                                                                                                           |
| ----- | ----------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1.1 | Policy                        | **Partial** | [`README.md`](README.md) and [`SBOM.md`](SBOM.md) document practice, and [`../SECURITY.md`](../SECURITY.md) documents reporting. There is no single named "open source security assurance policy" document, and no procedure for communicating it to participants |
| 4.1.2 | Competence                    | **Missing** | No role/responsibility inventory, no `MAINTAINERS.md`, no competency definitions                                                                                                                                                                                  |
| 4.1.3 | Awareness                     | **Missing** | No assessed-awareness evidence. Low value at current project size — see _Proportionality_                                                                                                                                                                         |
| 4.1.4 | Program scope                 | **Partial** | Scope is defined in [`../SECURITY.md`](../SECURITY.md#scope) and per-component in [`SBOM.md`](SBOM.md#scope). No target performance metrics, no review cadence                                                                                                    |
| 4.1.5 | Standard practice (8 methods) | **Partial** | Present: vulnerability detection (Dependabot), follow-up and customer communication ([`../SECURITY.md`](../SECURITY.md)), information export (SBOM/VEX). Absent: documented threat identification, continuous security testing, and risk verification procedures  |
| 4.2.1 | Access                        | **Met**     | Public reporting contact and private disclosure channel in [`../SECURITY.md`](../SECURITY.md), with a documented internal response path including the 24/72-hour timeline                                                                                         |
| 4.2.2 | Effectively resourced         | **Missing** | No documented personnel assignment or staffing/funding adequacy statement                                                                                                                                                                                         |
| 4.3.1 | Software bill of materials    | **Met**     | Documented procedure in [`SBOM.md`](SBOM.md); component records published per release as CycloneDX assets, generated automatically                                                                                                                                |
| 4.3.2 | Security assurance            | **Partial** | Detection via Dependabot and a per-component vulnerability record mechanism via [`vex/`](vex/README.md). No documented end-to-end detection-to-resolution procedure covering non-dependency vulnerabilities                                                       |
| 4.4.1 | Completeness                  | **Missing** | No affirmation document; would be the output of closing the above                                                                                                                                                                                                 |
| 4.4.2 | Duration                      | **Missing** | No 18-month re-affirmation cycle defined                                                                                                                                                                                                                          |

## ISO/IEC 5230 — License Compliance (partial view)

Only the parts touched by the SBOM work are assessed here.

| Area                                                 | Status        | Notes                                                                                                                                                                               |
| ---------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component license inventory                          | **Partial**   | 43 of 47 direct dependencies carry license data in published SBOMs; the gaps are pub.dev packages and one NuGet package with a non-SPDX license URL ([`SBOM.md`](SBOM.md#licenses)) |
| License policy (allowed/conditional/forbidden tiers) | **Missing**   | No declared policy on which licenses may enter the dependency tree                                                                                                                  |
| Attribution / NOTICE generation                      | **Missing**   | Not generated. Low urgency: the published SDKs have no runtime dependencies to attribute                                                                                            |
| Per-package LICENSE files                            | **Known gap** | Tracked separately as foundation-readiness work                                                                                                                                     |

## Proportionality

Several 18974 requirements — competence assessment, awareness training,
staffing adequacy — assume an organisation with employees. OpenIAP is a
small-maintainer open-source project. Producing HR-shaped evidence for a
project this size would be paperwork that no one reads and that no consumer
benefits from.

The honest position: these are marked **Missing** rather than
_Not applicable_, because they would become real if OpenIAP moves under a
foundation. Until then, the requirements worth closing are the ones that
produce something a consumer or downstream manufacturer can actually use.

## Priority

Ordered by value to someone consuming OpenIAP, not by requirement number.

1. **`MAINTAINERS.md`** (4.1.2) — who is responsible, and who a reporter
   escalates to. Also on the foundation-readiness list, so it pays twice.
2. **Named security assurance policy** (4.1.1) — mostly assembly: the practice
   is already documented across `security/` and `SECURITY.md`; what is missing
   is one document that says "this is the policy" and is reviewed on a cadence.
3. **License policy tiers** (5230) — decide what may enter the dependency tree.
   Cheap to write now, expensive to retrofit once a copyleft dependency is
   already shipping.
4. **Threat identification and risk verification procedures** (4.1.5) — the
   two genuinely absent practice areas.
5. **Self-affirmation** (4.4.1, 4.4.2) — only meaningful once 1–4 exist.

Nothing here blocks a release. These are programme-maturity items, and the
technical evidence chain — SBOM, provenance, release-tag integrity — is
already in place.
