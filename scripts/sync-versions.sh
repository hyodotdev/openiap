#!/bin/bash

# Sync version files from root to packages
# Uses symlinks for native packages, copies for docs (Vercel requirement)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$REPO_ROOT"

echo "📦 Syncing version files..."

sync_package_json_version() {
    local package_path="$1"
    local version_key="$2"

    if [ ! -f "$package_path" ]; then
        echo "  ! Skipping $package_path (missing)"
        return
    fi

    python3 - "$package_path" "$version_key" <<'PY'
import json
import sys
from pathlib import Path

package_path, version_key = sys.argv[1:]
versions = json.loads(Path("openiap-versions.json").read_text(encoding="utf-8"))
version = versions.get(version_key)
if not isinstance(version, str) or not version:
    raise SystemExit(f"openiap-versions.json missing {version_key} version")

path = Path(package_path)
package = json.loads(path.read_text(encoding="utf-8"))
package["version"] = version
path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")
PY
    echo "  ✓ $package_path -> $version_key"
}

echo ""
echo "📦 Syncing package metadata..."
sync_package_json_version "packages/gql/package.json" "spec"
sync_package_json_version "packages/docs/package.json" "spec"
sync_package_json_version "packages/google/package.json" "google"
sync_package_json_version "packages/apple/package.json" "apple"

# Function to create symlink
create_symlink() {
    local target="$1"
    local link_path="$2"

    # Remove existing file or symlink
    if [ -e "$target" ] || [ -L "$target" ]; then
        rm "$target"
    fi

    # Create symlink
    ln -s "$link_path" "$target"
    echo "  ✓ $target -> $link_path (symlink)"
}

# Function to copy file
copy_file() {
    local target="$1"

    # Remove existing file or symlink
    if [ -e "$target" ] || [ -L "$target" ]; then
        rm "$target"
    fi

    # Copy file
    cp "openiap-versions.json" "$target"
    echo "  ✓ $target (copied)"
}

# Docs needs real file for Vercel deployment
copy_file "packages/docs/openiap-versions.json"

sync_docs_version_metadata() {
    python3 <<'PY'
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET

def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")

def read_json(path: str) -> dict:
    return json.loads(read(path))

def required_match(path: str, pattern: str, label: str) -> str:
    match = re.search(pattern, read(path), flags=re.MULTILINE)
    if not match:
        raise SystemExit(f"missing {label}")
    value = match.group(1).strip()
    if not value:
        raise SystemExit(f"empty {label}")
    return value

def required_xml_text(path: str, tag: str, label: str) -> str:
    root = ET.fromstring(read(path))
    node = root.find(f".//{tag}")
    value = (node.text or "").strip() if node is not None else ""
    if not value:
        raise SystemExit(f"missing {label}")
    return value

metadata = {
    "_generatedBy": "scripts/sync-versions.sh",
    "expoPackageVersion": read_json("libraries/expo-iap/package.json")["version"],
    "reactNativePackageVersion": read_json("libraries/react-native-iap/package.json")["version"],
    "flutterPackageVersion": required_match(
        "libraries/flutter_inapp_purchase/pubspec.yaml",
        r"^version:\s*(.+)$",
        "Flutter package version",
    ),
    "godotPackageVersion": required_match(
        "libraries/godot-iap/addons/godot-iap/plugin.cfg",
        r'^version="([^"]+)"$',
        "Godot package version",
    ),
    "kmpPackageVersion": required_match(
        "libraries/kmp-iap/gradle.properties",
        r"^libraryVersion=(.+)$",
        "KMP package version",
    ),
    "mauiPackageId": required_xml_text(
        "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
        "PackageId",
        "MAUI PackageId",
    ),
    "mauiPackageVersion": required_xml_text(
        "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
        "PackageVersion",
        "MAUI PackageVersion",
    ),
    "googleCompileSdk": required_match(
        "packages/google/openiap/build.gradle.kts",
        r"compileSdk\s*=\s*(\d+)",
        "Google compileSdk",
    ),
    "googleMinSdk": required_match(
        "packages/google/openiap/build.gradle.kts",
        r"minSdk\s*=\s*(\d+)",
        "Google minSdk",
    ),
    "googlePlayBillingVersion": required_match(
        "packages/google/openiap/build.gradle.kts",
        r'val\s+playBillingVersion\s*=\s*"([^"]+)"',
        "Google Play Billing version",
    ),
    "kmpCompileSdk": required_match(
        "libraries/kmp-iap/gradle/libs.versions.toml",
        r'^android-compileSdk = "([^"]+)"',
        "KMP android-compileSdk",
    ),
    "kmpMinSdk": required_match(
        "libraries/kmp-iap/gradle/libs.versions.toml",
        r'^android-minSdk = "([^"]+)"',
        "KMP android-minSdk",
    ),
    "kmpTargetSdk": required_match(
        "libraries/kmp-iap/gradle/libs.versions.toml",
        r'^android-targetSdk = "([^"]+)"',
        "KMP android-targetSdk",
    ),
}

target = Path("packages/docs/src/generated/version-metadata.json")
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
PY
    echo "  ✓ packages/docs/src/generated/version-metadata.json"
}

