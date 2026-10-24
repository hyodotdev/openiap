#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
kmp_dir="$PWD"
verification_dir="$(mktemp -d "${TMPDIR:-/tmp}/kmp-iap-swiftpm.XXXXXX")"
trap 'rm -rf "$verification_dir"' EXIT

# Fail even when a build tool tries to hide a CocoaPods failure.
mkdir -p "$verification_dir/bin"
cat > "$verification_dir/bin/pod" <<'SH'
#!/bin/sh
touch "$OPENIAP_COCOAPODS_CALLED"
echo 'CocoaPods was invoked during SwiftPM verification' >&2
exit 1
SH
chmod +x "$verification_dir/bin/pod"
export OPENIAP_COCOAPODS_CALLED="$verification_dir/cocoapods-called"
export PATH="$verification_dir/bin:$PATH"

./gradlew --no-parallel \
  :library:iosSimulatorArm64Test \
  :library:linkDebugFrameworkIosArm64 \
  :library:linkDebugFrameworkIosSimulatorArm64 \
  :library:linkDebugFrameworkIosX64

xcodebuild -project example/iosApp/iosApp.xcodeproj -scheme iosApp \
  -configuration Debug -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$verification_dir/DerivedData" \
  CODE_SIGNING_ALLOWED=NO ARCHS=arm64 build

verification_version=0.0.0-swiftpm-check
./gradlew --no-parallel -PopeniapAppleRemote=true \
  "-PlibraryVersion=$verification_version" "-Dmaven.repo.local=$verification_dir/maven" \
  :library:publishKotlinMultiplatformPublicationToMavenLocal \
  :library:publishIosArm64PublicationToMavenLocal \
  :library:publishIosSimulatorArm64PublicationToMavenLocal \
  :library:publishIosX64PublicationToMavenLocal

metadata_file="$verification_dir/maven/io/github/hyochan/kmp-iap/$verification_version/kmp-iap-$verification_version-swiftpm-metadata.json"
python3 - "$metadata_file" <<'PY'
import json
import sys
from pathlib import Path

metadata = json.loads(Path(sys.argv[1]).read_text())
apple_version = json.loads(Path("openiap-versions.json").read_text())["apple"]
dependency, = metadata["dependencies"]
assert dependency["repository"]["value"] == "https://github.com/hyodotdev/openiap.git"
assert dependency["version"]["type"].endswith(".Exact")
assert dependency["version"]["value"] == apple_version
assert "absolutePath" not in dependency
assert [product["name"] for product in dependency["products"]] == ["OpenIAP"]
PY

mkdir -p "$verification_dir/consumer/src/"{commonMain,commonTest}/kotlin
kotlin_version="$(sed -n 's/^kotlin = "\([^"]*\)"/\1/p' gradle/libs.versions.toml)"
cat > "$verification_dir/consumer/settings.gradle.kts" <<KOTLIN
pluginManagement { repositories { mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement {
    repositories {
        maven { url = uri("$verification_dir/maven") }
        mavenCentral()
    }
}
rootProject.name = "swiftpm-consumer"
KOTLIN
cat > "$verification_dir/consumer/build.gradle.kts" <<KOTLIN
plugins { kotlin("multiplatform") version "$kotlin_version" }
kotlin {
    listOf(iosArm64(), iosSimulatorArm64(), iosX64()).forEach { target ->
        target.binaries.framework { baseName = "Consumer"; isStatic = true }
    }
    sourceSets {
        commonMain.dependencies { implementation("io.github.hyochan:kmp-iap:$verification_version") }
        commonTest.dependencies { implementation(kotlin("test")) }
    }
}
KOTLIN
cat > "$verification_dir/consumer/src/commonMain/kotlin/Consumer.kt" <<'KOTLIN'
import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.IapkitConfirmationOptions
import io.github.hyochan.kmpiap.createDeviceConfirmationIOS
import io.github.hyochan.kmpiap.createIapkitConfirmation
import io.github.hyochan.kmpiap.readIapkitVerification
import io.github.hyochan.kmpiap.toIapkitVerificationProps
import io.github.hyochan.kmpiap.PurchaseIOS
import io.github.hyochan.kmpiap.VerifyPurchaseWithProviderProps
import io.github.hyochan.kmpiap.VerifyPurchaseWithProviderResult

@Suppress("DEPRECATION")
suspend fun legacyConfirmationConsumer(purchase: PurchaseIOS, verify: suspend (VerifyPurchaseWithProviderProps) -> VerifyPurchaseWithProviderResult) {
    val options = IapkitConfirmationOptions()
    val props = toIapkitVerificationProps(purchase, options)
    val result = verify(props)
    readIapkitVerification(result, purchase, false)
    createIapkitConfirmation(verify, options)(purchase, false)
    createDeviceConfirmationIOS({ listOf(purchase) })(purchase, false)
    createDeviceConfirmationIOS({ listOf(purchase) }, null)(purchase, false)
}

fun runtimeVersion(): String = KmpIAP().getVersion()
KOTLIN
cat > "$verification_dir/consumer/src/commonTest/kotlin/NativeLinkTest.kt" <<'KOTLIN'
import kotlin.test.Test
import kotlin.test.assertTrue

class NativeLinkTest {
    @Test
    fun nativeCoreLinksFromPublishedArtifact() {
        assertTrue(runtimeVersion().startsWith("KMP-IAP"))
    }
}
KOTLIN

"$kmp_dir/gradlew" -p "$verification_dir/consumer" --no-parallel \
  iosSimulatorArm64Test linkDebugFrameworkIosArm64 \
  linkDebugFrameworkIosSimulatorArm64 linkDebugFrameworkIosX64

test ! -e "$OPENIAP_COCOAPODS_CALLED"
mkdir -p "$kmp_dir/build/reports/swiftpm"
cp "$metadata_file" "$kmp_dir/build/reports/swiftpm/"
cp "$verification_dir/consumer/build/test-results/iosSimulatorArm64Test/"*.xml \
  "$kmp_dir/build/reports/swiftpm/"
echo 'SwiftPM library, Xcode app, and Maven consumer verified without CocoaPods.'
