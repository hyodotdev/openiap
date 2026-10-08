#!/usr/bin/env bash
set -euo pipefail

google_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
repo_root=$(cd "$google_root/../.." && pwd)
fixture_root="$google_root/compatibility/community-provider"
repository=$(mktemp -d)
trap 'rm -rf "$repository"' EXIT
core_version=$(node -p "require(process.argv[1]).google" "$repo_root/openiap-versions.json")
suite_version=$(node --input-type=module -e "import {SUITE_VERSION} from '$repo_root/packages/conformance/src/spec/suite-version.mjs'; console.log(SUITE_VERSION)")

# Only local Maven artifacts are produced; no release credentials or remote publishing.
"$google_root/gradlew" -p "$google_root" :openiap-core:publishToMavenLocal \
    :openiap-conformance:publishToMavenLocal -Dmaven.repo.local="$repository"
args=(-PopenIapRepository="$repository" -PopenIapVersion="$core_version" -PconformanceVersion="$suite_version")
# Republished local artifacts require recompiling inlined contract constants.
"$google_root/gradlew" -p "$fixture_root" clean "${args[@]}"
"$google_root/gradlew" -p "$fixture_root" :provider:negativeConformance \
    :vendor-sdk:publishVendorPublicationToMavenLocal :provider:publishFixturePublicationToMavenLocal -Dmaven.repo.local="$repository" "${args[@]}"
"$google_root/gradlew" -p "$fixture_root" :host:assembleRelease "${args[@]}" \
    -PopeniapStore=community_fixture -PopeniapProvider=community.fixture:provider:1.0.0
node --input-type=module - "$repo_root" "$fixture_root" <<'JS'
import {readFileSync} from 'node:fs';
const [root, fixture] = process.argv.slice(2);
const {validateProviderReport} = await import(`${root}/specs/client/store-registry.mjs`);
const {providerProfile} = await import(`${root}/packages/conformance/src/spec/provider-profile.mjs`);
const profile = providerProfile('android');
const report = JSON.parse(readFileSync(`${fixture}/provider/build/reports/openiap/community_fixture.json`, 'utf8'));
if (!validateProviderReport(report, ['pendingPurchases', 'subscriptionBillingIssue', 'offerCodeRedemption'])) throw new Error('Fixture report did not pass');
const negative = JSON.parse(readFileSync(`${fixture}/provider/build/reports/openiap/missing-capability.json`, 'utf8'));
const failed = negative.results.filter((result) => result.outcome === 'fail');
if (validateProviderReport(negative, report.capabilities) || failed.length !== 1 || failed[0].id !== profile.capabilities.subscriptionBillingIssue) throw new Error('Missing capability did not fail its required behavior');
if (report.store !== 'unknown' || report.storeId !== 'community_fixture') throw new Error('Fixture identity was lost');
const mapping = readFileSync(`${fixture}/host/build/outputs/mapping/release/mapping.txt`, 'utf8');
if (!mapping.includes('community.fixture.FixtureFactory -> community.fixture.FixtureFactory:')) throw new Error('R8 did not preserve the factory');
if (['com.android.billingclient.', 'com.meta.horizon.billingclient.', 'com.amazon.device.iap.'].some((sdk) => mapping.includes(sdk))) throw new Error('Fixture linked an official billing SDK');
console.log(`Provider report passed ${report.results.length} behaviors on suite ${report.suiteVersion}; R8 kept its factory without official billing SDKs.`);
JS
if "$google_root/gradlew" -p "$fixture_root" :host:processReleaseMainManifest "${args[@]}" \
    -PopeniapStore=community_fixture -PopeniapProvider=community.fixture:provider:1.0.0 \
    -PduplicateProvider=true > "$repository/conflict.log" 2>&1; then
    echo 'Two providers unexpectedly passed manifest merging.' >&2
    exit 1
fi
if ! grep -q 'meta-data#dev.hyo.openiap.PROVIDER@value' "$repository/conflict.log"; then
    cat "$repository/conflict.log" >&2
    exit 1
fi
printf 'Duplicate providers failed manifest merging as required.\n'

plugin_fixture="$google_root/compatibility/store-plugin"
selection=(-PfixtureCommunityRepository="$repository" -PopeniapStore=community_fixture -PopeniapProvider=community.fixture:provider:1.0.0)
"$google_root/gradlew" -p "$plugin_fixture" :app:printDebugStores -PfixtureStrategy=provider "${selection[@]}" > "$repository/plugin.log" 2>&1
grep -q '^FIXTURE app:debugRuntimeClasspath=openiap-core,provider$' "$repository/plugin.log"
"$google_root/gradlew" -p "$plugin_fixture" :flavored:printProviderStores "${selection[@]}" > "$repository/plugin-flavor.log" 2>&1
grep -q '^FIXTURE flavored:providerDebugRuntimeClasspath=openiap-core,provider$' "$repository/plugin-flavor.log"
if "$google_root/gradlew" -p "$plugin_fixture" :flavored:printProviderStores \
    -PfixtureCommunityRepository="$repository" > "$repository/plugin-missing.log" 2>&1; then
    echo 'A provider flavor unexpectedly resolved without coordinates.' >&2
    exit 1
fi
grep -q 'provider platform flavor requires openiapStore and openiapProvider' "$repository/plugin-missing.log"
printf 'The Gradle plugin resolved core plus provider for plain and flavored consumers; missing coordinates failed.\n'