# Docs cannot import files outside packages/docs on Vercel. Keep a generated
# metadata copy inside the docs package, sourced from package/library metadata.
sync_docs_version_metadata

# Native packages can use symlinks
create_symlink "packages/apple/Sources/openiap-versions.json" "../../../openiap-versions.json"
create_symlink "packages/google/openiap-versions.json" "../../openiap-versions.json"

# Libraries use symlinks to root openiap-versions.json
echo ""
echo "📦 Syncing to libraries..."
create_symlink "libraries/react-native-iap/openiap-versions.json" "../../openiap-versions.json"
create_symlink "libraries/expo-iap/openiap-versions.json" "../../openiap-versions.json"
create_symlink "libraries/flutter_inapp_purchase/openiap-versions.json" "../../openiap-versions.json"
create_symlink "libraries/godot-iap/openiap-versions.json" "../../openiap-versions.json"
create_symlink "libraries/kmp-iap/openiap-versions.json" "../../openiap-versions.json"
create_symlink "libraries/maui-iap/openiap-versions.json" "../../openiap-versions.json"

sync_maui_android_versions() {
    local google_build="packages/google/openiap/build.gradle.kts"
    local maui_props="libraries/maui-iap/src/Directory.Build.props"
    local maui_gradle_props="libraries/maui-iap/android/gradle.properties"

    if [ ! -f "$google_build" ] || [ ! -f "$maui_props" ] || [ ! -f "$maui_gradle_props" ]; then
        echo "  ! Skipping MAUI Android version sync (required files missing)"
        return
    fi

    local play_billing_version
    local gson_version
    play_billing_version=$(python3 - "$google_build" <<'PY'
import re
import sys

text = open(sys.argv[1], encoding="utf-8").read()
match = re.search(r'val\s+playBillingVersion\s*=\s*"([^"]+)"', text)
if not match:
    raise SystemExit("missing playBillingVersion")
print(match.group(1))
PY
)
    gson_version=$(python3 - "$google_build" <<'PY'
import re
import sys

text = open(sys.argv[1], encoding="utf-8").read()
match = re.search(r'com\.google\.code\.gson:gson:([^"$]+)', text)
if not match:
    raise SystemExit("missing gson version")
print(match.group(1))
PY
)
    python3 - "$maui_props" "$play_billing_version" "$gson_version" <<'PY'
import re
import sys

path, play_billing, gson = sys.argv[1:]
text = open(path, encoding="utf-8").read()
preserved_property_names = [
    "MauiKotlinStdLibVersion",
    "MauiKotlinCoroutinesVersion",
    "MauiGoogleTransportApiVersion",
    "MauiGoogleTransportBackendCctVersion",
    "MauiGoogleTransportRuntimeVersion",
    "MauiGooglePlayServicesBaseVersion",
    "MauiGooglePlayServicesBasementVersion",
    "MauiGooglePlayServicesLocationVersion",
    "MauiGooglePlayServicesTasksVersion",
]
preserved = {}
for name in preserved_property_names:
    match = re.search(fr"<{name}>([^<]+)</{name}>", text)
    if not match:
        raise SystemExit(f"missing {name}")
    preserved[name] = match.group(1)

content = f"""<Project>
  <!-- Generated by scripts/sync-versions.sh. Play Billing and Gson follow packages/google/openiap/build.gradle.kts. -->
  <PropertyGroup>
    <MauiPlayBillingVersion>{play_billing}</MauiPlayBillingVersion>
    <MauiGsonVersion>{gson}</MauiGsonVersion>
    <MauiKotlinStdLibVersion>{preserved["MauiKotlinStdLibVersion"]}</MauiKotlinStdLibVersion>
    <MauiKotlinCoroutinesVersion>{preserved["MauiKotlinCoroutinesVersion"]}</MauiKotlinCoroutinesVersion>
    <MauiGoogleTransportApiVersion>{preserved["MauiGoogleTransportApiVersion"]}</MauiGoogleTransportApiVersion>
    <MauiGoogleTransportBackendCctVersion>{preserved["MauiGoogleTransportBackendCctVersion"]}</MauiGoogleTransportBackendCctVersion>
    <MauiGoogleTransportRuntimeVersion>{preserved["MauiGoogleTransportRuntimeVersion"]}</MauiGoogleTransportRuntimeVersion>
    <MauiGooglePlayServicesBaseVersion>{preserved["MauiGooglePlayServicesBaseVersion"]}</MauiGooglePlayServicesBaseVersion>
    <MauiGooglePlayServicesBasementVersion>{preserved["MauiGooglePlayServicesBasementVersion"]}</MauiGooglePlayServicesBasementVersion>
    <MauiGooglePlayServicesLocationVersion>{preserved["MauiGooglePlayServicesLocationVersion"]}</MauiGooglePlayServicesLocationVersion>
    <MauiGooglePlayServicesTasksVersion>{preserved["MauiGooglePlayServicesTasksVersion"]}</MauiGooglePlayServicesTasksVersion>
  </PropertyGroup>
</Project>
"""
open(path, "w", encoding="utf-8").write(content)
PY

    python3 - "$maui_gradle_props" "$gson_version" <<'PY'
import re
import sys

path, gson = sys.argv[1:]
text = open(path, encoding="utf-8").read()
if re.search(r'^mauiGsonVersion=', text, flags=re.MULTILINE):
    text = re.sub(r'^mauiGsonVersion=.*$', f'mauiGsonVersion={gson}', text, flags=re.MULTILINE)
else:
    if not text.endswith('\n'):
        text += '\n'
    text += f'mauiGsonVersion={gson}\n'
open(path, "w", encoding="utf-8").write(text)
PY
    echo "  ✓ libraries/maui-iap Android dependency versions"
}

