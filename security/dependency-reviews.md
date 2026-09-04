# Dependency review register

[`ASSURANCE.md`](ASSURANCE.md#dependency-and-license-policy) requires explicit
maintainer review before certain dependencies enter a released artifact or
hosted service. This file records which dependencies trip that requirement and
whether the review has happened, so the obligation is trackable rather than
implicit.

**This register does not record any review that has not taken place.** An entry
with no reviewer and no date has not been reviewed. Filling one in is a
maintainer action, not a maintenance chore.

## Scope

[`ASSURANCE.md`](ASSURANCE.md#dependency-and-license-policy) names five
triggers. This register currently covers **one** of them, and says which so the
gap is visible rather than implied:

| Trigger                                                          | Tracked here                 |
| ---------------------------------------------------------------- | ---------------------------- |
| custom terms, a missing license, or a non-SPDX license URL       | yes — derived from the SBOMs |
| copyleft or source-available licenses                            | no                           |
| packages from a Git branch, mutable URL, or unpublished tarball  | no                           |
| lifecycle scripts or binaries that execute during installation   | no                           |
| an override crossing a dependency's declared major-version range | no                           |

The four untracked triggers have no derived source today. Each needs its own
signal — an SPDX category list, a lockfile resolution audit, an install-script
scan, and the `overrides` block against declared ranges — and none is inferable
from the SBOM. They are named here so the register is not read as covering the
whole policy.

The tracked set is derived by hand, on the cadence below — no audit regenerates
or checks it, so a dependency that gains a custom licence between refreshes will
not appear here until someone runs the command. That is the gap to close if this
register ever gates a release rather than informing one. Refresh it with:

```bash
bun run sbom <component> --with-licenses --stdout
```

and read the components whose `licenses` carry neither an SPDX `id` nor an SPDX
`expression`. A compound expression such as `MIT AND Apache-2.0` is valid SPDX
and is **not** a trigger; 21 dependencies match that shape and are excluded for
that reason.

## Vendor SDK terms

Each of these declares custom terms rather than an SPDX license. All are
first-party store SDKs whose terms are a condition of distributing on that
store, so the question a review answers is whether the obligations are met by
this project's distribution model, not whether the dependency can be replaced.

| Declared terms                                   | Dependencies                                                                                                                                                                                                                                                        | Reviewed |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Android Software Development Kit License         | `com.android.billingclient:billing`, `com.google.android.gms:play-services-base`                                                                                                                                                                                    | —        |
| Meta Platform Technologies SDK License Agreement | `com.meta.horizon.billingclient.api:horizon-billing-compatibility`, `com.meta.horizon.platform.sdk:core-kotlin`, `com.meta.horizon.platform.sdk:iap-kotlin`, `com.meta.horizon.platform.sdk:user-age-category-kotlin`, `com.meta.horizon.platform.sdk:users-kotlin` | —        |
| Program Materials License                        | `com.amazon.device:amazon-appstore-sdk`                                                                                                                                                                                                                             | —        |

## No declared license

| Dependency                             | Where  | Reviewed |
| -------------------------------------- | ------ | -------- |
| `Xamarin.Android.Google.BillingClient` | `maui` | —        |

Its nuspec carries `<license type="file">LICENSE.md</license>` and NuGet's
`aka.ms/deprecateLicenseUrl` placeholder, so no license identifier or URL is
recoverable from the registry. The SBOM records no license rather than guessing
one, and the copyright line it does state is recorded.

## Policy review cadence

`ASSURANCE.md` commits to reviewing that policy before each release train and at
least every six months. Record each review here.

| Date | Reviewer | Scope | Outcome |
| ---- | -------- | ----- | ------- |
| —    | —        | —     | —       |