echo ""
echo "📦 Syncing MAUI Android dependency versions..."
sync_maui_android_versions

# Sync generated types from packages/gql to libraries
echo ""
echo "📦 Syncing generated types..."
GQL_GENERATED="packages/gql/src/generated"

# TypeScript types → react-native-iap, expo-iap
if [ -f "$GQL_GENERATED/types.ts" ]; then
    cp "$GQL_GENERATED/types.ts" "libraries/react-native-iap/src/types.ts"
    echo "  ✓ libraries/react-native-iap/src/types.ts"
    cp "$GQL_GENERATED/types.ts" "libraries/expo-iap/src/types.ts"
    echo "  ✓ libraries/expo-iap/src/types.ts"
fi

# Dart types → flutter_inapp_purchase
if [ -f "$GQL_GENERATED/types.dart" ]; then
    cp "$GQL_GENERATED/types.dart" "libraries/flutter_inapp_purchase/lib/types.dart"
    echo "  ✓ libraries/flutter_inapp_purchase/lib/types.dart"
fi

# GDScript types → godot-iap
if [ -f "$GQL_GENERATED/types.gd" ]; then
    cp "$GQL_GENERATED/types.gd" "libraries/godot-iap/addons/godot-iap/types.gd"
    echo "  ✓ libraries/godot-iap/addons/godot-iap/types.gd"
fi

# C# types → maui-iap
if [ -f "$GQL_GENERATED/Types.cs" ]; then
    cp "$GQL_GENERATED/Types.cs" "libraries/maui-iap/src/OpenIap.Maui/Types.cs"
    echo "  ✓ libraries/maui-iap/src/OpenIap.Maui/Types.cs"
fi

echo "✅ Version files and types synced successfully"
